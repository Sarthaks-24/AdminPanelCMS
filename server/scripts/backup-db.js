require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Configure MONGODB_URI first.');
const dbName = decodeURIComponent(new URL(uri).pathname.replace(/^\//, '').split('/')[0]);
const backupDir = path.join(__dirname, '..', '..', 'backup');
fs.mkdirSync(backupDir, { recursive: true });
const archive = path.join(backupDir, `phase-0-1-${new Date().toISOString().replace(/[:.]/g, '-')}.archive.gz`);
const candidates = [
  'mongodump',
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'MongoDB', 'Tools', '100', 'bin', 'mongodump.exe'),
];
let result;
for (const executable of candidates) {
  result = spawnSync(executable, ['--uri', uri, '--db', dbName, `--archive=${archive}`, '--gzip'], { stdio: 'inherit', windowsHide: true });
  if (!result.error || result.error.code !== 'ENOENT') break;
}
if (result.error) throw new Error(`mongodump failed to start: ${result.error.message}`);
if (result.status !== 0) throw new Error(`mongodump exited with code ${result.status}`);
if (!fs.statSync(archive).size) throw new Error('mongodump created an empty archive.');
console.log(`Backup complete: ${archive} (${fs.statSync(archive).size} bytes)`);
