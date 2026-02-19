const express = require('express');
const router = express.Router();
const {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
} = require('../controllers/roleController');

const { protect } = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/checkPermission');

// ---------------------------------------------------------
// ROUTE: /api/roles
// ---------------------------------------------------------
router.route('/')
  // Anyone logged in can GET roles (needed for dropdowns in StaffForm)
  .get(protect, getRoles) 
  
  // Only users with 'roles_create' can POST a new role
  .post(protect, checkPermission('roles_create'), createRole);

// ---------------------------------------------------------
// ROUTE: /api/roles/:id
// ---------------------------------------------------------
router.route('/:id')
  // Users with 'roles_read' (or implicitly allowed via UI) can view specific role
  .get(protect, checkPermission('roles_read'), getRoleById)
  
  // Only users with 'roles_update' can PUT/update role permissions/names
  .put(protect, checkPermission('roles_update'), updateRole) 
  
  // Only users with 'roles_delete' can remove a role from the system
  .delete(protect, checkPermission('roles_delete'), deleteRole);

module.exports = router;