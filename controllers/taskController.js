const Task = require('../models/Task');
const User = require('../models/User');
const sendTaskEmail = require('../utils/sendAssignEmail');

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
    const { title, description, status, assignedTo, mentionedUsers } = req.body;
    
    const imagePaths = req.files?.images ? req.files.images.map(f => f.path) : [];
    const videoPaths = req.files?.videos ? req.files.videos.map(f => f.path) : [];
    const allMedia = [...imagePaths, ...videoPaths];

    const task = await Task.create({
      title,
      description,
      status,
      assignedTo: assignedTo || null,
      images: imagePaths,
      videos: videoPaths
    });

    // 1. Notify Assigned User (Type: assignment)
    if (assignedTo) {
      const staffMember = await User.findById(assignedTo);
      if (staffMember?.email) {
        // Pass description and media for attachments
        sendTaskEmail(staffMember.email, staffMember.name, title, description, allMedia, 'assignment');
      }
    }

    // 2. Notify Mentioned Users (Type: mention)
    if (mentionedUsers) {
      const mentionIds = JSON.parse(mentionedUsers);
      const mentionedStaff = await User.find({ _id: { $in: mentionIds } });
      
      for (const staff of mentionedStaff) {
        // ⭐ Logic: Don't send mention email if they are already the primary assignee
        if (staff._id.toString() !== assignedTo && staff.email) {
           sendTaskEmail(staff.email, staff.name, title, description, allMedia, 'mention');
        }
      }
    }

    const populatedTask = await task.populate(['status', 'assignedTo']);
    res.status(201).json(populatedTask);
  } catch (error) {
    console.error("CREATE ERROR:", error);
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update Task
const updateTask = async (req, res) => {
  try {
    const { title, description, status, assignedTo, existingImages, existingVideos, mentionedUsers } = req.body;
    const oldTask = await Task.findById(req.params.id);

    if (!oldTask) return res.status(404).json({ message: 'Task not found' });

    let finalImages = [];
    try {
      finalImages = (existingImages && existingImages !== "undefined") ? JSON.parse(existingImages) : (oldTask.images || []);
    } catch (e) { finalImages = oldTask.images || []; }

    let finalVideos = [];
    try {
      finalVideos = (existingVideos && existingVideos !== "undefined") ? JSON.parse(existingVideos) : (oldTask.videos || []);
    } catch (e) { finalVideos = oldTask.videos || []; }

    const newImages = req.files?.images ? req.files.images.map(f => f.path) : [];
    const newVideos = req.files?.videos ? req.files.videos.map(f => f.path) : [];
    
    const currentImages = [...finalImages, ...newImages];
    const currentVideos = [...finalVideos, ...newVideos];
    const allMedia = [...currentImages, ...currentVideos];

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { 
        title, 
        description,
        status, 
        assignedTo: (assignedTo === "" || assignedTo === "null") ? null : assignedTo,
        images: currentImages,
        videos: currentVideos 
      },
      { new: true }
    ).populate(['status', 'assignedTo']);

    // 1. Handle New Mentions
    if (mentionedUsers) {
      const mentionIds = JSON.parse(mentionedUsers);
      const mentionedStaff = await User.find({ _id: { $in: mentionIds } });
      for (const staff of mentionedStaff) {
        // Only send if not the primary assigned person
        if (staff._id.toString() !== assignedTo && staff.email) {
         sendTaskEmail(staff.email, staff.name, title || updatedTask.title, description, allMedia, 'mention');
        }
      }
    }

    // 2. Notify if primary assignment changed
    if (assignedTo && assignedTo !== (oldTask.assignedTo?.toString())) {
      const staffMember = await User.findById(assignedTo);
      if (staffMember?.email) {
        sendTaskEmail(staffMember.email, staffMember.name, title || updatedTask.title, description, allMedia, 'assignment');
      }
    }

    res.json(updatedTask);
  } catch (error) {
    console.error("UPDATE ERROR:", error);
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