const express = require('express');
const router = express.Router();
const { getTasks, createTask, updateTask, deleteTask } = require('../controllers/taskController');
const { protect } = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/checkPermission');

// Mapping routes to the specific permission strings from Step 1
router.route('/')
  .get(protect, checkPermission('tasks_read'), getTasks)
  .post(protect, checkPermission('tasks_create'), createTask);

router.route('/:id')
  .put(protect, checkPermission('tasks_update'), updateTask)
  .delete(protect, checkPermission('tasks_delete'), deleteTask);

module.exports = router;