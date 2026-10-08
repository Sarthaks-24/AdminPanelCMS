const mongoose = require('mongoose');
const Social = require('../models/Social');
const crud = require('../lib/scopedCrud')(Social, 'social', { queryFields: ['featured'] });
const { WRITABLE_FIELDS } = require('../lib/modelConstants');
const pickFields = require('../lib/pickFields');
const { scopedBulkWrite } = require('../plugins/ownerGuard');
const contentChanged = require('../lib/onContentChanged');

async function createSocial(req, res, next) {
  const payload = pickFields(req.body, WRITABLE_FIELDS.Social);
  if (payload.platform?.toLowerCase() === 'email' && payload.url && !/^(mailto:|https?:)/i.test(payload.url)) payload.url = `mailto:${payload.url.trim()}`;
  req.body = payload;
  return crud.create(req, res, next);
}

async function updateSocial(req, res, next) {
  const payload = pickFields(req.body, WRITABLE_FIELDS.Social);
  if (payload.platform?.toLowerCase() === 'email' && payload.url && !/^(mailto:|https?:)/i.test(payload.url)) payload.url = `mailto:${payload.url.trim()}`;
  req.body = payload;
  return crud.update(req, res, next);
}

async function reorderSocials(req, res, next) {
  try {
    if (!Array.isArray(req.body.items)) return res.status(400).json({ success: false, message: 'Items array required' });
    const ops = req.body.items.filter((item) => mongoose.isValidObjectId(item.id) && Number.isInteger(Number(item.order)))
      .map((item) => ({ updateOne: { filter: { _id: item.id, owner: req.userId }, update: { $set: { order: Number(item.order) } } } }));
    if (!ops.length) return res.json({ success: true, matchedCount: 0 });
    const result = await scopedBulkWrite(Social, req.userId, ops);
    if (result.matchedCount < ops.length) return res.status(404).json({ success: false, error: 'not_found' });
    await contentChanged.onContentChanged(req.userId);
    return res.json({ success: true, matchedCount: result.matchedCount });
  } catch (error) { return next(error); }
}

module.exports = { getSocials: crud.list, createSocial, updateSocial, deleteSocial: crud.remove, reorderSocials };
