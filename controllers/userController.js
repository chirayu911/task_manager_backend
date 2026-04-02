const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Company = require('../models/Company'); // ⭐ CRITICAL: Import this to register the schema
const Role = require('../models/Role');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Destructure both email functions from your utility file
const { sendWelcomeEmail, sendEmail } = require('../utils/sendEmail');

// ================= PERMISSION HELPER =================
const getFlattenedPermissions = async (roleId, isCompanyOwner = false) => {
  // ⭐ If the user is a Company Owner, they automatically get the wildcard permission
  if (isCompanyOwner) return ['*'];
  
  if (!roleId) return [];
  try {
    const roleObj = await Role.findById(roleId).populate('permissions');
    if (!roleObj || !roleObj.permissions) return [];
    return roleObj.permissions.map(p => (p.value ? p.value : p));
  } catch (error) {
    console.error("Permission Mapping Error:", error);
    return [];
  }
};

// userController.js
exports.updatePreference = async (req, res) => {
  try {
    const { autoSaveEnabled } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { 'preferences.autoSaveEnabled': autoSaveEnabled },
      { new: true }
    );
    res.status(200).json(user.preferences);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= LOGIN =================
const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  const loginIdentifier = username || email;

  if (!loginIdentifier || !password) {
    res.status(400);
    throw new Error('Please provide a username/email and password');
  }

  const user = await User.findOne({ 
    $or: [
      { email: loginIdentifier }, 
      { username: loginIdentifier }
    ] 
  }).populate('role').select('+password');

  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401);
    throw new Error('Invalid username or password');
  }

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  const permissions = await getFlattenedPermissions(user.role?._id, user.isCompanyOwner);

  res.cookie('jwt', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });

  res.json({
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    profilePicture: user.profilePicture,
    role: user.role?.name || 'No Role',
    company: user.company,       // ⭐ Include company ID in response
    isCompanyOwner: user.isCompanyOwner, // ⭐ Include owner status
    permissions
  });
});

// ================= LOGOUT =================
const logoutUser = asyncHandler(async (req, res) => {
  res.cookie('jwt', '', { 
    httpOnly: true, 
    secure: true, 
    sameSite: 'none', 
    expires: new Date(0) 
  });
  res.json({ message: 'Logged out' });
});

// ================= GET ME =================
const getMe = asyncHandler(async (req, res) => {
  // ⭐ FIX: Added .populate('company') to ensure the full object is returned
  const user = await User.findById(req.user.id || req.user._id)
    .populate('role')
    .populate('company') 
    .select('-password');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const permissions = await getFlattenedPermissions(user.role?._id);

  res.json({
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    profilePicture: user.profilePicture,
    role: user.role?.name || 'No Role',
    // ⭐ Flatten permissions and handle Owner wildcard
    permissions: user.isCompanyOwner ? ['*'] : permissions,
    isCompanyOwner: user.isCompanyOwner,
    company: user.company // This will now be the full Company object
  });
});

// ================= GET USERS (Scoped to Company) =================
const getUsers = asyncHandler(async (req, res) => {
  // ⭐ Filter: Only return users belonging to the requester's company
  const users = await User.find({ company: req.user.company })
    .populate('role', 'name')
    .select('-password');
  res.json(users);
});

// ================= GET USER BY ID (Scoped to Company) =================
const getUserById = asyncHandler(async (req, res) => {
  // ⭐ Secure check: Target user must belong to the requester's company
  const user = await User.findOne({ 
    _id: req.params.id, 
    company: req.user.company 
  })
    .populate('role', 'name')
    .select('-password');

  if (!user) {
    res.status(404);
    throw new Error('User not found or access denied');
  }
  res.json(user);
});

