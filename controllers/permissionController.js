const asyncHandler = require('express-async-handler');
const Permission = require('../models/Permission');

// @desc    Get all permissions
// @route   GET /api/permissions
const getPermissions = asyncHandler(async (req, res) => {
  const permissions = await Permission.find({});
  res.status(200).json(permissions);
  
});

// @desc    Get single permission by ID (CRITICAL FOR EDITING)
// @route   GET /api/permissions/:id
const getPermissionById = asyncHandler(async (req, res) => {
  const permission = await Permission.findById(req.params.id);
  
  if (permission) {
    res.status(200).json(permission);
  } else {
    res.status(404);
    throw new Error('Permission not found');
  }
});

// @desc    Create a permission
// @route   POST /api/permissions
const createPermission = asyncHandler(async (req, res) => {
  const { name, value, status } = req.body;

  if (!name || !value) {
    res.status(400);
    throw new Error('Name and Value are required');
  }

  // Check if value already exists to prevent duplicates
  const permissionExists = await Permission.findOne({ value });
  if (permissionExists) {
    res.status(400);
    throw new Error('Permission value already exists');
  }

  const permission = await Permission.create({
    name,
    value,
    status: status || 1
  }); 

  res.status(201).json(permission);
});

// @desc    Update a permission
// @route   PUT /api/permissions/:id
const updatePermission = asyncHandler(async (req, res) => {

  
  const permission = await Permission.findById(req.params.id);

  if (!permission) {
    res.status(404);
    throw new Error('Permission not found');
  }

  const updatedPermission = await Permission.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true } // Return the updated document
  );

  res.status(200).json(updatedPermission);
});

// @desc    Delete a permission
// @route   DELETE /api/permissions/:id
const deletePermission = asyncHandler(async (req, res) => {
  const permission = await Permission.findById(req.params.id);

  if (!permission) {
    res.status(404);
    throw new Error('Permission not found');
  }

  await permission.deleteOne();

  res.status(200).json({ id: req.params.id });
});

module.exports = {
  getPermissions,
  getPermissionById, 
  createPermission,
  updatePermission,
  deletePermission,
};