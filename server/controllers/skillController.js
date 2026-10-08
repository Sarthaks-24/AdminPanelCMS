const mongoose = require('mongoose');
const Skill = require('../models/Skill');
const crud = require('../lib/scopedCrud')(Skill, 'skill', { sort: { order: 1, name: 1 }, queryFields: ['category'] });
const pickFields = require('../lib/pickFields');
const { WRITABLE_FIELDS } = require('../lib/modelConstants');
const { scopedBulkWrite } = require('../plugins/ownerGuard');
const ownerForRequest = require('../lib/ownerForRequest');
const qString = require('../lib/qString');
const { LIMITS } = require('../lib/modelConstants');
const contentChanged = require('../lib/onContentChanged');

async function getSkills(req, res, next) {
  try {
    const owner = await ownerForRequest(req);
    if (!owner) return res.json({ skills: [], byCategory: {}, total: 0 });
    const filter = { owner };
    if (!req.userId) filter.visibility = 'published';
    const category = qString(req, 'category');
    if (category !== undefined) filter.category = category;
    if (qString(req, 'featured') === 'true') filter.featured = true;
    const query = Skill.find(filter).sort({ order: 1, name: 1 });
    if (!req.userId) query.select('-owner -visibility');
    const skills = await query;
    const byCategory = {};
    for (const skill of skills) (byCategory[skill.category] ||= []).push(skill);
    return res.json({ skills, byCategory, total: skills.length });
  } catch (error) { return next(error); }
}

async function createSkill(req, res, next) {
  try {
    const list = Array.isArray(req.body) ? req.body : Array.isArray(req.body.skills) ? req.body.skills : [req.body];
    if (!list.length || list.length > 50) return res.status(400).json({ success: false, error: 'batch_too_large' });
    const count = await Skill.countDocuments({ owner: req.userId });
    if (count + list.length > LIMITS.itemsPerCollection) return res.status(403).json({ success: false, error: 'quota_exceeded', resource: 'skills', limit: LIMITS.itemsPerCollection });
    const docs = list.map((item) => ({ ...pickFields(item, WRITABLE_FIELDS.Skill), owner: req.userId }));
    const created = await Skill.insertMany(docs, { ordered: true });
    await contentChanged.onContentChanged(req.userId);
    return res.status(201).json(Array.isArray(req.body) || Array.isArray(req.body.skills) ? created : created[0]);
  } catch (error) { return next(error); }
}

async function bulkUpdateSkills(req, res, next) {
  try {
    let ops = [];
    if (Array.isArray(req.body.items)) {
      ops = req.body.items.filter((item) => mongoose.isValidObjectId(item.id || item._id)).map((item) => ({
        updateOne: { filter: { _id: item.id || item._id, owner: req.userId }, update: { $set: pickFields(item, WRITABLE_FIELDS.Skill) } },
      }));
    } else if (Array.isArray(req.body.ids)) {
      const updates = pickFields(req.body.updates, WRITABLE_FIELDS.Skill);
      ops = req.body.ids.filter(mongoose.isValidObjectId).map((id) => ({
        updateOne: { filter: { _id: id, owner: req.userId }, update: { $set: updates } },
      }));
    } else return res.status(400).json({ success: false, message: 'Please provide skill IDs or items' });
    if (!ops.length) return res.json({ success: true, matchedCount: 0 });
    const result = await scopedBulkWrite(Skill, req.userId, ops, { runValidators: true });
    if (result.matchedCount) await contentChanged.onContentChanged(req.userId);
    return res.json({ success: true, matchedCount: result.matchedCount });
  } catch (error) { return next(error); }
}

async function bulkDeleteSkills(req, res, next) {
  try {
    const ids = (req.body.ids || []).filter(mongoose.isValidObjectId);
    if (!ids.length) return res.status(400).json({ success: false, message: 'Please provide skill IDs' });
    const result = await Skill.deleteMany({ _id: { $in: ids }, owner: req.userId });
    if (result.deletedCount) await contentChanged.onContentChanged(req.userId);
    return res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) { return next(error); }
}

module.exports = { getSkills, createSkill, updateSkill: crud.update, deleteSkill: crud.remove, bulkUpdateSkills, bulkDeleteSkills };