// ================= CREATE USER (Auto-Assign Company) =================
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, username, role } = req.body;

  if (!name || !email || !username || !role) {
    res.status(400);
    throw new Error('Missing required fields');
  }

  const exists = await User.findOne({ $or: [{ email }, { username }] });
  if (exists) {
    res.status(400);
    throw new Error('User already exists');
  }

  // Prevent assigning admin or superadmin role
  if (role) {
    const roleObj = await Role.findById(role);
    if (roleObj && ['admin', 'superadmin'].includes(roleObj.name.toLowerCase())) {
      res.status(403);
      throw new Error('You are not authorized to assign the admin role.');
    }
  }

  const plainPassword = crypto.randomBytes(5).toString('hex');

  // ⭐ Auto-assign the creator's company to the new user
  const user = await User.create({
    name,
    email,
    username,
    password: plainPassword,
    role,
    company: req.user.company, // ⭐ Link to same company
    isCompanyOwner: false      // Newly created staff aren't company owners
  });

  if (user) {
    const io = req.app.get("io");
    if (io) io.emit("staffChanged"); 

    try {
      if (typeof sendWelcomeEmail === 'function') {
       sendWelcomeEmail(user.email, user.name, user.username, plainPassword);
      }
    } catch (emailErr) {
      console.error("Email failed:", emailErr.message);
    }

    res.status(201).json({ 
      success: true, 
      message: "User created successfully.",
      user: { _id: user._id, name: user.name }
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

// ================= UPDATE USER (Scoped to Company) =================
const updateUser = asyncHandler(async (req, res) => {
  // ⭐ Ensure the user being updated belongs to the requester's company
  const user = await User.findOne({ 
    _id: req.params.id, 
    company: req.user.company 
  });

  if (!user) {
    res.status(404);
    throw new Error('User not found or access denied');
  }

  const oldRoleId = user.role?.toString();
  
  user.name = req.body.name || user.name;
  user.email = req.body.email || user.email;
  user.username = req.body.username || user.username;

  // Prevent updating role TO admin or superadmin
  if (req.body.role && req.body.role !== oldRoleId) {
    const roleObj = await Role.findById(req.body.role);
    if (roleObj && ['admin', 'superadmin'].includes(roleObj.name.toLowerCase())) {
      res.status(403);
      throw new Error('You are not authorized to assign the admin role.');
    }
    user.role = req.body.role;
  }

  if (req.body.password) {
    user.password = req.body.password;
  }

  const updatedUser = await user.save();

  const io = req.app.get("io");
  if (io) {
    io.emit("staffChanged");
    if (req.body.role && req.body.role !== oldRoleId) {
      io.to(updatedUser._id.toString()).emit("permissionsUpdated");
    }
  }

  res.json({ message: "User updated successfully" });
});

// ================= UPDATE OWN PROFILE =================
const updateProfile = asyncHandler(async (req, res) => {
  const updateData = {};
  
  if (req.body.name) updateData.name = req.body.name;
  if (req.body.username) updateData.username = req.body.username;
  if (req.file) updateData.profilePicture = req.file.path.replace(/\\/g, "/");

  const updatedUser = await User.findByIdAndUpdate(
    req.user.id || req.user._id,
    { $set: updateData },
    { new: true, runValidators: true }
  ).select('-password');

  if (!updatedUser) {
    res.status(404);
    throw new Error('User not found');
  }

  res.json({
    _id: updatedUser._id,
    name: updatedUser.name,
    username: updatedUser.username,
    email: updatedUser.email,
    profilePicture: updatedUser.profilePicture,
    message: "Profile updated successfully"
  });
});

// ================= DELETE USER (Scoped to Company) =================
const deleteUser = asyncHandler(async (req, res) => {
  // ⭐ Verify target user is in the same company
  const user = await User.findOne({ 
    _id: req.params.id, 
    company: req.user.company 
  });

  if (!user) {
    res.status(404);
    throw new Error('User not found or access denied');
  }

  // Prevent owners from accidentally deleting themselves via the staff panel
  if (user._id.toString() === req.user._id.toString()) {
    res.status(400);
    throw new Error('You cannot delete your own account from here');
  }

  const userId = user._id.toString();
  await user.deleteOne();

  const io = req.app.get("io");
  if (io) {
    io.emit("staffChanged");
    io.to(userId).emit("forceLogout"); 
  }

  res.json({ message: 'User removed successfully' });
});

// ================= FORGOT PASSWORD =================
const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
  }

  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

  const message = `
    <h1>Task Manager - Password Reset</h1>
    <p>You requested a password reset. Please click on the following link to reset your password. This link is valid for 15 minutes.</p>
    <a href="${resetUrl}">${resetUrl}</a>
    <p>If you did not request this, please ignore this email.</p>
  `;

  try {
    await sendEmail({
      to: user.email,
      subject: 'Task Manager - Password Reset Request',
      text: message,
    });

    res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error("EMAIL SEND ERROR:", error);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(500);
    throw new Error('Email could not be sent. Please contact an administrator.');
  }
});

// ================= RESET PASSWORD =================
const resetPassword = asyncHandler(async (req, res) => {
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.resettoken)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    res.status(400);
    throw new Error('Invalid or expired reset token');
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  res.status(200).json({ message: 'Password reset successful. You can now log in.' });
});

// @desc    Get all staff/users (Scoped to Active Company)
// @route   GET /api/user
const getAllStaff = asyncHandler(async (req, res) => {
  // ⭐ SAFETY CHECK 1: Ensure req.user exists (Auth Middleware check)
  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized, user missing');
  }

  try {
    const activeCompanyId = req.headers['x-active-company-id'];
    
    // ⭐ SAFETY CHECK 2: Handle potential undefined role safely
    const userRole = req.user.role;
    const roleName = typeof userRole === 'object' ? userRole?.name : userRole;
    
    // Check if system admin or superadmin
    const isSystemAdmin = roleName === 'admin' || roleName === 'superadmin' || req.user.permissions?.includes('*');

    let query = {};

    // Filtering logic
    if (isSystemAdmin && activeCompanyId) {
      // If Admin and specific company selected, show that company's staff
      query.company = activeCompanyId;
    } else {
      // Regular owners/staff only see their own company
      query.company = req.user.company;
    }

    const users = await User.find(query)
      .select('-password') 
      .populate({ path: 'company', select: 'companyName' })
      .populate('role', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(users || []);
  } catch (error) {
    console.error("BACKEND ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
});

module.exports = { 
  loginUser, 
  logoutUser, 
  getMe, 
  getUsers, 
  getUserById, 
  registerUser, 
  updateUser, 
  updateProfile,
  deleteUser,
  forgotPassword, 
  resetPassword,
  getAllStaff   
};