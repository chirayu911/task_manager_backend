const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { sendEmail } = require('../utils/sendEmail');

// Generate JWT Helper
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d', // Token expires in 30 days
  });
};

/**
 * @desc    Register new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, username } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Please add all required fields');
  }

  // Check if user already exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  // Create user (Password hashing is handled automatically by the pre-save hook in the User model)
  const user = await User.create({
    name,
    email,
    password,
    username,
    // Note: If you have a default role (like 'staff'), you can assign its ObjectId here
  });

  if (user) {
    res.status(201).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

/**
 * @desc    Authenticate a user
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = asyncHandler(async (req, res) => {
  // ⭐ UPDATED: Accept either email or username from the frontend request
  const { email, username, password } = req.body;
  
  const loginIdentifier = username || email;

  if (!loginIdentifier || !password) {
    res.status(400);
    throw new Error('Please provide a username/email and password');
  }

  // ⭐ UPDATED: Check for user by matching EITHER the email or the username field
  const user = await User.findOne({ 
    $or: [
      { email: loginIdentifier }, 
      { username: loginIdentifier }
    ] 
  }).populate('role').select('+password');

  // Check password using the method we created in the User model
  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      permissions: user.permissions,
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error('Invalid credentials');
  }
});

/**
 * @desc    Get current logged in user data
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = asyncHandler(async (req, res) => {
  // req.user is set by your authMiddleware
  const user = await User.findById(req.user.id).populate('role');
  res.status(200).json(user);
});

/**
 * @desc    Forgot Password - Generates token and sends email
 * @route   POST /api/auth/forgotpassword
 * @access  Public
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    // Return a 200 even if the user isn't found to prevent email enumeration attacks by hackers
    return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
  }

  // Get unhashed token (this method also sets the hashed token and expiration on the user object)
  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  // Create reset URL targeting your React frontend
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

  const message = `
    <h1>TaskFlow - Password Reset</h1>
    <p>You requested a password reset. Please click on the following link to reset your password. This link is valid for 15 minutes.</p>
    <a href=${resetUrl} clicktracking=off>${resetUrl}</a>
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
    
    // If the email fails to send, clear the token from the database so it can't be exploited
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(500);
    throw new Error('Email could not be sent. Please contact an administrator.');
  }
});

/**
 * @desc    Reset Password - Verifies token and saves new password
 * @route   PUT /api/auth/resetpassword/:resettoken
 * @access  Public
 */
const resetPassword = asyncHandler(async (req, res) => {
  // Reconstruct the hashed token from the URL parameter to compare with the one saved in the database
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.resettoken)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }, // Ensure the token hasn't expired yet
  });

  if (!user) {
    res.status(400);
    throw new Error('Invalid or expired reset token');
  }

  // Set the new password (the pre-save hook in the User model will automatically hash it)
  user.password = req.body.password;
  
  // Clear the reset token fields so the link cannot be used a second time
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  res.status(200).json({ message: 'Password reset successful. You can now log in.' });
});

module.exports = {
  registerUser,
  loginUser,
  getMe,
  forgotPassword,
  resetPassword,
};