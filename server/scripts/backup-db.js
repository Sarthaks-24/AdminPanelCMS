require('../config/loadEnv');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');

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
  const dbName = decodeURIComponent(new URL(uri).pathname.replace(/^\//, '').split('/')[0]);
  if (!dbName) throw new Error('MONGODB_URI must identify a database.');
  const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(os.homedir(), 'cms-backups'));
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archivePrefix = `backup_${dbName.replace(/[^A-Za-z0-9_-]/g, '_')}_`;
  const destination = path.join(backupDir, `${archivePrefix}${timestamp}.gz.gpg`);
  const partial = `${destination}.partial`;
  const candidates = ['mongodump', path.join(process.env.ProgramFiles || 'C:\\Program Files', 'MongoDB', 'Tools', '100', 'bin', 'mongodump.exe')];
  let dump;
  for (const executable of candidates) {
    try {
      dump = spawn(executable, ['--uri', uri, '--db', dbName, '--archive', '--gzip'], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
      const dumpExit = new Promise((resolve) => dump.once('close', resolve));
      await new Promise((resolve, reject) => {
        dump.once('spawn', resolve);
        dump.once('error', reject);
      });
      dump.exitCodePromise = dumpExit;
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error('mongodump failed to start.');
      dump = null;
    }
  }
  if (!dump) throw new Error('mongodump is unavailable; install MongoDB Database Tools.');
  const gpgArgs = ['--batch', '--yes', '--pinentry-mode', 'loopback', '--passphrase-file', passphraseFile, '--symmetric', '--cipher-algo', 'AES256', '--output', partial];
  let gpg;
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
    const size = fs.statSync(partial).size;
    if (!size) throw new Error('Encrypted backup is empty.');
    fs.renameSync(partial, destination);
    if (remoteDestination) {
      const remotePath = `${remoteDestination}/${path.basename(destination)}`;
      const uploader = spawn(process.env.RCLONE_BINARY || 'rclone', ['copyto', destination, remotePath], { stdio: 'ignore', windowsHide: true });
      const remoteCode = await new Promise((resolve, reject) => {
        uploader.once('error', reject);
        uploader.once('close', resolve);
      });
      if (remoteCode !== 0) throw new Error('Off-host encrypted backup upload failed.');
    }
    const backups = fs.readdirSync(backupDir)
      // Rotation is per database, so development runs never evict production archives.
      // The timestamp must follow the prefix directly, so `Portfolio` never matches `Portfolio_dev` archives.
      .filter((name) => name.startsWith(archivePrefix) && /^\d{4}-\d{2}-\d{2}T[\d-]+Z\.gz\.gpg$/.test(name.slice(archivePrefix.length)))
      .map((name) => ({ name, mtime: fs.statSync(path.join(backupDir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const old of backups.slice(14)) fs.unlinkSync(path.join(backupDir, old.name));
    console.log(`Encrypted backup complete: ${destination} (${size} bytes)${remoteDestination ? '; off-host copy verified by rclone' : ''}`);
  } catch {
    dump.kill();
    if (gpg) gpg.kill();
    try { fs.unlinkSync(partial); } catch { /* No partial output to clean up. */ }
    throw new Error('Backup failed; no plaintext archive was written. A local encrypted archive may remain if the off-host upload failed.');
  }
}

main().catch((error) => { console.error(`[Error] ${error.message}`); process.exitCode = 1; });
