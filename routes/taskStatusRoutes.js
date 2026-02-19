const express = require('express');
const router = express.Router();
const { 
  getTaskStatuses, 
  getTaskStatusById, 
  createTaskStatus, 
  updateTaskStatus, 
  deleteTaskStatus 
} = require('../controllers/taskStatusController');
const { protect } = require('../middleware/authMiddleware');

// Apply protection to all routes
router.use(protect);

router.route('/')
  .get(getTaskStatuses)
  .post(createTaskStatus);

router.route('/:id')
  .get(getTaskStatusById)
  .put(updateTaskStatus)
  .delete(deleteTaskStatus);

module.exports = router;