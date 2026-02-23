const asyncHandler = require('express-async-handler');
const Permission = require('../models/Permission');

const getPermissions = asyncHandler(async (req, res) => {
  const permissions = await Permission.find({});
  res.status(200).json(permissions);
});

const getPermissionById = asyncHandler(async (req, res) => {
  const permission = await Permission.findById(req.params.id);
  if (permission) {
    res.status(200).json(permission);
  } else {
    res.status(404);
    throw new Error('Permission not found');
  }
});

const createPermission = asyncHandler(async (req, res) => {
  const { name, value, status } = req.body;

  if (!name || !value) {
    res.status(400);
    throw new Error('Name and Value are required');
  }

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

  // ⭐ Real-time Sync
  const io = req.app.get('io');
  if (io) io.emit('permissionsUpdated');

  res.status(201).json(permission);
});

const updatePermission = asyncHandler(async (req, res) => {
  const permission = await Permission.findById(req.params.id);

  if (!permission) {
    res.status(404);
    throw new Error('Permission not found');
  }

  const updatedPermission = await Permission.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true } 
  );

  // ⭐ Real-time Sync
  const io = req.app.get('io');
  if (io) io.emit('permissionsUpdated');

  res.status(200).json(updatedPermission);
});

const deletePermission = asyncHandler(async (req, res) => {
  const permission = await Permission.findById(req.params.id);

  if (!permission) {
    res.status(404);
    throw new Error('Permission not found');
  }

  await permission.deleteOne();

  // ⭐ Real-time Sync
  const io = req.app.get('io');
  if (io) io.emit('permissionsUpdated');

  res.status(200).json({ id: req.params.id });
});

module.exports = {
  getPermissions,
  getPermissionById, 
  createPermission,
  updatePermission,
  deletePermission,
};