import mongoose from 'mongoose'; // ⭐ REQUIRED for casting
import Task from '../models/Task.js';
import User from '../models/User.js';
import Project from '../models/Project.js';
import TaskStatus from '../models/TaskStatus.js';
import sendTaskEmail from '../utils/sendAssignEmail.js';

export const getTasks = async (req, res) => {
  try {
    const { project, itemType, page = 1, limit = 10 } = req.query;

    if (!project) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    // Convert strings to numbers
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    let query = { project };

    // Case-insensitive filtering for Task vs Issue
    if (itemType) {
      query.itemType = { $regex: new RegExp(`^${itemType}$`, 'i') };
    }

    // Role-based filtering
    if (req.user) {
      const roleName = typeof req.user.role === 'object' ? req.user.role?.name : req.user.role;
      if (roleName !== 'admin' && roleName !== 'superadmin') {
        query.$or = [{ assignedTo: req.user._id }, { mentionedUsers: req.user._id }];
      }
    }

    // Run count and find in parallel for efficiency
    const [tasks, totalItems] = await Promise.all([
      Task.find(query)
        .populate('assignedTo', 'name email')
        .populate({ path: 'status', model: 'TaskStatus', select: 'name color' })
        .sort({ createdAt: -1 })
        .skip(skip)   // Skip previous pages
        .limit(limitNumber) // Only fetch current page
        .lean(),
      Task.countDocuments(query) // Total for frontend pagination controls
    ]);

    res.json({
      tasks,
      totalItems,
      totalPages: Math.ceil(totalItems / limitNumber),
      currentPage: pageNumber
    });
  } catch (error) {
    console.error("GET TASKS ERROR:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get single task by ID
export const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate({ path: 'status', model: 'TaskStatus' })
      .lean(); // Add lean() here as well for efficiency

    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Invalid Task ID format' });
  }
};

// @desc    Create Task or Issue
export const createTask = async (req, res) => {
  try {
    const { title, description, status, assignedTo, project, itemType } = req.body;
    const taskType = itemType || 'Task';

    const existing = await Task.findOne({
      project,
      title: { $regex: new RegExp(`^${title.trim()}$`, 'i') }
    }).lean();

    if (existing) {
      return res.status(400).json({ message: `A ${existing.itemType.toLowerCase()} with this title already exists.` });
    }

    const imagePaths = req.files?.images ? req.files.images.map(f => f.path) : [];
    const videoPaths = req.files?.videos ? req.files.videos.map(f => f.path) : [];

    const task = await Task.create({
      title: title.trim(), description, status, project,
      assignedTo: assignedTo || null,
      images: imagePaths, videos: videoPaths,
      itemType: taskType
    });

    if (assignedTo) {
      const staff = await User.findById(assignedTo);
      if (staff?.email) sendTaskEmail(staff.email, staff.name, title, description, [...imagePaths, ...videoPaths], 'assignment', taskType);
    }

    const populatedTask = await task.populate(['status', 'assignedTo']);
    const io = req.app.get('io');
    if (io) io.emit('taskCreated', populatedTask);

    res.status(201).json(populatedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * @desc    Bulk Create - Turbo-charged for 10k rows in < 3s
 */
export const bulkCreateTasks = async (req, res) => {
  try {
    const { items, project, type } = req.body;
    const projectObjectId = new mongoose.Types.ObjectId(project);
    const category = type?.toLowerCase() === 'issue' ? 'Issue' : 'Task';

    // 1. Get unique identifiers from Excel
    const identifiers = [...new Set(items.map(item => {
      const raw = item.assigneeEmail || item.Assignee || item.email || "";
      return raw.toString().toLowerCase().trim();
    }).filter(Boolean))];

    // 2. Fetch data
    const [existingTasks, defaultStatus, users, projectDoc] = await Promise.all([
      Task.find({ project: projectObjectId }).select('title').lean(),
      TaskStatus.findOne({ project: projectObjectId }).lean(),
      // ⭐ We look for email OR name if the excel only has names
      User.find({ 
        $or: [
          { email: { $in: identifiers } },
          { name: { $in: identifiers } } 
        ]
      }).select('_id email name').lean(),
      Project.findById(projectObjectId).select('members').lean()
    ]);

    const memberSet = new Set((projectDoc?.members || []).map(m => m.toString()));
    
    // Map by both Email and Name for maximum compatibility
    const userLookupMap = new Map();
    users.forEach(u => {
      if (u.email) userLookupMap.set(u.email.toLowerCase(), u._id);
      if (u.name) userLookupMap.set(u.name.toLowerCase(), u._id);
    });
    
    const dbTitleSet = new Set(existingTasks.map(t => t.title.toLowerCase()));
    const newNamesInBatch = new Set();
    const validTasks = [];
    let assignedCount = 0;

    // 3. Loop
    for (const item of items) {
      const title = item.title?.trim();
      if (!title || dbTitleSet.has(title.toLowerCase()) || newNamesInBatch.has(title.toLowerCase())) continue;

      const iden = (item.assigneeEmail || item.Assignee || item.email || "").toString().toLowerCase().trim();
      let assigneeId = null;
      
      const dbUser = userLookupMap.get(iden);
      if (dbUser) {
        assigneeId = dbUser;
        assignedCount++;
        
        // ⭐ Automatically add user to project if missing
        if (!memberSet.has(dbUser.toString())) {
          await Project.findByIdAndUpdate(projectObjectId, { $addToSet: { members: dbUser } });
          memberSet.add(dbUser.toString());
        }
      }

      validTasks.push({
        title,
        description: item.description || "",
        project: projectObjectId,
        status: defaultStatus?._id || null,
        assignedTo: assigneeId,
        itemType: category,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      newNamesInBatch.add(title.toLowerCase());
    }

    if (validTasks.length > 0) {
      await Task.collection.bulkWrite(validTasks.map(t => ({ insertOne: { document: t } })), { ordered: false });
      return res.status(201).json({
        success: true,
        message: `Imported ${validTasks.length} items. Successfully assigned ${assignedCount} users.`
      });
    }

    res.status(400).json({ message: "No new items to import." });
  } catch (error) {
    console.error("Bulk Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
// @desc    Update Task or Issue
export const updateTask = async (req, res) => {
  try {
    const { title, description, status, assignedTo, itemType } = req.body;
    const oldTask = await Task.findById(req.params.id);
    if (!oldTask) return res.status(404).json({ message: 'Task not found' });

    const taskType = itemType || oldTask.itemType;

    if (title && title.trim().toLowerCase() !== oldTask.title.toLowerCase()) {
      const duplicate = await Task.findOne({
        project: oldTask.project,
        title: { $regex: new RegExp(`^${title.trim()}$`, 'i') },
        _id: { $ne: req.params.id }
      }).lean();
      if (duplicate) {
        return res.status(400).json({ message: "Duplicate title detected." });
      }
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { title: title ? title.trim() : oldTask.title, description, status, assignedTo: assignedTo === "null" ? null : assignedTo, itemType: taskType },
      { new: true }
    ).populate(['status', 'assignedTo']).lean();

    if (assignedTo && assignedTo !== oldTask.assignedTo?.toString()) {
      const staff = await User.findById(assignedTo);
      if (staff?.email) sendTaskEmail(staff.email, staff.name, updatedTask.title, description, [], 'assignment', taskType);
    }

    const io = req.app.get('io');
    if (io) io.emit('taskUpdated', updatedTask);
    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: "Update failed" });
  }
};

// @desc    Delete Task
export const deleteTask = async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    const io = req.app.get('io');
    if (io) io.emit('taskDeleted', req.params.id);
    res.json({ message: 'Removed' });
  } catch (error) {
    res.status(500).json({ message: 'Delete failed' });
  }
};