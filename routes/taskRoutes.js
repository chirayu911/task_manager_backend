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
const upload = require('../middleware/uploadMiddleware'); // ⭐ Multer configuration

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
    // ⭐ Updated: Increased maxCount for both images and videos
    upload.fields([
      { name: 'images', maxCount: 10 }, 
      { name: 'video', maxCount: 5 }
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
    // ⭐ Updated: Consistent maxCount to allow adding more media during edit
    upload.fields([
      { name: 'images', maxCount: 10 }, 
      { name: 'video', maxCount: 5 },
    ]), 
    updateTask
  )
  .delete(
    protect, 
    checkPermission('tasks_delete'), 
    deleteTask
  );

module.exports = router;