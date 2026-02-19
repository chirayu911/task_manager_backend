const express = require('express');
const router = express.Router();

// Destructure functions from the controller
const { 
  loginUser, 
  logoutUser, 
  getMe 
} = require('../controllers/userController');

const { protect } = require('../middleware/authMiddleware');

// Auth Routes
router.post('/login', loginUser);  // POST /api/auth/login
router.post('/logout', logoutUser); // POST /api/auth/logout
router.get('/me', protect, getMe);  // GET /api/auth/me

module.exports = router;