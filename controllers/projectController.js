const asyncHandler = require('express-async-handler');
const Project = require('../models/Project');

/**
 * @desc    Get all projects (Scoped to Company)
 * @route   GET /api/projects
 * @access  Private
 */
const getProjects = asyncHandler(async (req, res) => {
  // 1. Determine User Context
  const isSuperAdmin = req.user.permissions?.includes('*');
  const isOwner = req.user.isCompanyOwner;
  const userCompany = req.user.company;

  let query = {};

  // 2. Filter Logic: Mandatory Company Isolation
  if (!isSuperAdmin) {
    // Everyone except SuperAdmin is locked to their specific company
    query.company = userCompany;

    // Staff (not owners) see only projects where they are explicitly assigned
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

  // Bulletproof ID validation
  if (!id || id === 'null' || id === 'undefined') {
    return res.status(400).json({ message: 'Invalid Project ID' });
  }

  const project = await Project.findById(id).populate('assignedUsers', 'name email role');

  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  // ⭐ Security Guard: Ensure project belongs to the user's organization
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

  // ⭐ Multi-tenant Anchor: Auto-assign user's company and track project creator
  const project = await Project.create({
    title,
    description,
    assignedUsers: assignedUsers || [],
    company: req.user.company, // Links project to the requester's company
    createdBy: req.user._id,
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

  const project = await Project.findById(id);

  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  // ⭐ Permission Logic: Owner or Creator within the same company
  const isOwner = req.user.isCompanyOwner;
  const isCreator = project.createdBy?.toString() === req.user._id.toString();
  const isSameCompany = project.company?.toString() === req.user.company?.toString();
  const isSuperAdmin = req.user.permissions?.includes('*');

  if (!isSuperAdmin && (!isSameCompany || (!isOwner && !isCreator))) {
    res.status(403);
    throw new Error('Only the Company Owner or project creator can update projects within their organization');
  }

  const updatedProject = await Project.findByIdAndUpdate(
    id,
    req.body,
    { new: true, runValidators: true }
  ).populate('assignedUsers', 'name email role');

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

  // ⭐ Strict Security: Only Company Owner (or SuperAdmin) can delete organization data
  const isOwner = req.user.isCompanyOwner;
  const isSameCompany = project.company?.toString() === req.user.company?.toString();
  const isSuperAdmin = req.user.permissions?.includes('*');

  if (!isSuperAdmin && (!isSameCompany || !isOwner)) {
    res.status(403);
    throw new Error('Deletion is strictly restricted to the Company Owner');
  }

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

  // ⭐ Security Check: Verify company alignment
  const isSuperAdmin = req.user.permissions?.includes('*');
  if (!isSuperAdmin && project.company?.toString() !== req.user.company?.toString()) {
    return res.status(403).json({ message: 'Unauthorized access to this team data' });
  }

  res.status(200).json(project.assignedUsers);
});

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectTeam,
};