async function assertNoLegacyGlobalIndexes(db) {
  for (const [collection, legacyIndex] of [['projects', 'slug_1'], ['skills', 'name_1']]) {
    try {
      const result = await db.command({ listIndexes: collection, cursor: { batchSize: 100 } });
      if ((result.cursor.firstBatch || []).some((index) => index.name === legacyIndex)) {
        throw new Error(`Legacy global index ${collection}.${legacyIndex} exists. Run the reviewed legacy tenancy migration before normal setup.`);
      }
    } catch (error) {
      if (error.message.startsWith('Legacy global index')) throw error;
      if (error.codeName !== 'NamespaceNotFound' && error.code !== 26) throw error;
    }
  }
}

module.exports = assertNoLegacyGlobalIndexes;
