const mongoose = require('mongoose');
const pickFields = require('./pickFields');
const flattenPaths = require('./flattenPaths');
const qString = require('./qString');
const LIMITS = require('../config/limits');
const { withContentQuota } = require('./contentQuota');
const contentChanged = require('./onContentChanged');
const pullContentFromApps = require('./pullContentFromApps');

function scopedCrud(Model, fieldName, { sort = { order: 1, createdAt: -1 }, queryFields = [] } = {}) {
  return {
    list: async (req, res, next) => {
      try {
        const ownerId = req.userId;
        const filter = { owner: ownerId };
        for (const field of queryFields) {
          const value = qString(req, field);
          if (value !== undefined) filter[field] = field === 'featured' && ['true', 'false'].includes(value) ? value === 'true' : value;
        }
        const query = Model.find(filter).sort(sort);
        return res.json(await query);
      } catch (error) { return next(error); }
    },
    get: async (req, res, next) => {
      try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, error: 'not_found' });
        const ownerId = req.userId;
        const filter = { _id: req.params.id, owner: ownerId };
        const query = Model.findOne(filter);
        const item = await query;
        return item ? res.json(item) : res.status(404).json({ success: false, error: 'not_found' });
      } catch (error) { return next(error); }
    },
    create: async (req, res, next) => {
      try {
        const ownerId = req.userId;
        const result = await withContentQuota(Model, ownerId, 1, async () => {
          const last = await Model.findOne({ owner: ownerId }).sort({ order: -1 }).select('order').lean();
          const data = { ...pickFields(req.body, require('./modelConstants').WRITABLE_FIELDS[Model.modelName]), owner: ownerId };
          if (data.order === undefined) data.order = (last?.order ?? -1) + 1;
          return Model.create(data);
        });
        if (!result.allowed) return res.status(403).json({ success: false, error: 'quota_exceeded', resource: Model.modelName.toLowerCase(), limit: LIMITS.itemsPerCollection });
        const item = result.value;
        await contentChanged.onContentChanged(ownerId);
        return res.status(201).json(item);
      } catch (error) { return next(error); }
    },
    update: async (req, res, next) => {
      try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, error: 'not_found' });
        const data = pickFields(req.body, require('./modelConstants').WRITABLE_FIELDS[Model.modelName]);
        const item = await Model.findOneAndUpdate({ _id: req.params.id, owner: req.userId }, { $set: flattenPaths(data) }, { returnDocument: 'after', runValidators: true });
        if (item) {
          // Editing content must not silently drop it from apps' "selected" lists; only unpublishing does.
          if (item.visibility && item.visibility !== 'published' && ['Social', 'Skill', 'Project', 'Experience', 'Education', 'Certification'].includes(Model.modelName)) {
            await pullContentFromApps(req.userId, Model.modelName, item._id);
          }
          await contentChanged.onContentChanged(req.userId);
        }
        return item ? res.json(item) : res.status(404).json({ success: false, error: 'not_found' });
      } catch (error) { return next(error); }
    },
    remove: async (req, res, next) => {
      try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, error: 'not_found' });
        const item = await Model.findOneAndDelete({ _id: req.params.id, owner: req.userId });
        if (item) await contentChanged.onContentChanged(req.userId);
        return item ? res.json({ success: true }) : res.status(404).json({ success: false, error: 'not_found' });
      } catch (error) { return next(error); }
    },
  };
}

module.exports = scopedCrud;
