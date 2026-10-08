const express = require('express');
const router = express.Router();
const {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  reorderProjects,
} = require('../controllers/projectController');
const requireVerifiedSession = require('../middleware/requireVerifiedSession');
const pickWritable = require('../middleware/pickWritable');
const validateId = require('../middleware/validateId');
const { WRITABLE_FIELDS } = require('../lib/modelConstants');
const requireSession = require('../middleware/requireSession');

// Dashboard reads; external consumers use the scoped /v1 API.
router.get('/', requireSession, getProjects);
router.get('/:id', requireSession, getProjectById);

// Protected routes (Admin only)
router.post('/', requireVerifiedSession, pickWritable(WRITABLE_FIELDS.Project), createProject);
router.patch('/reorder', requireVerifiedSession, reorderProjects);
router.put('/:id', requireVerifiedSession, validateId(), pickWritable(WRITABLE_FIELDS.Project), updateProject);
router.delete('/:id', requireVerifiedSession, validateId(), deleteProject);

module.exports = router;
