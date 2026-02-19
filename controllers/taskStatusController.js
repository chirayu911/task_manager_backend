const TaskStatus = require('../models/TaskStatus');
const asyncHandler = require('express-async-handler');

// @desc    Get all task statuses
// @route   GET /api/task-statuses
const getTaskStatuses = asyncHandler(async (req, res) => {
  const statuses = await TaskStatus.find().sort({ createdAt: -1 });
  res.json(statuses);
});

// @desc    Get a single task status by ID
// @route   GET /api/task-statuses/:id
const getTaskStatusById = asyncHandler(async (req, res) => {
  const status = await TaskStatus.findById(req.params.id);

  if (!status) {
    res.status(404);
    throw new Error('Task Status not found');
  }

  res.json(status);
});

// @desc    Create a new task status
// @route   POST /api/task-statuses
const createTaskStatus = asyncHandler(async (req, res) => {
  const { name, status } = req.body;

  if (!name) {
    res.status(400);
    throw new Error('Status name is required');
  }

  // Check if status name already exists
  const statusExists = await TaskStatus.findOne({ name: name.trim() });
  if (statusExists) {
    res.status(400);
    throw new Error('Status name already exists');
  }

  const newTaskStatus = await TaskStatus.create({
    name: name.trim(),
    status: status || 'active'
  });

  res.status(201).json(newTaskStatus);
});

// @desc    Update an existing task status
// @route   PUT /api/task-statuses/:id
const updateTaskStatus = asyncHandler(async (req, res) => {
  const taskStatus = await TaskStatus.findById(req.params.id);

  if (!taskStatus) {
    res.status(404);
    throw new Error('Task Status not found');
  }

  // Update fields
  taskStatus.name = req.body.name || taskStatus.name;
  taskStatus.status = req.body.status || taskStatus.status;

  const updatedStatus = await taskStatus.save();
  res.json(updatedStatus);
});

// @desc    Delete a task status
// @route   DELETE /api/task-statuses/:id
const deleteTaskStatus = asyncHandler(async (req, res) => {
  const taskStatus = await TaskStatus.findById(req.params.id);

  if (!taskStatus) {
    res.status(404);
    throw new Error('Task Status not found');
  }

  await taskStatus.deleteOne();
  res.json({ message: 'Status removed' });
});

module.exports = {
  getTaskStatuses,
  getTaskStatusById,
  createTaskStatus,
  updateTaskStatus,
  deleteTaskStatus
};