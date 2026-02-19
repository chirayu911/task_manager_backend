const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  getUsers,
  getUserById, // <--- This was missing before
  updateUser,
  deleteUser,
} = require('../controllers/userController');

const { protect } = require('../middleware/authMiddleware');

// Public Routes (Login/Logout)
router.post('/login', loginUser);
router.post('/logout', logoutUser);

// Protected Routes
router.get('/me', protect, getMe);

// Admin Routes for User Management
router.route('/')
  .get(protect, getUsers)       // Fetch all users for the list
  .post(protect, registerUser); // Create a new user

router.route('/:id')
  .get(protect, getUserById)    // <--- Fixes the "Edit" button 404 error
  .put(protect, updateUser)     // Update user details
  .delete(protect, deleteUser); // Remove user

module.exports = router;