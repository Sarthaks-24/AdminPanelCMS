const mongoose = require('mongoose');
const Skill = require('../models/Skill');
const crud = require('../lib/scopedCrud')(Skill, 'skill', { sort: { order: 1, name: 1 }, queryFields: ['category'] });
const pickFields = require('../lib/pickFields');
const { WRITABLE_FIELDS } = require('../lib/modelConstants');
const { scopedBulkWrite } = require('../plugins/ownerGuard');
const qString = require('../lib/qString');
const LIMITS = require('../config/limits');
const { withContentQuota } = require('../lib/contentQuota');
const contentChanged = require('../lib/onContentChanged');
const pullContentFromApps = require('../lib/pullContentFromApps');
const { MAX_BULK_ITEMS } = require('../lib/reorderOps');

async function getSkills(req, res, next) {
  try {
    const owner = req.userId;
    const filter = { owner };
    const category = qString(req, 'category');
    if (category !== undefined) filter.category = category;
    if (qString(req, 'featured') === 'true') filter.featured = true;
    const query = Skill.find(filter).sort({ order: 1, name: 1 });
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
    const result = await withContentQuota(Skill, req.userId, list.length, async () => {
      const docs = list.map((item) => ({ ...pickFields(item, WRITABLE_FIELDS.Skill), owner: req.userId }));
      return Skill.insertMany(docs, { ordered: true });
    });
    if (!result.allowed) return res.status(403).json({ success: false, error: 'quota_exceeded', resource: 'skills', limit: LIMITS.itemsPerCollection });
    const created = result.value;
    await contentChanged.onContentChanged(req.userId);
    return res.status(201).json(Array.isArray(req.body) || Array.isArray(req.body.skills) ? created : created[0]);
  } catch (error) { return next(error); }
}

async function bulkUpdateSkills(req, res, next) {
  try {
    let ops = [];
    const tooLarge = [req.body.items, req.body.ids].some((value) => Array.isArray(value) && value.length > MAX_BULK_ITEMS);
    if (tooLarge) return res.status(400).json({ success: false, message: `At most ${MAX_BULK_ITEMS} items per request` });
    if (Array.isArray(req.body.items)) {
      ops = req.body.items.filter((item) => item && typeof item === 'object' && mongoose.isValidObjectId(item.id || item._id))
        .map((item) => ({ id: item.id || item._id, set: pickFields(item, WRITABLE_FIELDS.Skill) }))
        .filter(({ set }) => Object.keys(set).length > 0)
        .map(({ id, set }) => ({ updateOne: { filter: { _id: id, owner: req.userId }, update: { $set: set } } }));
    } else if (Array.isArray(req.body.ids)) {
      const updates = pickFields(req.body.updates, WRITABLE_FIELDS.Skill);
      if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: 'No writable fields to update' });
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
    if (Array.isArray(req.body.ids) && req.body.ids.length > MAX_BULK_ITEMS) return res.status(400).json({ success: false, message: `At most ${MAX_BULK_ITEMS} items per request` });
    const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).filter(mongoose.isValidObjectId);
    if (!ids.length) return res.status(400).json({ success: false, message: 'Please provide skill IDs' });
    const result = await Skill.deleteMany({ _id: { $in: ids }, owner: req.userId });
    if (result.deletedCount) {
      await pullContentFromApps(req.userId, 'Skill', ids);
      await contentChanged.onContentChanged(req.userId);
    }
    return res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) { return next(error); }
}

module.exports = { getSkills, createSkill, updateSkill: crud.update, deleteSkill: crud.remove, bulkUpdateSkills, bulkDeleteSkills };
