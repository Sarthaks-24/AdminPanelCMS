require('dotenv').config();
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

function start(command, args, pipeInput = false) {
  const child = spawn(command, args, { stdio: [pipeInput ? 'pipe' : 'ignore', 'pipe', 'ignore'], windowsHide: true });
  const exit = new Promise((resolve) => {
    child.once('error', (error) => resolve({ error }));
    child.once('close', (code) => resolve({ code }));
  });
  return { child, exit };
}

async function main() {
  const archive = path.resolve(argument('--file') || '');
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
  ], true);
  let restoreStarted = true;
  try {
    await pipeline(decrypt.child.stdout, restore.child.stdin);
    const [decryptResult, restoreResult] = await Promise.all([decrypt.exit, restore.exit]);
    if (decryptResult.code !== 0 || restoreResult.code !== 0) throw new Error('Decrypt or restore command returned a failure status.');
    await mongoose.connect(targetUri, { maxPoolSize: 2 });
    const collections = await mongoose.connection.db.listCollections().toArray();
    if (!collections.length) throw new Error('The restore completed but created no collections.');
    console.log(`Restore verified in local disposable database ${targetDatabase}: ${collections.length} collection(s).`);
  } catch {
    decrypt.child.kill();
    restore.child.kill();
    throw new Error('Restore verification failed. Check that GPG, MongoDB Database Tools, the passphrase, and the archive are valid.');
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
    if (cleanupFailed) throw new Error(`Could not clean up the disposable restore database ${targetDatabase}; remove it manually from the local test MongoDB.`);
  }
  console.log('Disposable restore database was removed after verification.');
}

main().catch((error) => { console.error(`[Error] ${error.message}`); process.exitCode = 1; });
