const assertNoLegacyGlobalIndexes = require('../lib/legacyIndexPreflight');

describe('legacy index setup preflight', () => {
  it('blocks normal setup when a global slug index remains', async () => {
    const db = { command: vi.fn().mockResolvedValue({ cursor: { firstBatch: [{ name: '_id_' }, { name: 'slug_1' }] } }) };
    await expect(assertNoLegacyGlobalIndexes(db)).rejects.toThrow(/projects\.slug_1/);
  });

  it('blocks normal setup when a global skill name index remains', async () => {
    const db = { command: vi.fn()
      .mockResolvedValueOnce({ cursor: { firstBatch: [{ name: '_id_' }] } })
      .mockResolvedValueOnce({ cursor: { firstBatch: [{ name: '_id_' }, { name: 'name_1' }] } }) };
    await expect(assertNoLegacyGlobalIndexes(db)).rejects.toThrow(/skills\.name_1/);
  });

  it('permits setup when old global indexes are absent', async () => {
    const db = { command: vi.fn().mockResolvedValue({ cursor: { firstBatch: [{ name: '_id_' }, { name: 'owner_1_slug_1' }] } }) };
    await expect(assertNoLegacyGlobalIndexes(db)).resolves.toBeUndefined();
    expect(db.command).toHaveBeenCalledTimes(2);
  });
});
