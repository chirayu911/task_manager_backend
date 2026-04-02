import mongoose from 'mongoose';
import Task from '../models/Task.js';
import User from '../models/User.js';
import Project from '../models/Project.js';
import TaskStatus from '../models/TaskStatus.js';
import Company from '../models/Company.js';
import sendTaskEmail from '../utils/sendAssignEmail.js';
import logActivity from '../utils/logActivity.js';
import logAudit from '../utils/auditLogger.js';

// @desc    Get all tasks (Scoped to Company)
export const getTasks = async (req, res) => {
  try {
    const { project, itemType, page = 1, limit = 10 } = req.query;

    if (!project) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    let query = {
      project,
      company: req.user.company
    };

    if (itemType) {
      query.itemType = { $regex: new RegExp(`^${itemType}$`, 'i') };
    }

    if (req.user) {
      const roleName = typeof req.user.role === 'object' ? req.user.role?.name : req.user.role;
      const isOwner = req.user.isCompanyOwner;

      if (roleName !== 'admin' && roleName !== 'superadmin' && !isOwner) {
        query.$or = [{ assignedTo: req.user._id }, { mentionedUsers: req.user._id }];
      }
    }

    const [tasks, totalItems] = await Promise.all([
      Task.find(query)
        .populate('assignedTo', 'name email')
        .populate({ path: 'status', model: 'TaskStatus', select: 'name color' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Task.countDocuments(query)
    ]);

    res.json({
      tasks,
      totalItems,
      totalPaths: Math.ceil(totalItems / limitNumber),
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
    const { id } = req.params;
    const { projectId } = req.query; // Optional: Pass project ID from frontend for stricter security

    const query = {
      _id: id,
      company: req.user.company
    };

    // If your frontend sends the project ID in the query params (?projectId=...)
    if (projectId) {
      query.project = projectId;
    }

    const task = await Task.findOne(query)
      .populate('assignedTo', 'name email')
      .populate({ path: 'status', model: 'TaskStatus' })
      // Use .populate('project', 'name') if you need project details on the form
      .lean();

    if (!task) {
      return res.status(404).json({ message: 'Task or Issue not found' });
    }

    // Optional: Transform image/video paths here if they are stored as full system paths
    // task.images = task.images.map(img => img.replace('public/', ''));

    res.json(task);
  } catch (error) {
    // Distinguish between a CastError (Invalid ID) and a server error
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid Task ID format' });
    }
    
    console.error("GetTask Error:", error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// @desc    Create Task or Issue (Including Timeline & Hours)
export const createTask = async (req, res) => {
  try {
    const { 
        title, description, status, assignedTo, project, itemType,
        startDate, endDate, hours // ⭐ New Timeline Fields
    } = req.body;
    
    const taskType = itemType || 'Task';
    const userCompanyId = req.user.company;

    const existing = await Task.findOne({
      project,
      company: userCompanyId,
      title: { $regex: new RegExp(`^${title.trim()}$`, 'i') }
    }).lean();

    if (existing) {
      return res.status(400).json({ message: `A ${existing.itemType.toLowerCase()} with this title already exists.` });
    }

    // ⭐ SUBSCRIPTION LIMIT CHECK
    const company = await Company.findById(userCompanyId).populate('subscriptionPlan');
    if (company) {
      const maxTasks = company.subscriptionPlan ? company.subscriptionPlan.maxTasks : 50;
      if (maxTasks !== -1) {
        const currentTaskCount = await Task.countDocuments({ company: userCompanyId });
        if (currentTaskCount >= maxTasks) {
          return res.status(403).json({
            message: `Subscription Limit Reached: Your plan allows a max of ${maxTasks} tasks. Please upgrade.`
          });
        }
      }
    }

    const imagePaths = req.files?.images ? req.files.images.map(f => f.path) : [];
    const videoPaths = req.files?.videos ? req.files.videos.map(f => f.path) : [];

    const task = await Task.create({
      title: title.trim(),
      description,
      status,
      project,
      company: userCompanyId,
      assignedTo: assignedTo || null,
      images: imagePaths,
      videos: videoPaths,
      itemType: taskType,
      createdBy: req.user._id,
      // ⭐ Storing Timeline
      startDate: startDate || null,
      endDate: endDate || null,
      hours: Number(hours) || 0
    });

    // ⭐ ACTIVITY LOG: Creation
    await logActivity({
      user: req.user._id,
      company: userCompanyId,
      project: project,
      action: 'created',
      resourceType: taskType.toLowerCase() === 'issue' ? 'issue' : 'task',
      resourceId: task._id,
      description: `Created ${taskType.toLowerCase()}: "${title.trim()}" (${hours || 0} hrs estimated)`
    });

    if (assignedTo) {
      const staff = await User.findById(assignedTo);
      if (staff?.email) {
        sendTaskEmail(staff.email, staff.name, title, description, [...imagePaths, ...videoPaths], 'assignment', taskType);
        
        await logActivity({
          user: req.user._id,
          targetUser: assignedTo,
          company: userCompanyId,
          project: project,
          action: 'assigned',
          resourceType: taskType.toLowerCase() === 'issue' ? 'issue' : 'task',
          resourceId: task._id,
          description: `Assigned ${taskType.toLowerCase()} to ${staff.name}`
        });
      }
    }

    const populatedTask = await task.populate(['status', 'assignedTo']);
    const io = req.app.get('io');
    if (io) io.emit('taskCreated', populatedTask);

    await logAudit(req, {
      user: req.user._id,
      company: userCompanyId,
      action: 'CREATED',
      resourceType: 'Task',
      resourceId: task._id,
      afterState: task.toObject ? task.toObject() : task,
      description: `Created ${taskType.toLowerCase()}: "${title.trim()}"`,
    });

    res.status(201).json(populatedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Bulk Create Tasks (With Timeline mapping)
export const bulkCreateTasks = async (req, res) => {
  try {
    const { items, project, type } = req.body;
    const projectObjectId = new mongoose.Types.ObjectId(project);
    const category = type?.toLowerCase() === 'issue' ? 'Issue' : 'Task';
    const userCompany = req.user.company;

    const companyDoc = await Company.findById(userCompany).populate('subscriptionPlan').lean();

    if (!companyDoc?.subscriptionPlan?.hasBulkUpload) {
      return res.status(403).json({ message: "Feature Restricted: Upgrade for Bulk Import." });
    }

    let maxAllowed = Infinity;
    const maxTasks = companyDoc.subscriptionPlan ? companyDoc.subscriptionPlan.maxTasks : 50;
    if (maxTasks !== -1) {
      const currentTaskCount = await Task.countDocuments({ company: userCompany });
      maxAllowed = Math.max(0, maxTasks - currentTaskCount);
    }

    const identifiers = [...new Set(items.map(item => {
      const raw = item.assigneeEmail || item.Assignee || item.email || "";
      return raw.toString().toLowerCase().trim();
    }).filter(Boolean))];

    const [existingTasks, defaultStatus, users, projectDoc] = await Promise.all([
      Task.find({ project: projectObjectId, company: userCompany }).select('title').lean(),
      TaskStatus.findOne({ project: projectObjectId }).lean(),
      User.find({
        company: userCompany,
        $or: [{ email: { $in: identifiers } }, { name: { $in: identifiers } }]
      }).select('_id email name').lean(),
      Project.findById(projectObjectId).select('members').lean()
    ]);

    const memberSet = new Set((projectDoc?.members || []).map(m => m.toString()));
    const userLookupMap = new Map();
    users.forEach(u => {
      if (u.email) userLookupMap.set(u.email.toLowerCase(), u._id);
      if (u.name) userLookupMap.set(u.name.toLowerCase(), u._id);
    });

    const dbTitleSet = new Set(existingTasks.map(t => t.title.toLowerCase()));
    const newNamesInBatch = new Set();
    const validTasks = [];

    for (const item of items) {
      if (validTasks.length >= maxAllowed) break;
      const title = item.title?.trim();
      if (!title || dbTitleSet.has(title.toLowerCase()) || newNamesInBatch.has(title.toLowerCase())) continue;

      const iden = (item.assigneeEmail || item.Assignee || item.email || "").toString().toLowerCase().trim();
      let assigneeId = userLookupMap.get(iden) || null;

      validTasks.push({
        title,
        description: item.description || "",
        project: projectObjectId,
        company: userCompany,
        status: defaultStatus?._id || null,
        assignedTo: assigneeId,
        itemType: category,
        createdBy: req.user._id,
        // ⭐ Map timeline from Import
        startDate: item.startDate ? new Date(item.startDate) : null,
        endDate: item.endDate ? new Date(item.endDate) : null,
        hours: Number(item.hours) || 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      newNamesInBatch.add(title.toLowerCase());
    }

    if (validTasks.length > 0) {
      await Task.collection.bulkWrite(validTasks.map(t => ({ insertOne: { document: t } })), { ordered: false });
      
      await logActivity({
        user: req.user._id,
        company: userCompany,
        project: project,
        action: 'uploaded',
        resourceType: category.toLowerCase(),
        resourceId: projectObjectId,
        description: `Bulk imported ${validTasks.length} ${category.toLowerCase()}s`
      });

      await logAudit(req, {
        user: req.user._id,
        company: userCompany,
        action: 'CREATED',
        resourceType: 'Task',
        description: `Bulk imported ${validTasks.length} ${category.toLowerCase()}s`,
        afterState: { bulkTaskCount: validTasks.length, newTasks: validTasks },
      });

      return res.status(201).json({ success: true, message: `Imported ${validTasks.length} items.` });
    }
    res.status(400).json({ message: "No new valid items to import." });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Update Task or Issue (Including Timeline & Hours)
export const updateTask = async (req, res) => {
  try {
    const { 
        title, description, status, assignedTo, itemType,
        startDate, endDate, hours // ⭐ New Timeline Fields
    } = req.body;

    const oldTask = await Task.findOne({
      _id: req.params.id,
      company: req.user.company
    }).populate('status').populate('assignedTo');

    if (!oldTask) return res.status(404).json({ message: 'Task not found' });

    const taskType = itemType || oldTask.itemType;

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { 
        title: title ? title.trim() : oldTask.title, 
        description, 
        status, 
        assignedTo: assignedTo === "null" ? null : assignedTo, 
        itemType: taskType,
        // ⭐ Update Timeline
        startDate: startDate !== undefined ? startDate : oldTask.startDate,
        endDate: endDate !== undefined ? endDate : oldTask.endDate,
        hours: hours !== undefined ? Number(hours) : oldTask.hours
      },
      { new: true }
    ).populate(['status', 'assignedTo']).lean();

    // ⭐ Build Detailed Activity Description
    let changes = [];
    if (oldTask.status?._id?.toString() !== updatedTask.status?._id?.toString()) {
      const oldStatus = oldTask.status?.name || 'None';
      const newStatus = updatedTask.status?.name || 'None';
      changes.push(`status from '${oldStatus}' to '${newStatus}'`);
    }
    
    if (oldTask.assignedTo?._id?.toString() !== updatedTask.assignedTo?._id?.toString()) {
      const oldAsg = oldTask.assignedTo?.name || 'Unassigned';
      const newAsg = updatedTask.assignedTo?.name || 'Unassigned';
      changes.push(`assignee from '${oldAsg}' to '${newAsg}'`);
    }

    let descriptionStr = `Updated ${taskType.toLowerCase()}: "${updatedTask.title}"`;
    if (changes.length > 0) {
      descriptionStr += ` — Changed ${changes.join(' and ')}`;
    }

    await logActivity({
      user: req.user._id,
      company: req.user.company,
      project: oldTask.project,
      action: 'updated',
      resourceType: taskType.toLowerCase(),
      resourceId: updatedTask._id,
      description: descriptionStr
    });

    await logAudit(req, {
      user: req.user._id,
      company: req.user.company,
      action: 'UPDATED',
      resourceType: 'Task',
      resourceId: updatedTask._id,
      beforeState: oldTask.toObject ? oldTask.toObject() : oldTask,
      afterState: updatedTask,
      description: descriptionStr
    });

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
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      company: req.user.company
    });

    if (!task) return res.status(404).json({ message: 'Task not found' });

    await logActivity({
      user: req.user._id,
      company: req.user.company,
      project: task.project,
      action: 'deleted',
      resourceType: task.itemType.toLowerCase(),
      resourceId: task._id,
      description: `Deleted ${task.itemType.toLowerCase()}: "${task.title}"`
    });

    await logAudit(req, {
      user: req.user._id,
      company: req.user.company,
      action: 'DELETED',
      resourceType: 'Task',
      resourceId: task._id,
      beforeState: task.toObject ? task.toObject() : task,
      description: `Deleted ${task.itemType.toLowerCase()}: "${task.title}"`
    });

    const io = req.app.get('io');
    if (io) io.emit('taskDeleted', req.params.id);
    res.json({ message: 'Removed' });
  } catch (error) {
    res.status(500).json({ message: 'Delete failed' });
  }
};