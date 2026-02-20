const express = require('express');
const router = express.Router();
// Controller imports
const { 
  getTasks, 
  getTaskById, 
  createTask, 
  updateTask, 
  deleteTask 
} = require('../controllers/taskController');

// Middleware imports
const { protect } = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/checkPermission');
const upload = require('../middleware/uploadMiddleware');

/**
 * @route   /api/tasks
 * @desc    Get all tasks or Create a new task with multiple files
 */
router.route('/')
  .get(
    protect, 
    checkPermission('tasks_read'), 
    getTasks
  )
  .post(
    protect, 
    checkPermission('tasks_create'), 
    // ⭐ Updated: Key changed to 'videos' to match frontend and Model
    upload.fields([
      { name: 'images', maxCount: 10 }, 
      { name: 'videos', maxCount: 5 } // Changed from 'video' to 'videos'
    ]), 
    createTask
  );

/**
 * @route   /api/tasks/:id
 * @desc    Get, Update, or Delete a specific task
 */
router.route('/:id')
  .get(
    protect, 
    checkPermission('tasks_read'), 
    getTaskById
  )
  .put(
    protect, 
    checkPermission('tasks_update'), 
    // ⭐ Updated: Key changed to 'videos' and added description logic
    upload.fields([
      { name: 'images', maxCount: 10 }, 
      { name: 'videos', maxCount: 5 }, // Changed from 'video' to 'videos'
    ]), 
    updateTask
  )
  .delete(
    protect, 
    checkPermission('tasks_delete'), 
    deleteTask
  );

module.exports = router;