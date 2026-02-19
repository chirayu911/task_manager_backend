const Task = require('../models/Task');
const User = require('../models/User');
const sendTaskEmail = require('../utils/sendEmail');

// @desc    Get all tasks
const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate('assignedTo', 'name email')
      .populate({ path: 'status', model: 'TaskStatus', options: { strictPopulate: false } });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get single task by ID
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate({ path: 'status', model: 'TaskStatus' });
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
    // Map uploaded file paths
    const imagePaths = req.files?.images ? req.files.images.map(f => f.path) : [];
    const videoPaths = req.files?.video ? req.files.video.map(f => f.path) : [];

    const task = await Task.create({
      title,
      status,
      assignedTo: assignedTo || null,
      images: imagePaths,
      video: videoPaths
    });

    if (assignedTo) {
      const staffMember = await User.findById(assignedTo);
      if (staffMember?.email) sendTaskEmail(staffMember.email, staffMember.name, title);
    }

    const populatedTask = await task.populate(['status', 'assignedTo']);
    res.status(201).json(populatedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update Task (Defensive Parsing Version)
const updateTask = async (req, res) => {
  try {
    const { title, status, assignedTo, existingImages, existingVideos } = req.body;
    const oldTask = await Task.findById(req.params.id);

    if (!oldTask) return res.status(404).json({ message: 'Task not found' });

    // ⭐ Defensive Parsing: Prevents 500 errors if JSON is malformed
    let finalImages = [];
    try {
      finalImages = (existingImages && typeof existingImages === 'string' && existingImages !== "undefined") 
        ? JSON.parse(existingImages) 
        : (oldTask.images || []);
    } catch (e) {
      finalImages = oldTask.images || [];
    }

    let finalVideos = [];
    try {
      finalVideos = (existingVideos && typeof existingVideos === 'string' && existingVideos !== "undefined") 
        ? JSON.parse(existingVideos) 
        : (oldTask.video || []);
    } catch (e) {
      finalVideos = oldTask.video || [];
    }

    // Merge newly uploaded files
    if (req.files?.images) {
      finalImages = [...finalImages, ...req.files.images.map(f => f.path)];
    }
    if (req.files?.video) {
      finalVideos = [...finalVideos, ...req.files.video.map(f => f.path)];
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { 
        title, 
        status, 
        assignedTo: (assignedTo === "" || assignedTo === "null") ? null : assignedTo,
        images: finalImages,
        video: finalVideos 
      },
      { new: true }
    ).populate(['status', 'assignedTo']);

    // Notify if reassigned
    if (assignedTo && assignedTo !== oldTask.assignedTo?.toString()) {
      const staffMember = await User.findById(assignedTo);
      if (staffMember?.email) sendTaskEmail(staffMember.email, staffMember.name, title || updatedTask.title);
    }

    res.json(updatedTask);
  } catch (error) {
    console.error("CRITICAL UPDATE ERROR:", error); // View this in your server terminal
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

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

module.exports = { getTasks, getTaskById, createTask, updateTask, deleteTask };