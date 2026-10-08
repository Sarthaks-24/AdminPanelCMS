const { withContentQuota } = require('../lib/contentQuota');
const LIMITS = require('../config/limits');

describe('serialized content quotas', () => {
  it('prevents concurrent creates from exceeding the per-owner collection cap', async () => {
    const counts = new Map();
    const Project = {
      modelName: 'Project',
      countDocuments: async ({ owner }) => counts.get(String(owner)) || 0,
    };
    const createAttempts = Array.from({ length: LIMITS.itemsPerCollection + 20 }, (_, index) =>
      withContentQuota(Project, 'owner-a', 1, async () => {
        await new Promise((resolve) => setTimeout(resolve, index % 3));
        counts.set('owner-a', (counts.get('owner-a') || 0) + 1);
        return index;
      }));

    const results = await Promise.all(createAttempts);
    expect(results.filter((result) => result.allowed)).toHaveLength(LIMITS.itemsPerCollection);
    expect(results.filter((result) => !result.allowed)).toHaveLength(20);
    expect(counts.get('owner-a')).toBe(LIMITS.itemsPerCollection);
  });

  it('does not block a different owner or retain a lock after a failed create', async () => {
    const counts = new Map();
    const Skill = {
      modelName: 'Skill',
      countDocuments: async ({ owner }) => counts.get(String(owner)) || 0,
    };

    await expect(withContentQuota(Skill, 'owner-a', 1, async () => { throw new Error('write failed'); }))
      .rejects.toThrow('write failed');
    const retry = await withContentQuota(Skill, 'owner-a', 1, async () => 'retried');
    const otherOwner = await withContentQuota(Skill, 'owner-b', 1, async () => 'independent');

    expect(retry).toEqual({ allowed: true, value: 'retried' });
    expect(otherOwner).toEqual({ allowed: true, value: 'independent' });
  });
});
