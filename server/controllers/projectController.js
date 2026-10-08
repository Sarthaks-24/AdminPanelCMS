const mongoose = require('mongoose');
const Project = require('../models/Project');
const crud = require('../lib/scopedCrud')(Project, 'project', { queryFields: ['mode'] });
const { scopedBulkWrite } = require('../plugins/ownerGuard');
const ownerForRequest = require('../lib/ownerForRequest');
const qString = require('../lib/qString');
const slugify = (text) => String(text).toLowerCase().trim().replace(/[\s\W-]+/g, '-');
const contentChanged = require('../lib/onContentChanged');

async function getProjects(req, res, next) {
  try {
    const owner = await ownerForRequest(req);
    if (!owner) return res.json([]);
    const filter = { owner };
    if (!req.userId) filter.visibility = 'published';
    const mode = qString(req, 'mode');
    if (mode && ['solo', 'team'].includes(mode)) filter.mode = mode;
    if (qString(req, 'featured') === 'true') filter.featured = true;
    const query = Project.find(filter).sort({ order: 1, createdAt: -1 });
    if (!req.userId) query.select('-owner -visibility');
    res.json(await query);
  } catch (error) { next(error); }
}

async function getProjectById(req, res, next) {
  try {
    const param = req.params.id;
    const owner = await ownerForRequest(req);
    if (!owner) return res.status(404).json({ success: false, error: 'not_found' });
    const query = mongoose.isValidObjectId(param)
      ? { _id: param, owner }
      : { slug: String(param).slice(0, 120).toLowerCase(), owner };
    if (!req.userId) query.visibility = 'published';
    const projectQuery = Project.findOne(query);
    if (!req.userId) projectQuery.select('-owner -visibility');
    const project = await projectQuery;
    return project ? res.json(project) : res.status(404).json({ success: false, error: 'not_found' });
  } catch (error) { return next(error); }
}

async function createProject(req, res, next) {
  try {
    const body = { ...req.body };
    if (!body.slug && body.title) body.slug = slugify(body.title);
    req.body = body;
    return crud.create(req, res, next);
  } catch (error) { return next(error); }
}

async function updateProject(req, res, next) {
  if (!req.body.slug && req.body.title) req.body.slug = slugify(req.body.title);
  req.body.lastUpdated = new Date();
  return crud.update(req, res, next);
}

async function reorderProjects(req, res, next) {
  try {
    if (!Array.isArray(req.body.items)) return res.status(400).json({ success: false, message: 'Items array required' });
    const ops = req.body.items.filter((item) => mongoose.isValidObjectId(item.id) && Number.isInteger(Number(item.order)))
      .map((item) => ({ updateOne: { filter: { _id: item.id, owner: req.userId }, update: { $set: { order: Number(item.order) } } } }));
    if (!ops.length) return res.json({ success: true, matchedCount: 0 });
    const result = await scopedBulkWrite(Project, req.userId, ops);
    if (result.matchedCount < ops.length) return res.status(404).json({ success: false, error: 'not_found' });
    await contentChanged.onContentChanged(req.userId);
    return res.json({ success: true, matchedCount: result.matchedCount });
  } catch (error) { return next(error); }
}

module.exports = { getProjects, getProjectById, createProject, updateProject, deleteProject: crud.remove, reorderProjects };
