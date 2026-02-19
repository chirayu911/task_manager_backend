const express = require('express');
const router = express.Router();
const {
  getPermissions,
  getPermissionById, 
  createPermission,
  updatePermission,
  deletePermission,
} = require('../controllers/permissionController');

const { protect } = require('../middleware/authMiddleware');

// Base Route: /api/permissions
router.route('/')
  .get(protect, getPermissions)
  .post(protect, createPermission);

// ID Route: /api/permissions/:id
router.route('/:id')
  .get(protect, getPermissionById) // <--- This enables the Edit page to load data
  .put(protect, updatePermission)
  .delete(protect, deletePermission);

module.exports = router;