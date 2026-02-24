const asyncHandler = require('express-async-handler');
const Project = require('../models/Project');

/**
 * @desc    Get all projects
 * @route   GET /api/projects
 * @access  Private
 */
const getProjects = asyncHandler(async (req, res) => {
  // 1. Determine User Role
  const roleName = typeof req.user.role === 'object' ? req.user.role?.name : req.user.role;
  const isAdmin = roleName === 'admin' || roleName === 'superadmin' || req.user.permissions?.includes('*');

  let query = {};

  // 2. Filter logic: Admins see all projects. Staff only see projects they are assigned to.
  if (!isAdmin) {
    query = { assignedUsers: req.user._id };
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

  res.status(200).json(project);
});

/**
 * @desc    Create a new project
 * @route   POST /api/projects
 * @access  Private (Admin/Manager)
 */
const createProject = asyncHandler(async (req, res) => {
  const { title, description, assignedUsers } = req.body;

  if (!title) {
    res.status(400);
    throw new Error('Please add a project title');
  }

  const project = await Project.create({
    title,
    description,
    assignedUsers: assignedUsers || [],
  });

  const populatedProject = await Project.findById(project._id).populate('assignedUsers', 'name email role');

  res.status(201).json(populatedProject);
});

/**
 * @desc    Update project details
 * @route   PUT /api/projects/:id
 * @access  Private (Admin/Manager)
 */
const updateProject = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || id === 'null' || id === 'undefined') {
    return res.status(400).json({ message: 'Invalid Project ID' });
  }

  const project = await Project.findById(id);

  if (!project) {
    res.status(404);
    throw new Error('Project not found');
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
 * @access  Private (Admin only)
 */
const deleteProject = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || id === 'null' || id === 'undefined') {
    return res.status(400).json({ message: 'Invalid Project ID' });
  }

  const project = await Project.findById(id);

  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  await project.deleteOne();
  
  res.status(200).json({ id: req.params.id, message: 'Project deleted successfully' });
});

/**
 * @desc    Get ONLY the assigned users for a specific project
 * @route   GET /api/projects/:id/team
 * @access  Private
 */
const getProjectTeam = async (req, res) => {
  try {
    const { id } = req.params;

    // ⭐ Bulletproof check against bad LocalStorage data hitting the DB
    if (!id || id === 'null' || id === 'undefined') {
      return res.status(400).json({ message: 'Invalid or missing Project ID' });
    }

    const project = await Project.findById(id).populate('assignedUsers', 'name email role');
    
    // Safely return a 404 response WITHOUT crashing the server
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Return the array of team members
    res.status(200).json(project.assignedUsers);
  } catch (error) {
    console.error("GET PROJECT TEAM ERROR:", error);
    // Safely catch CastErrors (e.g., malformed ObjectIds)
    res.status(500).json({ message: 'Server error while fetching project team' });
  }
};

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectTeam,
};