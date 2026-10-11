require('../config/loadEnv');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const mongoose = require('mongoose');

// ownerGuard-exemption: restore drill is constrained to a confirmed, local disposable database.

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function localMongoUri(uri, database) {
  const parsed = new URL(uri);
  if (parsed.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
    throw new Error('BACKUP_RESTORE_URI must point to a local MongoDB test instance.');
  }
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

// stderr is captured for mongorestore only: its final summary line is the one place that reports per-document failures.
function start(command, args, { pipeInput = false, captureStderr = false } = {}) {
  const child = spawn(command, args, { stdio: [pipeInput ? 'pipe' : 'ignore', 'pipe', captureStderr ? 'pipe' : 'ignore'], windowsHide: true });
  let stderr = '';
  if (captureStderr) child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exit = new Promise((resolve) => {
    child.once('error', (error) => resolve({ error, stderr }));
    child.once('close', (code) => resolve({ code, stderr }));
  });
  return { child, exit };
}

// mongorestore ends with e.g. "1234 document(s) restored successfully. 0 document(s) failed to restore."
function parseRestoreSummary(stderr) {
  const restored = /(\d+) document\(s\) restored successfully/.exec(stderr);
  const failed = /(\d+) document\(s\) failed to restore/.exec(stderr);
  return { restored: restored ? Number(restored[1]) : null, failed: failed ? Number(failed[1]) : null };
}

async function main() {
  const archive = path.resolve(argument('--file') || '');
  const archiveName = path.basename(archive);
  const today = new Date().toISOString().slice(0, 10);
  const targetDatabase = String(argument('--target-db') || '').trim();
  const confirmation = argument('--confirm-db');
  const sourceUri = process.env.MONGODB_URI;
  const restoreBaseUri = process.env.BACKUP_RESTORE_URI || 'mongodb://127.0.0.1:27017';
  const passphraseFile = process.env.BACKUP_PASSPHRASE_FILE;
  if (!sourceUri) throw new Error('Configure MONGODB_URI to identify the source backup database.');
  if (!targetDatabase || confirmation !== targetDatabase || !/_restore_test$/.test(targetDatabase)) {
    throw new Error('Provide --target-db <name>_restore_test --confirm-db <same-name> to use an isolated restore target.');
  }
  if (!fs.existsSync(archive) || !fs.statSync(archive).isFile() || !archive.endsWith('.gz.gpg')) throw new Error('Provide an existing encrypted .gz.gpg backup with --file.');
  if (!passphraseFile || !fs.existsSync(passphraseFile) || !fs.statSync(passphraseFile).isFile()) throw new Error('Set BACKUP_PASSPHRASE_FILE to the protected backup passphrase file.');
  if (process.platform !== 'win32' && (fs.statSync(passphraseFile).mode & 0o077) !== 0) throw new Error('BACKUP_PASSPHRASE_FILE must not be accessible by group or other users (chmod 600).');

  const sourceDatabase = decodeURIComponent(new URL(sourceUri).pathname.replace(/^\//, '').split('/')[0]);
  if (!sourceDatabase || sourceDatabase === targetDatabase) throw new Error('Source and restore database names must be different.');
  const targetUri = localMongoUri(restoreBaseUri, targetDatabase);
  await mongoose.connect(targetUri, { maxPoolSize: 2 });
  const existing = await mongoose.connection.db.listCollections().toArray();
  await mongoose.disconnect();
  if (existing.length) throw new Error(`Restore target ${targetDatabase} is not empty; choose a new disposable *_restore_test database.`);

  const decrypt = start(process.env.GPG_BINARY || 'gpg', ['--batch', '--pinentry-mode', 'loopback', '--passphrase-file', passphraseFile, '--decrypt', archive]);
  const restore = start(process.env.MONGORESTORE_BINARY || 'mongorestore', [
    '--uri', targetUri, '--archive', '--gzip', '--nsFrom', `${sourceDatabase}.*`, '--nsTo', `${targetDatabase}.*`,
  ], { pipeInput: true, captureStderr: true });
  let restoreStarted = true;
  let failure;
  try {
    await pipeline(decrypt.child.stdout, restore.child.stdin);
    const [decryptResult, restoreResult] = await Promise.all([decrypt.exit, restore.exit]);
    if (decryptResult.code !== 0 || restoreResult.code !== 0) throw new Error('Decrypt or restore command returned a failure status.');
    const summary = parseRestoreSummary(restoreResult.stderr);
    if (summary.failed === null || summary.restored === null) throw new Error('mongorestore did not report its document counts; the restore cannot be verified.');
    if (summary.failed > 0) throw new Error(`mongorestore reported ${summary.failed} document(s) that failed to restore.`);
    if (summary.restored === 0) throw new Error('mongorestore reported zero restored documents; the archive is empty or belongs to another database.');

    await mongoose.connect(targetUri, { maxPoolSize: 2 });
    const collections = await mongoose.connection.db.listCollections().toArray();
    if (!collections.length) throw new Error('The restore completed but created no collections.');
    const counts = [];
    for (const { name } of collections.sort((a, b) => a.name.localeCompare(b.name))) {
      // An exact count through the aggregate command, on the disposable database only.
      const result = await mongoose.connection.db.command({ aggregate: name, pipeline: [{ $count: 'n' }], cursor: {} });
      counts.push({ name, count: result.cursor.firstBatch.length ? result.cursor.firstBatch[0].n : 0 });
    }
    const total = counts.reduce((sum, entry) => sum + entry.count, 0);
    // The documents mongorestore says it wrote must all be readable back from the disposable database.
    if (total !== summary.restored) throw new Error(`Mismatch: mongorestore reported ${summary.restored} document(s) but ${total} are readable in ${targetDatabase}.`);
    const empty = counts.filter((entry) => entry.count === 0).map((entry) => entry.name);
    if (empty.length) throw new Error(`Mismatch: restored collection(s) with zero documents: ${empty.join(', ')}.`);
    console.log(`Restore verified in local disposable database ${targetDatabase}: ${counts.map((entry) => `${entry.name}=${entry.count}`).join(', ')}.`);
    // One line to paste into docs/OPERATIONS.md under "Restore drill log".
    console.log(`RESTORE DRILL OK ${today} ${archiveName} (${collections.length} collections, ${total} documents, ${summary.failed} failed)`);
  } catch (error) {
    failure = error;
    decrypt.child.kill();
    restore.child.kill();
  } finally {
    let cleanupFailed = false;
    if (restoreStarted && mongoose.connection.readyState !== 1) {
      try { await mongoose.connect(targetUri, { maxPoolSize: 2 }); }
      catch { cleanupFailed = true; }
    }
    if (mongoose.connection.readyState === 1) {
      try { await mongoose.connection.db.dropDatabase(); }
      catch { cleanupFailed = true; }
      finally { await mongoose.disconnect(); }
    }
    if (cleanupFailed) console.error(`[Error] Could not clean up the disposable restore database ${targetDatabase}; remove it manually from the local test MongoDB.`);
    if (failure || cleanupFailed) {
      console.error(`RESTORE DRILL FAILED ${today} ${archiveName}: ${failure ? failure.message : 'cleanup failed'}`);
      process.exitCode = 1;
    }
  }
  if (failure) throw new Error(`Restore verification failed: ${failure.message} Check that GPG, MongoDB Database Tools, the passphrase, and the archive are valid.`);
  console.log('Disposable restore database was removed after verification.');
}

main().catch((error) => { console.error(`[Error] ${error.message}`); process.exitCode = 1; });
