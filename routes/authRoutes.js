const express = require('express');
const router = express.Router();

// Destructure functions from the controller
const { 
  loginUser, 
  logoutUser, 
  getMe,
  forgotPassword, 
  resetPassword   
} = require('../controllers/userController'); 

const { protect } = require('../middleware/authMiddleware');

// Auth Routes
router.post('/login', loginUser);   
router.post('/logout', logoutUser); 
router.get('/me', protect, getMe);  

// Password Reset Routes
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);

module.exports = router;