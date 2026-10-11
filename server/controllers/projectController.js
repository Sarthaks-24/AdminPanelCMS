const mongoose = require('mongoose');
const Project = require('../models/Project');
const crud = require('../lib/scopedCrud')(Project, 'project', { queryFields: ['mode'] });
const { scopedBulkWrite } = require('../plugins/ownerGuard');
const { buildReorderOps, applyReorder, MAX_BULK_ITEMS } = require('../lib/reorderOps');
const { SLUG_MAX_LENGTH } = require('../lib/modelConstants');
const qString = require('../lib/qString');
const contentChanged = require('../lib/onContentChanged');

// "Hello, World!" -> "hello-world"; "Hello!" -> "hello". Titles with no Latin letters or digits
// get a time-based fallback so creation still succeeds; the owner can set a slug explicitly.
function slugify(text) {
  const slug = String(text ?? '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH).replace(/-+$/g, '');
  return slug || `project-${Date.now().toString(36)}`;
}

// A `{owner, slug}` collision is answered with a 409 that names the slug (A11).
function slugConflictHandler(req, res, next) {
  return (error) => {
    if (error?.code === 11000 && (error.keyPattern?.slug || error.keyValue?.slug !== undefined)) {
      const slug = error.keyValue?.slug ?? req.body?.slug ?? '';
      return res.status(409).json({
        success: false, error: 'conflict', field: 'slug',
        message: `A project with the slug "${slug}" already exists. Choose a different slug.`,
      });
    }
    return next(error);
  };
}

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
    const body = { ...(req.body ?? {}) };
    // Slugs are generated only on create (A11); afterwards they change only when sent explicitly.
    if (!body.slug && body.title) body.slug = slugify(body.title);
    req.body = body;
    return crud.create(req, res, slugConflictHandler(req, res, next));
  } catch (error) { return next(error); }
}

async function updateProject(req, res, next) {
  const body = { ...(req.body ?? {}) };
  if (Object.hasOwn(body, 'slug') && !body.slug) {
    // An explicitly blank slug means "regenerate from the title"; without a title the stored slug is kept.
    if (body.title) body.slug = slugify(body.title);
    else delete body.slug;
  }
  body.lastUpdated = new Date();
  req.body = body;
  return crud.update(req, res, slugConflictHandler(req, res, next));
}

async function reorderProjects(req, res, next) {
  try {
    const ops = buildReorderOps(req.body?.items, req.userId);
    if (!ops) return res.status(400).json({ success: false, message: `Items array required (max ${MAX_BULK_ITEMS})` });
    if (!ops.length) return res.json({ success: true, matchedCount: 0 });
    const result = await applyReorder(Project, req.userId, ops, scopedBulkWrite);
    if (!result.ok) return res.status(404).json({ success: false, error: 'not_found' });
    await contentChanged.onContentChanged(req.userId);
    return res.json({ success: true, matchedCount: result.matchedCount });
  } catch (error) { return next(error); }
}

module.exports = { getProjects, getProjectById, createProject, updateProject, deleteProject: crud.remove, reorderProjects, slugify };
