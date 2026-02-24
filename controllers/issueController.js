const asyncHandler = require('express-async-handler');
const Issue = require('../models/Issue');
const Project = require('../models/Project');

/**
 * @desc    Get all issues for a specific project
 * @route   GET /api/issues?project=PROJECT_ID
 * @access  Private
 */
const getIssues = asyncHandler(async (req, res) => {
  const { project } = req.query;

  if (!project) {
    return res.status(400).json({ message: 'Project ID is required to fetch issues' });
  }

  const issues = await Issue.find({ project })
    .populate('assignedTo', 'name email')
    .populate('reportedBy', 'name email')
    .sort({ createdAt: -1 });

  res.status(200).json(issues);
});

/**
 * @desc    Get a single issue by ID (Needed for Edit Mode)
 * @route   GET /api/issues/:id
 * @access  Private
 */
const getIssueById = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id)
    .populate('assignedTo', 'name email')
    .populate('reportedBy', 'name email');

  if (!issue) {
    return res.status(404).json({ message: 'Issue not found' });
  }

  res.status(200).json(issue);
});

/**
 * @desc    Create a new issue
 * @route   POST /api/issues
 * @access  Private
 */
const createIssue = asyncHandler(async (req, res) => {
  const { title, description, project, severity, status, assignedTo } = req.body;

  if (!title || !description || !project) {
    return res.status(400).json({ message: 'Please provide title, description, and project ID' });
  }

  const projectExists = await Project.findById(project);
  if (!projectExists) {
    return res.status(404).json({ message: 'Project not found' });
  }

  // ⭐ Security Check for Multiple Assignees: Verify ALL users belong to the project team
  let validAssignees = [];
  if (assignedTo && Array.isArray(assignedTo) && assignedTo.length > 0) {
    const projectTeamIds = projectExists.assignedUsers.map(u => u.toString());
    
    const allValid = assignedTo.every(userId => projectTeamIds.includes(userId.toString()));
    
    if (!allValid) {
      return res.status(400).json({ message: 'One or more assigned users are not members of this project' });
    }
    validAssignees = assignedTo;
  }

  const issue = await Issue.create({
    title,
    description,
    project,
    severity: severity || 'Medium',
    status: status || 'Open',
    assignedTo: validAssignees,
    reportedBy: req.user.id, // Authenticated user
  });

  const populatedIssue = await Issue.findById(issue._id)
    .populate('assignedTo', 'name email')
    .populate('reportedBy', 'name email');

  res.status(201).json(populatedIssue);
});

/**
 * @desc    Update an issue
 * @route   PUT /api/issues/:id
 * @access  Private (Admin/Manager/Assigned User)
 */
const updateIssue = asyncHandler(async (req, res) => {
  const { title, description, status, severity, assignedTo } = req.body;

  const issue = await Issue.findById(req.params.id);

  if (!issue) {
    return res.status(404).json({ message: 'Issue not found' });
  }

  // ⭐ Security Check for Multiple Assignees on Update
  if (assignedTo && Array.isArray(assignedTo)) {
    const project = await Project.findById(issue.project);
    const projectTeamIds = project.assignedUsers.map(u => u.toString());

    const allValid = assignedTo.every(userId => projectTeamIds.includes(userId.toString()));
    
    if (!allValid) {
      return res.status(400).json({ message: 'Cannot assign issue: One or more users are not members of this project' });
    }
    issue.assignedTo = assignedTo;
  }

  issue.title = title || issue.title;
  issue.description = description || issue.description;
  issue.status = status || issue.status;
  issue.severity = severity || issue.severity;

  const updatedIssue = await issue.save();

  await updatedIssue.populate('assignedTo', 'name email');
  await updatedIssue.populate('reportedBy', 'name email');

  res.status(200).json(updatedIssue);
});

/**
 * @desc    Delete an issue
 * @route   DELETE /api/issues/:id
 * @access  Private (Admin only)
 */
const deleteIssue = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id);

  if (!issue) {
    return res.status(404).json({ message: 'Issue not found' });
  }

  await issue.deleteOne();
  res.status(200).json({ id: req.params.id, message: 'Issue deleted' });
});

module.exports = {
  getIssues,
  getIssueById,
  createIssue,
  updateIssue,
  deleteIssue,
};