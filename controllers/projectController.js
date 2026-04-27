const asyncHandler = require('express-async-handler');
const Project = require('../models/Project');
const Company = require('../models/Company');
const logActivity = require('../utils/logActivity'); // ⭐ Imported the activity logger
const logAudit = require('../utils/auditLogger');
const Conversation = require('../models/Conversation');

/**
 * @desc    Get all projects (Scoped to Company)
 * @route   GET /api/projects
 * @access  Private
 */
const getProjects = asyncHandler(async (req, res) => {
  const isSuperAdmin = req.user.permissions?.includes('*');
  const isOwner = req.user.isCompanyOwner;
  const userCompany = req.user.company;

  let query = {};

  if (!isSuperAdmin) {
    query.company = userCompany;
    if (!isOwner) {
      query.assignedUsers = req.user._id;
    }
  }

  const projects = await Project.find(query)
    .populate('assignedUsers', 'name email role')
    .sort({ createdAt: -1 });

  res.status(200).json(projects);
});

/**
 * @desc    Get single project by ID
 * @route   GET /api/projects/:id
 * @access  Private
 */
const getProjectById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || id === 'null' || id === 'undefined') {
    return res.status(400).json({ message: 'Invalid Project ID' });
  }

  const project = await Project.findById(id).populate('assignedUsers', 'name email role');

  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  const isSuperAdmin = req.user.permissions?.includes('*');
  if (!isSuperAdmin && project.company?.toString() !== req.user.company?.toString()) {
    res.status(403);
    throw new Error('Not authorized to access projects from other companies');
  }

  res.status(200).json(project);
});

/**
 * @desc    Create a new project
 * @route   POST /api/projects
 * @access  Private (Owner/Admin)
 */
const createProject = asyncHandler(async (req, res) => {
  const { title, description, assignedUsers } = req.body;

  if (!title) {
    res.status(400);
    throw new Error('Please add a project title');
  }

  const userCompanyId = req.user.company;
  const company = await Company.findById(userCompanyId).populate('subscriptionPlan');

  if (company) {
    const plan = company.subscriptionPlan;
    const maxProjects = plan ? plan.maxProjects : 1;
    if (maxProjects !== -1) {
      const currentProjectCount = await Project.countDocuments({ company: userCompanyId });
      if (currentProjectCount >= maxProjects) {
        res.status(403);
        throw new Error(`Project limit reached (${maxProjects}). Please upgrade your plan.`);
      }
    }

    const maxTeam = plan ? plan.maxTeamMembersPerProject : 5;
    if (maxTeam !== -1 && assignedUsers && assignedUsers.length > maxTeam) {
      res.status(403);
      throw new Error(`Team size limit exceeded. Your plan allows only ${maxTeam} members per project.`);
    }
  }

  const project = await Project.create({
    title,
    description,
    assignedUsers: assignedUsers || [],
    company: userCompanyId,
    createdBy: req.user._id,
  });

  // ⭐ ACTIVITY LOG: Project Creation
  await logActivity({
    user: req.user._id,
    company: userCompanyId,
    project: project._id,
    action: 'created',
    resourceType: 'project',
    resourceId: project._id,
    description: `Created new project: "${title}"`
  });

  await logAudit(req, {
    user: req.user._id,
    company: userCompanyId,
    action: 'CREATED',
    resourceType: 'Project',
    resourceId: project._id,
    afterState: project.toObject ? project.toObject() : project,
    description: `Created new project: "${title}"`
  });

  const populatedProject = await Project.findById(project._id).populate('assignedUsers', 'name email role');
  res.status(201).json(populatedProject);
});

/**
 * @desc    Update project details
 * @route   PUT /api/projects/:id
 * @access  Private (Owner/Admin)
 */
