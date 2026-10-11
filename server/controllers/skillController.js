const mongoose = require('mongoose');
const Skill = require('../models/Skill');
const crud = require('../lib/scopedCrud')(Skill, 'skill', { sort: { order: 1, name: 1 }, queryFields: ['category'] });
const pickFields = require('../lib/pickFields');
const { WRITABLE_FIELDS, LEGACY_SKILL_CATEGORIES } = require('../lib/modelConstants');
const { scopedBulkWrite } = require('../plugins/ownerGuard');
const qString = require('../lib/qString');
const LIMITS = require('../config/limits');
const { withContentQuota } = require('../lib/contentQuota');
const contentChanged = require('../lib/onContentChanged');
const pullContentFromApps = require('../lib/pullContentFromApps');
const { MAX_BULK_ITEMS } = require('../lib/reorderOps');

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

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

// Owner's distinct categories, sorted. Falls back to the legacy suggestions for an owner with none (§2.6).
async function listOwnerCategories(owner) {
  const distinct = await Skill.distinct('category', { owner });
  const categories = distinct.filter((value) => typeof value === 'string' && value.trim()).sort((a, b) => a.localeCompare(b));
  return categories.length ? categories : [...LEGACY_SKILL_CATEGORIES];
}

async function getCategories(req, res, next) {
  try {
    return res.json({ success: true, categories: await listOwnerCategories(req.userId) });
  } catch (error) { return next(error); }
}

async function createSkill(req, res, next) {
  try {
    const body = req.body ?? {};
    const batch = Array.isArray(body) || Array.isArray(body.skills);
    const list = Array.isArray(body) ? body : Array.isArray(body.skills) ? body.skills : [body];
    if (!list.length || list.length > 50) return res.status(400).json({ success: false, error: 'batch_too_large' });
    if (!list.every(isRecord)) return res.status(400).json({ success: false, error: 'validation_failed', message: 'Each skill must be an object' });
    const result = await withContentQuota(Skill, req.userId, list.length, async () => {
      // B12: items without an explicit order are appended after the current maximum, in request order.
      const last = await Skill.findOne({ owner: req.userId }).sort({ order: -1 }).select('order').lean();
      let nextOrder = (last?.order ?? -1) + 1;
      const docs = list.map((item) => {
        const doc = { ...pickFields(item, WRITABLE_FIELDS.Skill), owner: req.userId };
        if (doc.order === undefined) doc.order = nextOrder++;
        return doc;
      });
      return Skill.insertMany(docs, { ordered: true });
    });
    if (!result.allowed) return res.status(403).json({ success: false, error: 'quota_exceeded', resource: 'skills', limit: LIMITS.itemsPerCollection });
    const created = result.value;
    await contentChanged.onContentChanged(req.userId);
    return res.status(201).json(batch ? created : created[0]);
  } catch (error) { return next(error); }
}

async function bulkUpdateSkills(req, res, next) {
  try {
    const body = req.body ?? {};
    let ops = [];
    const draftedIds = [];
    const tooLarge = [body.items, body.ids].some((value) => Array.isArray(value) && value.length > MAX_BULK_ITEMS);
    if (tooLarge) return res.status(400).json({ success: false, message: `At most ${MAX_BULK_ITEMS} items per request` });
    if (Array.isArray(body.items)) {
      ops = body.items.filter((item) => isRecord(item) && mongoose.isValidObjectId(item.id || item._id))
        .map((item) => ({ id: item.id || item._id, set: pickFields(item, WRITABLE_FIELDS.Skill) }))
        .filter(({ set }) => Object.keys(set).length > 0)
        .map(({ id, set }) => {
          if (set.visibility === 'draft') draftedIds.push(id);
          return { updateOne: { filter: { _id: id, owner: req.userId }, update: { $set: set } } };
        });
    } else if (Array.isArray(body.ids)) {
      const updates = pickFields(body.updates, WRITABLE_FIELDS.Skill);
      if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: 'No writable fields to update' });
      const ids = body.ids.filter(mongoose.isValidObjectId);
      if (updates.visibility === 'draft') draftedIds.push(...ids);
      ops = ids.map((id) => ({
        updateOne: { filter: { _id: id, owner: req.userId }, update: { $set: updates } },
      }));
    } else return res.status(400).json({ success: false, message: 'Please provide skill IDs or items' });
    if (!ops.length) return res.json({ success: true, matchedCount: 0 });
    const result = await scopedBulkWrite(Skill, req.userId, ops, { runValidators: true });
    if (result.matchedCount) {
      // B10: unpublishing in bulk prunes App selections exactly like a single unpublish does.
      if (draftedIds.length) await pullContentFromApps(req.userId, 'Skill', draftedIds);
      await contentChanged.onContentChanged(req.userId);
    }
    return res.json({ success: true, matchedCount: result.matchedCount });
  } catch (error) { return next(error); }
}

async function bulkDeleteSkills(req, res, next) {
  try {
    const body = req.body ?? {};
    if (Array.isArray(body.ids) && body.ids.length > MAX_BULK_ITEMS) return res.status(400).json({ success: false, message: `At most ${MAX_BULK_ITEMS} items per request` });
    const ids = (Array.isArray(body.ids) ? body.ids : []).filter(mongoose.isValidObjectId);
    if (!ids.length) return res.status(400).json({ success: false, message: 'Please provide skill IDs' });
    const result = await Skill.deleteMany({ _id: { $in: ids }, owner: req.userId });
    if (result.deletedCount) {
      await pullContentFromApps(req.userId, 'Skill', ids);
      await contentChanged.onContentChanged(req.userId);
    }
    return res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) { return next(error); }
}

module.exports = { getSkills, getCategories, listOwnerCategories, createSkill, updateSkill: crud.update, deleteSkill: crud.remove, bulkUpdateSkills, bulkDeleteSkills };
