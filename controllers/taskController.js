const Task = require('../models/Task');
const User = require('../models/User');
const sendTaskEmail = require('../utils/sendAssignEmail');

// @desc    Get all tasks
const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate('assignedTo', 'name email')
      .populate({ path: 'status', model: 'TaskStatus', options: { strictPopulate: false } })
      .populate('project', 'title'); // Populate project details if needed
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
      .populate({ path: 'status', model: 'TaskStatus' })
      .populate('project', 'title');
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Invalid Task ID format' });
  }
};

// @desc    Create Task
const createTask = async (req, res) => {
  try {
    const { title, description, status, assignedTo, mentionedUsers, project } = req.body;
    
    // Extract file paths from Multer
    const imagePaths = req.files?.images ? req.files.images.map(f => f.path) : [];
    const videoPaths = req.files?.videos ? req.files.videos.map(f => f.path) : [];
    const allMedia = [...imagePaths, ...videoPaths];

    // Defensively parse mentioned users JSON
    let parsedMentions = [];
    if (mentionedUsers && mentionedUsers !== "undefined") {
      try {
        parsedMentions = JSON.parse(mentionedUsers);
      } catch (e) { console.error("Mention parsing error", e); }
    }

    // Helper to safely cast empty strings to null for Mongoose ObjectIds
    const safeObjectId = (val) => (val === "" || val === "null" || val === undefined) ? null : val;

    const task = await Task.create({
      title,
      description,
      status: safeObjectId(status),
      assignedTo: safeObjectId(assignedTo),
      project: safeObjectId(project), 
      mentionedUsers: parsedMentions,
      images: imagePaths,
      videos: videoPaths
    });

    // 1. Notify Assigned User
    if (safeObjectId(assignedTo)) {
      const staffMember = await User.findById(assignedTo);
      if (staffMember?.email) {
        await sendTaskEmail(staffMember.email, staffMember.name, title, description, allMedia, 'assignment');
      }
    }

    // 2. Notify Mentioned Users
    if (parsedMentions.length > 0) {
      const mentionedStaff = await User.find({ _id: { $in: parsedMentions } });
      for (const staff of mentionedStaff) {
        // Prevent sending a double email if the mentioned user is also the assigned user
        if (staff._id.toString() !== safeObjectId(assignedTo) && staff.email) {
           await sendTaskEmail(staff.email, staff.name, title, description, allMedia, 'mention');
        }
      }
    }

    const populatedTask = await task.populate(['status', 'assignedTo', 'project']);
    res.status(201).json(populatedTask);
  } catch (error) {
    console.error("CREATE ERROR:", error);
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update Task
const updateTask = async (req, res) => {
  try {
    const { title, description, status, assignedTo, existingImages, existingVideos, mentionedUsers, project } = req.body;
    const oldTask = await Task.findById(req.params.id);

    if (!oldTask) return res.status(404).json({ message: 'Task not found' });

    // Defensive parsing for arrays
    let finalImages = [];
    try {
      finalImages = (existingImages && existingImages !== "undefined") ? JSON.parse(existingImages) : (oldTask.images || []);
    } catch (e) { finalImages = oldTask.images || []; }

    let finalVideos = [];
    try {
      finalVideos = (existingVideos && existingVideos !== "undefined") ? JSON.parse(existingVideos) : (oldTask.videos || []);
    } catch (e) { finalVideos = oldTask.videos || []; }

    let parsedMentions = [];
    if (mentionedUsers && mentionedUsers !== "undefined") {
      try {
        parsedMentions = JSON.parse(mentionedUsers);
      } catch (e) { console.error("Mention parsing error", e); }
    }

    const newImages = req.files?.images ? req.files.images.map(f => f.path) : [];
    const newVideos = req.files?.videos ? req.files.videos.map(f => f.path) : [];
    
    const currentImages = [...finalImages, ...newImages];
    const currentVideos = [...finalVideos, ...newVideos];
    const allMedia = [...currentImages, ...currentVideos];

    // Helper to safely cast empty strings to null
    const safeObjectId = (val) => (val === "" || val === "null" || val === undefined) ? null : val;
    const cleanAssignedTo = safeObjectId(assignedTo);

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { 
        title, 
        description,
        status: safeObjectId(status),
        assignedTo: cleanAssignedTo,
        project: safeObjectId(project), 
        mentionedUsers: parsedMentions,
        images: currentImages,
        videos: currentVideos 
      },
      { new: true }
    ).populate(['status', 'assignedTo', 'project']);

    // 1. Handle New Mentions
    if (parsedMentions.length > 0) {
      const mentionedStaff = await User.find({ _id: { $in: parsedMentions } });
      for (const staff of mentionedStaff) {
        if (staff._id.toString() !== cleanAssignedTo && staff.email) {
          await sendTaskEmail(staff.email, staff.name, title || updatedTask.title, description, allMedia, 'mention');
        }
      }
    }

    // 2. Notify if primary assignment changed
    if (cleanAssignedTo && cleanAssignedTo !== (oldTask.assignedTo?.toString())) {
      const staffMember = await User.findById(cleanAssignedTo);
      if (staffMember?.email) {
        await sendTaskEmail(staffMember.email, staffMember.name, title || updatedTask.title, description, allMedia, 'assignment');
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