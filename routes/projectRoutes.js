const express = require('express');
const router = express.Router();

// ⭐ Imports from your project controller
const { 
  getProjects, 
  getProjectById, 
  createProject, 
  updateProject, 
  deleteProject,
  getProjectTeam // ⭐ This handles fetching the users for your search bar
} = require('../controllers/projectController');

const { protect } = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/checkPermission');

// ==========================================
// 1. Collection Routes
// ==========================================
router.route('/')
  .get(
    protect, 
    checkPermission('projects_read'), 
    getProjects
  )
  .post(
    protect, 
    checkPermission('projects_create'), 
    createProject
  );
router.route('/').get(protect, getProjects).post(protect, createProject);

// ==========================================
// 2. Specialized Project Routes
// ==========================================
// ⭐ This must be protected so only logged-in users can see team members
// The frontend uses this to populate the "bubble" search and access table
router.get('/:id/users', protect, getProjectTeam); 
router.get('/:id/team', protect, getProjectTeam); // Added /team alias for compatibility

// ==========================================
// 3. ID-Specific Routes
// ==========================================
router.route('/:id')
  .get(
    protect, 
    checkPermission('projects_read'), 
    getProjectById
  )
  .put(
    protect, 
    checkPermission('projects_update'), 
    updateProject
  )
  .delete(
    protect, 
    checkPermission('projects_delete'), 
    deleteProject
  );

module.exports = router;