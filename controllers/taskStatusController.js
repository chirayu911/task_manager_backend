const asyncHandler = require('express-async-handler');
const TaskStatus = require('../models/TaskStatus');

// @desc    Get all task statuses (Filtered by project)
// @route   GET /api/task-statuses?project=xyz
// @access  Private
const getTaskStatuses = asyncHandler(async (req, res) => {
  const { project } = req.query;

  // ⭐ Ensure project filtering is enforced
  if (!project) {
    return res.status(400).json({ message: 'Project ID is required to fetch task statuses' });
  }

  const statuses = await TaskStatus.find({ project });
  res.status(200).json(statuses);
});

// @desc    Get single task status
// @route   GET /api/task-statuses/:id
// @access  Private
const getTaskStatusById = asyncHandler(async (req, res) => {
  const status = await TaskStatus.findById(req.params.id);

  if (!status) {
    res.status(404);
    throw new Error('Task status not found');
  }

  res.status(200).json(status);
});

// @desc    Create task status
// @route   POST /api/task-statuses
// @access  Private (Admin/Manager)
const createTaskStatus = asyncHandler(async (req, res) => {
  // ⭐ Extract project from req.body
  const { name, status, project } = req.body;

  if (!name || !project) {
    res.status(400);
    throw new Error('Name and Project ID are required');
  }

  // ⭐ Save the status WITH the attached project
  const taskStatus = await TaskStatus.create({
    name,
    status: status || 'active',
    project 
  });

  const io = req.app.get('io');
  if (io) io.emit('taskStatusChanged');

  res.status(201).json(taskStatus);
});

// @desc    Update task status
// @route   PUT /api/task-statuses/:id
// @access  Private (Admin/Manager)
const updateTaskStatus = asyncHandler(async (req, res) => {
  const { name, status } = req.body;
  
  const taskStatus = await TaskStatus.findById(req.params.id);

  if (!taskStatus) {
    res.status(404);
    throw new Error('Task status not found');
  }

  taskStatus.name = name || taskStatus.name;
  taskStatus.status = status || taskStatus.status;

  const updatedStatus = await taskStatus.save();

  const io = req.app.get('io');
  if (io) io.emit('taskStatusChanged');

  res.status(200).json(updatedStatus);
});

// @desc    Delete task status
// @route   DELETE /api/task-statuses/:id
// @access  Private (Admin/Manager)
const deleteTaskStatus = asyncHandler(async (req, res) => {
  const taskStatus = await TaskStatus.findById(req.params.id);

  if (!taskStatus) {
    res.status(404);
    throw new Error('Task status not found');
  }

  await taskStatus.deleteOne();

  const io = req.app.get('io');
  if (io) io.emit('taskStatusChanged');

  res.status(200).json({ message: 'Task status removed' });
});

module.exports = {
  getTaskStatuses,
  getTaskStatusById,
  createTaskStatus,
  updateTaskStatus,
  deleteTaskStatus,
};