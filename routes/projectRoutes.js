const express = require('express');
const router = express.Router();

// ⭐ This import will crash with [object Undefined] if the Controller file is missing the module.exports
const { 
  getProjects, 
  getProjectById, 
  createProject, 
  updateProject, 
  deleteProject 
} = require('../controllers/projectController');

const { protect } = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/checkPermission');

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