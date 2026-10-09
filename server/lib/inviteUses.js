function capacityFilter() {
  return {
    $or: [
      // Legacy records had only usedBy and were single use.
      { maxUses: { $exists: false }, usedBy: null },
      { maxUses: { $exists: true }, $expr: { $lt: [{ $ifNull: ['$usedCount', 0] }, '$maxUses'] } },
    ],
  };
}

function usableInviteFilter(now = new Date()) {
  return { expiresAt: { $gt: now }, ...capacityFilter() };
}

function inviteUsage(invite) {
  const maxUses = invite.maxUses ?? 1;
  const usedCount = invite.usedCount ?? (invite.usedBy ? 1 : 0);
  return { usedCount, maxUses, remainingUses: Math.max(0, maxUses - usedCount) };
}

module.exports = { capacityFilter, usableInviteFilter, inviteUsage };
