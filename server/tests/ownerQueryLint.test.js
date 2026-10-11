const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { lintSource } = require('../scripts/check-owner-queries');

const serverRoot = path.join(__dirname, '..');
const lint = (source) => lintSource(source, 'fixture.js');

describe('owner query lint', () => {
  it.each([
    ["module.exports = Model.collection.find({});", /raw collection access/],
    ["const db = mongoose.connection.db;", /native database access/],
    ["await mongoose.connection.getClient().db('x').command({ ping: 1 });", /native client access/],
    ["await Project.bulkWrite([]);", /use scopedBulkWrite/],
    ["await Project.findByIdAndUpdate(id, {});", /explicit owner filter/],
    ["const c = Model['collection'];", /bracket access/],
    ["const run = Model[\"bulkWrite\"];", /bracket access/],
  ])('flags %s', (source, message) => {
    const violations = lint(source);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/^fixture\.js:1: /);
    expect(violations[0]).toMatch(message);
  });

  it('accepts an exemption on the same line or in the comment block directly above, with a reason', () => {
    expect(lint('const db = mongoose.connection.db; // ownerGuard-exemption: read-only inventory command')).toEqual([]);
    expect(lint([
      '// ownerGuard-exemption: read-only inventory command',
      '// continues the explanation on a second line',
      'const db = mongoose.connection.db;',
    ].join('\n'))).toEqual([]);
  });

  it('does not let an exemption reach past code, cover a later line, or stand without a reason', () => {
    expect(lint([
      '// ownerGuard-exemption: read-only inventory command',
      'const unrelated = 1;',
      'const db = mongoose.connection.db;',
    ].join('\n'))).toEqual(['fixture.js:3: native database access bypasses ownerGuard']);
    expect(lint([
      '// ownerGuard-exemption: read-only inventory command',
      'const db = mongoose.connection.db;',
      'const again = mongoose.connection.db;',
    ].join('\n'))).toEqual(['fixture.js:3: native database access bypasses ownerGuard']);
    expect(lint('const db = mongoose.connection.db; // ownerGuard-exemption: ok')).toHaveLength(1);
  });

  it('honours begin/end regions and reports an unterminated one', () => {
    const region = [
      '// ownerGuard-exemption-begin: disposable restore database only',
      'await mongoose.connection.db.dropDatabase();',
      'await Model.collection.drop();',
      '// ownerGuard-exemption-end',
      'await Model.collection.drop();',
    ].join('\n');
    expect(lint(region)).toEqual(['fixture.js:5: raw collection access bypasses ownerGuard']);
    expect(lint('// ownerGuard-exemption-begin: disposable restore database only\nconst x = 1;')).toEqual([
      'fixture.js: ownerGuard-exemption-begin without a matching ownerGuard-exemption-end',
    ]);
  });

  it('ignores comment-only lines that mention a guarded API', () => {
    expect(lint('// never call Model.collection or mongoose.connection.db here')).toEqual([]);
  });

  it('exits 1 for a planted violation under --root and passes on the real tree', () => {
    const fixtureRoot = fs.mkdtempSync(path.join(serverRoot, 'node_modules', '.cache', 'owner-lint-'));
    try {
      fs.mkdirSync(path.join(fixtureRoot, 'models'));
      fs.writeFileSync(path.join(fixtureRoot, 'models', 'Planted.js'), "module.exports = Model.collection('projects');\n");
      const planted = spawnSync(process.execPath, ['scripts/check-owner-queries.js', '--root', fixtureRoot], { cwd: serverRoot, encoding: 'utf8' });
      expect(planted.status).toBe(1);
      expect(planted.stderr).toMatch(/Planted\.js:1: raw collection access bypasses ownerGuard/);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
    const real = spawnSync(process.execPath, ['scripts/check-owner-queries.js'], { cwd: serverRoot, encoding: 'utf8' });
    expect(real.stderr).toBe('');
    expect(real.status).toBe(0);
  });
});
