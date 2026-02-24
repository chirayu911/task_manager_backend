const Task = require('../models/Task');
const User = require('../models/User');
const Project = require('../models/Project'); // ⭐ Added Project model for validation
const sendTaskEmail = require('../utils/sendAssignEmail');

// @desc    Get all tasks
const getTasks = async (req, res) => {
  try {
    const { project } = req.query;

    // ⭐ Enforce project filtering: Do not return tasks if no project is selected
    if (!project) {
      return res.status(400).json({ message: 'Project ID is required to fetch tasks' });
    }

    // Base query binds to the selected project
    let query = { project };

    // If the user making the request is NOT an admin, only search the DB for 
    // tasks assigned to them, or tasks where they are mentioned WITHIN this project.
    if (req.user) {
      const roleName = typeof req.user.role === 'object' ? req.user.role?.name : req.user.role;
      const isAdmin = roleName === 'admin' || roleName === 'superadmin';

      if (!isAdmin) {
        query.$or = [
          { assignedTo: req.user._id },
          { mentionedUsers: req.user._id }
        ];
      }
    }

    // Execute the lightning-fast indexed query
    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email')
      .populate({ path: 'status', model: 'TaskStatus', options: { strictPopulate: false } })
      .sort({ createdAt: -1 }); // Newest first

    res.json(tasks);
  } catch (error) {
    console.error("GET TASKS ERROR:", error);
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
    const { title, description, status, assignedTo, mentionedUsers, project } = req.body;
    
    // ⭐ Validate that a project was provided
    if (!project) {
      return res.status(400).json({ message: 'Project ID is required to create a task' });
    }

    const projectDoc = await Project.findById(project);
    if (!projectDoc) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // ⭐ Security Check: Ensure assigned user is actually in the project team
    if (assignedTo) {
      const isMember = projectDoc.assignedUsers.some(user => user.toString() === assignedTo);
      if (!isMember) {
        return res.status(400).json({ message: 'Assigned user is not a member of this project team' });
      }
    }

    const imagePaths = req.files?.images ? req.files.images.map(f => f.path) : [];
    const videoPaths = req.files?.videos ? req.files.videos.map(f => f.path) : [];
    const allMedia = [...imagePaths, ...videoPaths];

    const task = await Task.create({
      title,
      description,
      status,
      project, // ⭐ Bind task to the project
      assignedTo: assignedTo || null,
      images: imagePaths,
      videos: videoPaths
    });

    if (assignedTo) {
      const staffMember = await User.findById(assignedTo);
      if (staffMember?.email) {
        sendTaskEmail(staffMember.email, staffMember.name, title, description, allMedia, 'assignment');
      }
    }

    if (mentionedUsers) {
      const mentionIds = JSON.parse(mentionedUsers);
      const mentionedStaff = await User.find({ _id: { $in: mentionIds } });
      
      for (const staff of mentionedStaff) {
        if (staff._id.toString() !== assignedTo && staff.email) {
           sendTaskEmail(staff.email, staff.name, title, description, allMedia, 'mention');
        }
      }
    }

    const populatedTask = await task.populate(['status', 'assignedTo']);
    
    // WebSocket Emission
    const io = req.app.get('io');
    if (io) io.emit('taskCreated', populatedTask);

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

    // ⭐ Security Check: If assignment changes, verify new user is in the project team
    if (assignedTo && assignedTo !== "" && assignedTo !== "null" && assignedTo !== oldTask.assignedTo?.toString()) {
      const projectDoc = await Project.findById(oldTask.project);
      if (projectDoc) {
        const isMember = projectDoc.assignedUsers.some(userId => userId.toString() === assignedTo);
        if (!isMember) {
          return res.status(400).json({ message: 'Cannot assign task: User is not a member of this project' });
        }
      }
    }

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

    if (mentionedUsers) {
      const mentionIds = JSON.parse(mentionedUsers);
      const mentionedStaff = await User.find({ _id: { $in: mentionIds } });
      for (const staff of mentionedStaff) {
        if (staff._id.toString() !== assignedTo && staff.email) {
         sendTaskEmail(staff.email, staff.name, title || updatedTask.title, description, allMedia, 'mention');
        }
      }
    }

    if (assignedTo && assignedTo !== (oldTask.assignedTo?.toString())) {
      const staffMember = await User.findById(assignedTo);
      if (staffMember?.email) {
        sendTaskEmail(staffMember.email, staffMember.name, title || updatedTask.title, description, allMedia, 'assignment');
      }
    }

    // WebSocket Emission
    const io = req.app.get('io');
    if (io) io.emit('taskUpdated', updatedTask);

    res.json(updatedTask);
  } catch (error) {
    console.error("UPDATE ERROR:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// @desc    Delete Task
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    await task.deleteOne();

    // WebSocket Emission
    const io = req.app.get('io');
    if (io) io.emit('taskDeleted', req.params.id);

    res.json({ message: 'Task removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { getTasks, getTaskById, createTask, updateTask, deleteTask };