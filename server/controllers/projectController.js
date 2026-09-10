const mongoose = require('mongoose');
const Project = require('../models/Project');

const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-');

// @desc    Get all projects (with optional ?mode= filter: 'solo' or 'team')
// @route   GET /api/projects
// @access  Public
const getProjects = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.mode) {
      filter.mode = req.query.mode.toLowerCase();
    }
    if (req.query.featured === 'true') {
      filter.featured = true;
    }
    const projects = await Project.find(filter).sort({ order: 1, createdAt: -1 });
    res.json(projects);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single project by ID or Slug
// @route   GET /api/projects/:idOrSlug
// @access  Public
const getProjectById = async (req, res, next) => {
  try {
    const param = req.params.id;
    let project = null;

    if (mongoose.Types.ObjectId.isValid(param)) {
      project = await Project.findById(param);
    }
    if (!project) {
      project = await Project.findOne({ slug: param.toLowerCase() });
    }

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    next(error);
  }
};

// @desc    Create new project
// @route   POST /api/projects
// @access  Protected (Admin)
const createProject = async (req, res, next) => {
  try {
    if (!req.body.slug && req.body.title) {
      req.body.slug = slugify(req.body.title);
    }
    const project = await Project.create(req.body);
    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
};

// @desc    Update project by ID
// @route   PUT /api/projects/:id
// @access  Protected (Admin)
const updateProject = async (req, res, next) => {
  try {
    req.body.lastUpdated = new Date();
    if (!req.body.slug && req.body.title) {
      req.body.slug = slugify(req.body.title);
    }
    const updated = await Project.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete project by ID
// @route   DELETE /api/projects/:id
// @access  Protected (Admin)
const deleteProject = async (req, res, next) => {
  try {
    const deleted = await Project.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    res.json({ success: true, message: 'Project removed successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk reorder projects
// @route   PATCH /api/projects/reorder
// @access  Protected (Admin)
const reorderProjects = async (req, res, next) => {
  try {
    const { items } = req.body; // Array of { id, order }
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Items array required' });
    }
    const updatePromises = items.map((item) =>
      Project.findByIdAndUpdate(item.id, { order: item.order })
    );
    await Promise.all(updatePromises);
    const updatedList = await Project.find().sort({ order: 1 });
    res.json(updatedList);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  reorderProjects,
};
