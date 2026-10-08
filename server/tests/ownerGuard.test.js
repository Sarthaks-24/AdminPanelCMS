const mongoose = require('mongoose');
const fs = require('node:fs');
const path = require('node:path');
const modelDirectory = path.join(__dirname, '..', 'models');
const contentModels = fs.readdirSync(modelDirectory)
  .filter((file) => file.endsWith('.js') && file !== 'User.js')
  .map((file) => require(path.join(modelDirectory, file)))
  .map((Model) => [Model.modelName, Model]);
const Project = require('../models/Project');
const Skill = require('../models/Skill');
const { scopedBulkWrite } = require('../plugins/ownerGuard');

describe('ownerGuard', () => {
  // Every model file except the identity-only User model is tenant content and must install ownerGuard.
  it.each(contentModels)('is registered on %s', async (_name, Model) => {
    await expect(Model.find({})).rejects.toThrow(/INVARIANT/);
  });

  it('rejects queries without a concrete owner and operator-based owner filters', async () => {
    await expect(Project.find({})).rejects.toThrow(/INVARIANT/);
    await expect(Project.find({ owner: { $exists: true } })).rejects.toThrow(/INVARIANT/);
    await expect(Project.findById(new mongoose.Types.ObjectId())).rejects.toThrow(/INVARIANT/);
    await expect(Project.distinct('slug')).rejects.toThrow(/INVARIANT/);
    await expect(Project.aggregate([{ $group: { _id: null } }])).rejects.toThrow(/INVARIANT/);
    await expect(Project.estimatedDocumentCount()).rejects.toThrow(/INVARIANT/);
  });

  it('rejects bulk operations without the matching owner or that mutate ownership', async () => {
    const owner = new mongoose.Types.ObjectId();
    await expect(scopedBulkWrite(Project, owner, [
      { updateOne: { filter: { _id: new mongoose.Types.ObjectId() }, update: { $set: { title: 'x' } } } },
    ])).rejects.toThrow(/INVARIANT/);
    await expect(scopedBulkWrite(Project, owner, [
      { updateOne: { filter: { owner, _id: new mongoose.Types.ObjectId() }, update: { $set: { owner: new mongoose.Types.ObjectId() } } } },
    ])).rejects.toThrow(/INVARIANT/);
  });

  it('rejects insertMany when even one document has no valid owner', async () => {
    await expect(Project.insertMany([{
      title: 'Unowned', slug: 'unowned', mode: 'solo', role: 'Lead', shortDescription: 'test', caseStudyBody: 'test',
    }])).rejects.toThrow(/insertMany requires owner/);
    const owner = new mongoose.Types.ObjectId();
    const inserted = await Project.insertMany([{
      owner, title: 'Owned', slug: 'owned-by-insert-many', mode: 'solo', role: 'Lead', shortDescription: 'test', caseStudyBody: 'test',
    }]);
    expect(inserted).toHaveLength(1);
    expect(String(inserted[0].owner)).toBe(String(owner));
  });

  it('uses tenant-scoped unique indexes and immutable owner fields', async () => {
    await Project.init();
    await Skill.init();
    const projectIndexes = await Project.collection.indexes();
    const skillIndexes = await Skill.collection.indexes();
    expect(projectIndexes.some((index) => index.name === 'slug_1')).toBe(false);
    expect(projectIndexes.some((index) => index.key.owner === 1 && index.key.slug === 1 && index.unique)).toBe(true);
    expect(skillIndexes.some((index) => index.name === 'name_1')).toBe(false);
    expect(skillIndexes.some((index) => index.key.owner === 1 && index.key.name === 1 && index.unique)).toBe(true);
    const skillNameIndex = skillIndexes.find((index) => index.key.owner === 1 && index.key.name === 1 && index.unique);
    expect(skillNameIndex.collation).toMatchObject({ locale: 'en', strength: 2 });
    expect(Project.schema.path('owner').options.immutable).toBe(true);
    expect(Skill.schema.path('owner').options.immutable).toBe(true);
  });

  it('requires immutable ownership and validates App origin count', async () => {
    const App = require('../models/App');
    expect(App.schema.path('owner').options.required).toBe(true);
    expect(App.schema.path('owner').options.immutable).toBe(true);
    const owner = new mongoose.Types.ObjectId();
    const app = new App({ owner, name: 'Portfolio', type: 'static', allowedOrigins: Array(11).fill('https://site.test') });
    await expect(app.validate()).rejects.toThrow(/Max 10 origins/);
  });
});
