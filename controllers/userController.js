const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Role = require('../models/Role');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Destructure both email functions from your utility file
const { sendWelcomeEmail, sendEmail } = require('../utils/sendEmail');

// ================= PERMISSION HELPER =================
const getFlattenedPermissions = async (roleId) => {
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

// ================= LOGIN =================
const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  
  const loginIdentifier = username || email;

  if (!loginIdentifier || !password) {
    res.status(400);
    throw new Error('Please provide a username/email and password');
  }

  // Find user by username OR email, and explicitly select the hidden password field
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
  const permissions = await getFlattenedPermissions(user.role?._id);

  res.cookie('jwt', token, {
    httpOnly: true,
    secure: true,      // Must be true for 'none' sameSite
    sameSite: 'none',  // Essential for Dev Tunnels/Cross-site
    maxAge: 30 * 24 * 60 * 60 * 1000
  });

  res.json({
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role?.name || 'No Role',
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
  const user = await User.findById(req.user.id || req.user._id)
    .populate('role')
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
    role: user.role?.name || 'No Role',
    permissions
  });
});

// ================= GET USERS =================
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find().populate('role', 'name').select('-password');
  res.json(users);
});

// ================= GET USER BY ID =================
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .populate('role', 'name')
    .select('-password');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  res.json(user);
});

// ================= CREATE USER =================
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

  // Generate Plain Password
  const plainPassword = crypto.randomBytes(5).toString('hex');

  const user = await User.create({
    name,
    email,
    username,
    password: plainPassword, // Mongoose pre('save') hook handles the hashing
    role
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

// ================= UPDATE USER =================
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const oldRoleId = user.role?.toString();
  
  user.name = req.body.name || user.name;
  user.email = req.body.email || user.email;
  user.username = req.body.username || user.username;
  user.role = req.body.role || user.role;

  if (req.body.password) {
    // Setting the password here triggers the Mongoose pre-save hook to hash it automatically
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

// ================= DELETE USER =================
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
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

  // Safely remove any trailing slashes from the FRONTEND_URL to prevent double-slash bugs
  const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

  // Message includes safe quotation marks around the href attribute
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

module.exports = { 
  loginUser, 
  logoutUser, 
  getMe, 
  getUsers, 
  getUserById, 
  registerUser, 
  updateUser, 
  deleteUser,
  forgotPassword, 
  resetPassword   
};