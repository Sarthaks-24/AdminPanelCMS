require('../config/loadEnv');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');

const DAY_MS = 24 * 60 * 60 * 1000;

// Runs a tool, swallowing stdin and stderr, optionally capturing stdout. Resolves { code, stdout }; never rejects on ENOENT.
function run(command, args, capture = false) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { stdio: ['ignore', capture ? 'pipe' : 'ignore', 'ignore'], windowsHide: true });
    } catch (error) {
      resolve({ code: null, stdout: '', error });
      return;
    }
    let stdout = '';
    if (capture) child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.once('error', (error) => resolve({ code: null, stdout, error }));
    child.once('close', (code) => resolve({ code, stdout }));
  });
}

function retentionDays() {
  const raw = process.env.BACKUP_RETENTION_DAYS;
  if (raw === undefined || String(raw).trim() === '') return 30;
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error('BACKUP_RETENTION_DAYS must be a whole number of days between 1 and 3650.');
  return days;
}

async function main() {
  process.umask(0o077);
  const uri = process.env.MONGODB_URI;
  const passphraseFile = process.env.BACKUP_PASSPHRASE_FILE;
  if (!uri) throw new Error('Configure MONGODB_URI first.');
  const remoteDestination = String(process.env.BACKUP_REMOTE_DESTINATION || '').trim().replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production' && !remoteDestination) throw new Error('Production backups require BACKUP_REMOTE_DESTINATION for off-host encrypted copies.');
  if (!passphraseFile || !fs.existsSync(passphraseFile) || !fs.statSync(passphraseFile).isFile()) {
    throw new Error('Set BACKUP_PASSPHRASE_FILE to a protected file containing the backup passphrase.');
  }
  if (process.platform !== 'win32' && (fs.statSync(passphraseFile).mode & 0o077) !== 0) {
    throw new Error('BACKUP_PASSPHRASE_FILE must not be accessible by group or other users (chmod 600).');
  }
  const keepDays = retentionDays();
  const dbName = decodeURIComponent(new URL(uri).pathname.replace(/^\//, '').split('/')[0]);
  if (!dbName) throw new Error('MONGODB_URI must identify a database.');
  const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(os.homedir(), 'cms-backups'));
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archivePrefix = `backup_${dbName.replace(/[^A-Za-z0-9_-]/g, '_')}_`;
  const isArchiveName = (name) => name.startsWith(archivePrefix) && /^\d{4}-\d{2}-\d{2}T[\d-]+Z\.gz\.gpg$/.test(name.slice(archivePrefix.length));
  const destination = path.join(backupDir, `${archivePrefix}${timestamp}.gz.gpg`);
  const partial = `${destination}.partial`;
  const rclone = process.env.RCLONE_BINARY || 'rclone';
  const candidates = ['mongodump', path.join(process.env.ProgramFiles || 'C:\\Program Files', 'MongoDB', 'Tools', '100', 'bin', 'mongodump.exe')];
  // The URI (with its password) reaches mongodump through a 0600 YAML file, never argv, so `ps` on a shared
  // host cannot read it. The file sits in a private temp directory and is removed as soon as the dump ends.
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-dump-'));
  const configFile = path.join(configDir, 'mongodump.yaml');
  fs.writeFileSync(configFile, `uri: ${JSON.stringify(uri)}\n`, { mode: 0o600 });
  const removeConfig = () => { try { fs.rmSync(configDir, { recursive: true, force: true }); } catch { /* already gone */ } };
  let dump;
  for (const executable of candidates) {
    try {
      dump = spawn(executable, ['--config', configFile, '--db', dbName, '--archive', '--gzip'], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
      const dumpExit = new Promise((resolve) => dump.once('close', resolve));
      await new Promise((resolve, reject) => {
        dump.once('spawn', resolve);
        dump.once('error', reject);
      });
      dump.exitCodePromise = dumpExit;
      dumpExit.then(removeConfig);
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') { removeConfig(); throw new Error('mongodump failed to start.'); }
      dump = null;
    }
  }
  if (!dump) { removeConfig(); throw new Error('mongodump is unavailable; install MongoDB Database Tools.'); }
  const gpgArgs = ['--batch', '--yes', '--pinentry-mode', 'loopback', '--passphrase-file', passphraseFile, '--symmetric', '--cipher-algo', 'AES256', '--output', partial];
  let gpg;
  let size;
  try {
    gpg = spawn(process.env.GPG_BINARY || 'gpg', gpgArgs, { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });
    const gpgExit = new Promise((resolve) => gpg.once('close', resolve));
    await new Promise((resolve, reject) => {
      gpg.once('spawn', resolve);
      gpg.once('error', reject);
    });
    await pipeline(dump.stdout, gpg.stdin);
    const [dumpCode, gpgCode] = await Promise.all([dump.exitCodePromise, gpgExit]);
    if (dumpCode !== 0 || gpgCode !== 0) throw new Error('Encrypted backup pipeline failed.');
    size = fs.statSync(partial).size;
    if (!size) throw new Error('Encrypted backup is empty.');
    fs.renameSync(partial, destination);
    if (remoteDestination) {
      const remotePath = `${remoteDestination}/${path.basename(destination)}`;
      const upload = await run(rclone, ['copyto', destination, remotePath]);
      if (upload.code !== 0) throw new Error('Off-host encrypted backup upload failed.');
    }
  } catch {
    dump.kill();
    if (gpg) gpg.kill();
    try { fs.unlinkSync(partial); } catch { /* No partial output to clean up. */ }
    throw new Error('Backup failed; no plaintext archive was written. A local encrypted archive may remain if the off-host upload failed.');
  }
  console.log(`Encrypted backup complete: ${destination} (${size} bytes)${remoteDestination ? '; off-host copy verified by rclone' : ''}`);

  // Retention runs only after the new archive is safely written (and uploaded), so a prune failure never costs a backup.
  // Rotation is per database, so development runs never evict production archives, and the timestamp must follow the
  // prefix directly, so `Portfolio` never matches `Portfolio_dev` archives.
  const cutoff = Date.now() - keepDays * DAY_MS;
  const local = fs.readdirSync(backupDir)
    .filter(isArchiveName)
    .map((name) => ({ name, mtime: fs.statSync(path.join(backupDir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  // Never prune the newest archive, whatever its age (clock skew, a restored machine, a long gap between runs).
  const localPruned = local.slice(1).filter((entry) => entry.mtime < cutoff);
  for (const old of localPruned) fs.unlinkSync(path.join(backupDir, old.name));
  console.log(`Local retention ${keepDays} d: kept ${local.length - localPruned.length}, pruned ${localPruned.length}${localPruned.length ? ` (${localPruned.map((entry) => entry.name).join(', ')})` : ''}`);

  if (remoteDestination) {
    // Off-host retention is the GDPR erasure answer for backups (A26): nothing older than the window survives anywhere.
    const filter = ['--min-age', `${keepDays}d`, '--include', `${archivePrefix}*.gz.gpg`];
    const listing = await run(rclone, ['lsf', remoteDestination, ...filter], true);
    if (listing.code !== 0) throw new Error(`Backup and upload succeeded, but listing ${remoteDestination} for pruning failed; archives older than ${keepDays} days were NOT removed.`);
    const remotePruned = listing.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (remotePruned.length) {
      const removal = await run(rclone, ['delete', remoteDestination, ...filter]);
      if (removal.code !== 0) throw new Error(`Backup and upload succeeded, but pruning ${remotePruned.length} archive(s) older than ${keepDays} days from ${remoteDestination} failed.`);
    }
    console.log(`Off-host retention ${keepDays} d on ${remoteDestination}: pruned ${remotePruned.length}${remotePruned.length ? ` (${remotePruned.join(', ')})` : ''}`);
  }
}

main().catch((error) => { console.error(`[Error] ${error.message}`); process.exitCode = 1; });