const updateProject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, assignedUsers } = req.body;

  const project = await Project.findById(id);

  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  const isOwner = req.user.isCompanyOwner;
  const isCreator = project.createdBy?.toString() === req.user._id.toString();
  const isSameCompany = project.company?.toString() === req.user.company?.toString();
  const isSuperAdmin = req.user.permissions?.includes('*');

  if (!isSuperAdmin && (!isSameCompany || (!isOwner && !isCreator))) {
    res.status(403);
    throw new Error('Only the Company Owner or project creator can update projects within their organization');
  }

  if (assignedUsers) {
    const company = await Company.findById(req.user.company).populate('subscriptionPlan');
    if (company && company.subscriptionPlan) {
      const maxTeam = company.subscriptionPlan.maxTeamMembersPerProject;
      if (maxTeam !== -1 && assignedUsers.length > maxTeam) {
        res.status(403);
        throw new Error(`Cannot update team. Your plan limit is ${maxTeam} members per project.`);
      }
    }
  }

  const updatedProject = await Project.findByIdAndUpdate(
    id,
    req.body,
    { new: true, runValidators: true }
  ).populate('assignedUsers', 'name email role');

  // ⭐ ACTIVITY LOG: General Update
  await logActivity({
    user: req.user._id,
    company: req.user.company,
    project: id,
    action: 'updated',
    resourceType: 'project',
    resourceId: id,
    description: `Updated project details for "${updatedProject.title}"`
  });

  // ⭐ ACTIVITY LOG: Team Member Change Check
  if (assignedUsers && JSON.stringify(assignedUsers) !== JSON.stringify(project.assignedUsers)) {
    await logActivity({
      user: req.user._id,
      company: req.user.company,
      project: id,
      action: 'updated',
      resourceType: 'project',
      resourceId: id,
      description: `Modified team membership for "${updatedProject.title}"`
    });

    // ⭐ Chat Group Sync: Remove users who were dropped from the project
    const oldIds = project.assignedUsers.map(u => u.toString());
    const newIds = assignedUsers.map(u => u.toString());
    const removedUsers = oldIds.filter(uid => !newIds.includes(uid));

    if (removedUsers.length > 0) {
      await Conversation.updateOne(
        { project: id },
        { $pullAll: { participants: removedUsers } }
      );
      const io = req.app.get("io");
      if (io) {
        io.emit("updateConversationsList");
      }
    }
  }

  await logAudit(req, {
    user: req.user._id,
    company: req.user.company,
    action: 'UPDATED',
    resourceType: 'Project',
    resourceId: id,
    beforeState: project.toObject ? project.toObject() : project,
    afterState: updatedProject.toObject ? updatedProject.toObject() : updatedProject,
    description: `Updated project: "${updatedProject.title}"`
  });

  res.status(200).json(updatedProject);
});

/**
 * @desc    Delete a project
 * @route   DELETE /api/projects/:id
 * @access  Private (Owner only)
 */
const deleteProject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const project = await Project.findById(id);

  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  const isOwner = req.user.isCompanyOwner;
  const isSameCompany = project.company?.toString() === req.user.company?.toString();
  const isSuperAdmin = req.user.permissions?.includes('*');

  if (!isSuperAdmin && (!isSameCompany || !isOwner)) {
    res.status(403);
    throw new Error('Deletion is strictly restricted to the Company Owner');
  }

  // ⭐ ACTIVITY LOG: Before Deletion
  await logActivity({
    user: req.user._id,
    company: req.user.company,
    project: id,
    action: 'deleted',
    resourceType: 'project',
    resourceId: id,
    description: `Deleted project: "${project.title}"`
  });

  await logAudit(req, {
    user: req.user._id,
    company: req.user.company,
    action: 'DELETED',
    resourceType: 'Project',
    resourceId: id,
    beforeState: project.toObject ? project.toObject() : project,
    description: `Deleted project: "${project.title}"`
  });

  await project.deleteOne();
  res.status(200).json({ id, message: 'Project deleted successfully' });
});

/**
 * @desc    Get project team
 * @route   GET /api/projects/:id/team
 */
const getProjectTeam = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || id === 'null' || id === 'undefined') {
    return res.status(400).json({ message: 'Invalid or missing Project ID' });
  }

  const project = await Project.findById(id).populate('assignedUsers', 'name email role');

  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }

  const isSuperAdmin = req.user.permissions?.includes('*');
  if (!isSuperAdmin && project.company?.toString() !== req.user.company?.toString()) {
    return res.status(403).json({ message: 'Unauthorized access to this team data' });
  }

  res.status(200).json(project.assignedUsers);
});

/**
 * @desc    Get common projects between two users
 * @route   GET /api/projects/common/:userId
 */
const getCommonProjects = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const otherUserId = req.params.userId;

  const projects = await Project.find({
    company: req.user.company,
    $and: [
      { $or: [{ assignedUsers: currentUserId }, { createdBy: currentUserId }] },
      { $or: [{ assignedUsers: otherUserId }, { createdBy: otherUserId }] }
    ]
  }).select('title _id');

  res.status(200).json(projects);
});

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectTeam,
  getCommonProjects,
};