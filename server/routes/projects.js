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
const requireAdmin = require('../middleware/requireAdmin');

// Public routes
router.get('/', getProjects);
router.get('/:id', getProjectById);

// Protected routes (Admin only)
router.post('/', requireAdmin, createProject);
router.patch('/reorder', requireAdmin, reorderProjects);
router.put('/:id', requireAdmin, updateProject);
router.delete('/:id', requireAdmin, deleteProject);

module.exports = router;
