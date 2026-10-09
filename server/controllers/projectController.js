const mongoose = require('mongoose');
const Project = require('../models/Project');
const crud = require('../lib/scopedCrud')(Project, 'project', { queryFields: ['mode'] });
const { scopedBulkWrite } = require('../plugins/ownerGuard');
const { buildReorderOps, applyReorder, MAX_BULK_ITEMS } = require('../lib/reorderOps');
const qString = require('../lib/qString');
const slugify = (text) => String(text).toLowerCase().trim().replace(/[\s\W-]+/g, '-');
const contentChanged = require('../lib/onContentChanged');

async function getProjects(req, res, next) {
  try {
    const owner = req.userId;
    const filter = { owner };
    const mode = qString(req, 'mode');
    if (mode && ['solo', 'team'].includes(mode)) filter.mode = mode;
    if (qString(req, 'featured') === 'true') filter.featured = true;
    const query = Project.find(filter).sort({ order: 1, createdAt: -1 });
    res.json(await query);
  } catch (error) { next(error); }
}

async function getProjectById(req, res, next) {
  try {
    const param = req.params.id;
    const owner = req.userId;
    const query = mongoose.isValidObjectId(param)
      ? { _id: param, owner }
      : { slug: String(param).slice(0, 120).toLowerCase(), owner };
    const projectQuery = Project.findOne(query);
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
    const ops = buildReorderOps(req.body.items, req.userId);
    if (!ops) return res.status(400).json({ success: false, message: `Items array required (max ${MAX_BULK_ITEMS})` });
    if (!ops.length) return res.json({ success: true, matchedCount: 0 });
    const result = await applyReorder(Project, req.userId, ops, scopedBulkWrite);
    if (!result.ok) return res.status(404).json({ success: false, error: 'not_found' });
    await contentChanged.onContentChanged(req.userId);
    return res.json({ success: true, matchedCount: result.matchedCount });
  } catch (error) { return next(error); }
}

module.exports = { getProjects, getProjectById, createProject, updateProject, deleteProject: crud.remove, reorderProjects };
