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
const createRole = async (req, res) => {
  try {
    const { name, permissions } = req.body;

    if (!name) return res.status(400).json({ message: "Role name is required" });

    const role = await Role.create({ name, permissions });
    
    // ⭐ Real-time Sync: Notify all clients
    const io = req.app.get("io");
    if (io) io.emit("permissionsUpdated");

    res.status(201).json(role);
  } catch (error) {
    console.error("Role Creation Error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update role
// @route   PUT /api/roles/:id
const updateRole = async (req, res) => {
  try {
    const { name, permissions } = req.body;
    
    // Update the role first
    const role = await Role.findByIdAndUpdate(
      req.params.id, 
      { name, permissions }, 
      { new: true }
    );

    if (!role) return res.status(404).json({ message: "Role not found" });

    // ⭐ Real-time Sync for affected users
    const io = req.app.get("io");
    if (io) {
      // Find users with this specific role name or ID
      const users = await User.find({ role: role._id }); 
      users.forEach(user => {
        io.to(user._id.toString()).emit("permissionsUpdated");
      });
      // Also broadcast general update
      io.emit("permissionsUpdated");
    }

    res.json(role);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete role
// @route   DELETE /api/roles/:id
const deleteRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);

  if (!role) {
    res.status(404);
    throw new Error('Role not found');
  }

  // ⭐ Notify users before deletion so they are redirected if needed
  const io = req.app.get("io");
  if (io) {
    const users = await User.find({ role: role._id });
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