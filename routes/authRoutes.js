const express = require('express');
const router = express.Router();

// ⭐ Destructure all functions from the updated authController
const { 
  registerUser,
  registerCompany,    // ⭐ Handles combined Address string and User/Company linking
  loginUser, 
  logoutUser, 
  getMe,
  updatePreferences, 
  forgotPassword, 
  resetPassword   
} = require('../controllers/authController'); 

const { protect } = require('../middleware/authMiddleware');

// ================= AUTH & SESSION =================
// Note: loginUser now sets the 'jwt' cookie and populates company info
router.post('/login', loginUser);   
router.post('/logout', logoutUser); 
router.get('/me', protect, getMe); 
 
// ================= REGISTRATION =================
// Standard registration for users without a company (or assigned later)
router.post('/register', registerUser);            

// ⭐ Main entry for Company Owners: Creates Company and User in one flow
router.post('/register-company', registerCompany); 

// ================= USER SETTINGS =================
router.put('/preferences', protect, updatePreferences);

// ================= PASSWORD RESET =================
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);

module.exports = router;