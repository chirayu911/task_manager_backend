const Task = require('../models/Task');
const User = require('../models/User');
const sendTaskEmail = require('../utils/sendEmail');

// @desc    Get all tasks
// controllers/taskController.js
const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate('assignedTo', 'name email')
      .populate({
        path: 'status',
        model: 'TaskStatus',
        options: { strictPopulate: false } // ⭐ This stops the crash you are seeing
      });
    res.json(tasks);
  } catch (error) {
    console.error("Error in getTasks:", error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get single task by ID
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate({
        path: 'status',
        model: 'TaskStatus'
      }); 
    
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Invalid Task ID format' });
  }
};

// @desc    Create Task
const createTask = async (req, res) => {
  try {
    const { title, status, assignedTo } = req.body;

    const task = await Task.create({
      title,
      status, // Should be a valid TaskStatus ObjectId
      assignedTo: assignedTo || null
    });

    if (assignedTo) {
      const staffMember = await User.findById(assignedTo);
      if (staffMember?.email) {
        sendTaskEmail(staffMember.email, staffMember.name, title);
      }
    }

    const populatedTask = await task.populate([
      { path: 'status', model: 'TaskStatus' }, 
      { path: 'assignedTo', select: 'name email' }
    ]);
    res.status(201).json(populatedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update Task
const updateTask = async (req, res) => {
  try {
    const { title, status, assignedTo } = req.body;
    const oldTask = await Task.findById(req.params.id);

    if (!oldTask) return res.status(404).json({ message: 'Task not found' });

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { title, status, assignedTo: assignedTo === "" ? null : assignedTo },
      { new: true }
    )
    .populate({ path: 'status', model: 'TaskStatus' })
    .populate('assignedTo', 'name email');

    if (assignedTo && assignedTo !== oldTask.assignedTo?.toString()) {
      const staffMember = await User.findById(assignedTo);
      if (staffMember?.email) {
        sendTaskEmail(staffMember.email, staffMember.name, title || updatedTask.title);
      }
    }

    res.json(updatedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete Task
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    await task.deleteOne();
    res.json({ message: 'Task removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask
};