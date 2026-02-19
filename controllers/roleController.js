const asyncHandler = require('express-async-handler');
const Role = require('../models/Role');
const User = require('../models/User');

// @desc    Get all roles
// @route   GET /api/roles
const getRoles = asyncHandler(async (req, res) => {
  const roles = await Role.find({});
  res.json(roles);
});

// @desc    Get single role by ID
// @route   GET /api/roles/:id
const getRoleById = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);

  if (!role) {
    res.status(404);
    throw new Error('Role not found');
  }

  res.json(role);
});

// @desc    Create role
// @route   POST /api/roles
const createRole = asyncHandler(async (req, res) => {
  const { name, permissions = [], status } = req.body;

  if (!name) {
    res.status(400);
    throw new Error('Role name is required');
  }

  const roleExists = await Role.findOne({ name });
  if (roleExists) {
    res.status(400);
    throw new Error('Role already exists');
  }

  const role = await Role.create({
    name,
    status: status ?? 1,
    permissions
  });

  // 🔴 Live update emit
  const io = req.app.get("io");
  if (io) {
    const users = await User.find({ role: name });
    users.forEach(user => {
      io.to(user._id.toString()).emit("permissionsUpdated");
    });
  }

  res.status(201).json(role);
});

// @desc    Update role
// @route   PUT /api/roles/:id
// Inside roleController.js
const updateRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);

  if (!role) {
    res.status(404);
    throw new Error('Role not found');
  }

  // Update name if provided
  role.name = req.body.name || role.name;

  /**
   * FIX: Ensure we are saving an array of ObjectIds.
   * If the frontend sends an empty array, it clears permissions.
   */
  if (req.body.permissions) {
    role.permissions = req.body.permissions; 
  }

  const updatedRole = await role.save();
  
  // Populate to return the new state to the frontend
  const populatedRole = await Role.findById(updatedRole._id).populate('permissions');
  
  res.json(populatedRole);
});

// @desc    Delete role
// @route   DELETE /api/roles/:id
const deleteRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);

  if (!role) {
    res.status(404);
    throw new Error('Role not found');
  }

  // 🔴 Live update emit
  const io = req.app.get("io");
  if (io) {
    const users = await User.find({ role: role.name });
    users.forEach(user => {
      io.to(user._id.toString()).emit("permissionsUpdated");
    });
  }

  await role.deleteOne();

  res.json({ message: 'Role removed' });
});

module.exports = {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
};