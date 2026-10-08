const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

describe('owner query lint', () => {
  it('fails when a raw collection access is planted in application code', () => {
    const serverRoot = path.join(__dirname, '..');
    const fixture = path.join(serverRoot, 'lib', 'owner-query-lint-fixture.js');
    fs.writeFileSync(fixture, "module.exports = Model.collection('projects');\n");
    try {
      const result = spawnSync(process.execPath, ['scripts/check-owner-queries.js'], {
        cwd: serverRoot,
        encoding: 'utf8',
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/raw collection access bypasses ownerGuard/);
    } finally {
      fs.rmSync(fixture, { force: true });
    }
  });
});
