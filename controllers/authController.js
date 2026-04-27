const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Company = require('../models/Company'); 
const Attendance = require('../models/Attendance');
const { sendEmail } = require('../utils/sendEmail');
const logAudit = require('../utils/auditLogger');


// Generate JWT Helper
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d', 
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

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const user = await User.create({
    name,
    email,
    password,
    username,
  });

  if (user) {
    res.status(201).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      preferences: user.preferences || {},
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
  const { email, username, password } = req.body;
  const loginIdentifier = username || email;

  const user = await User.findOne({ 
    $or: [{ email: loginIdentifier }, { username: loginIdentifier }] 
  }).populate('role').populate('company').select('+password');

  if (user && (await user.matchPassword(password))) {
    const token = generateToken(user._id);

    res.cookie('jwt', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000 
    });

    await logAudit(req, {
      user: user._id,
      company: user.company,
      action: 'LOGIN',
      resourceType: 'Auth',
      description: `User ${user.email} logged in.`,
    });

    // Record attendance
    if (user.company) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let statusToSet = 'present';
      if (user.company.workingHours) {
        const now = new Date();
        const currentHH = String(now.getHours()).padStart(2, '0');
        const currentMM = String(now.getMinutes()).padStart(2, '0');
        const currentStr = `${currentHH}:${currentMM}`;
        
        const { start, end } = user.company.workingHours;
        
        if (start <= end) {
          if (currentStr < start || currentStr > end) {
            statusToSet = 'absent';
          }
        } else {
          // Night shift cross-midnight logic (e.g. 22:00 to 06:00)
          if (currentStr < start && currentStr > end) {
            statusToSet = 'absent';
          }
        }
      }

      await Attendance.findOneAndUpdate(
        { user: user._id, date: today },
        { 
          $setOnInsert: { 
            company: user.company,
            status: statusToSet,
            loginTime: new Date()
          } 
        },
        { upsert: true, new: true }
      );
    }

    res.json({
      _id: user.id,
      name: user.name,
      email: user.email,
      profilePicture: user.profilePicture,
      company: user.company,
      isCompanyOwner: user.isCompanyOwner,
      preferences: user.preferences,
      permissions: user.isCompanyOwner ? ['*'] : (user.role?.permissions || []),
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
  const user = await User.findById(req.user.id || req.user._id)
    .populate('role')
    .populate('company')
    .select('-password');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  res.json({
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    profilePicture: user.profilePicture,
    role: user.role?.name || 'No Role',
    permissions: user.isCompanyOwner ? ['*'] : (user.role?.permissions || []), 
    preferences: user.preferences,
    isCompanyOwner: user.isCompanyOwner,
    company: user.company
  });
});

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Public
 */
const logoutUser = asyncHandler(async (req, res) => {
  // If the route was protected, we could use req.user. Since it might not be, we log what we can.
  // Using decoding cookie logic is optional, but capturing IP and event is standard.
  await logAudit(req, {
    action: 'LOGOUT',
    resourceType: 'Auth',
    description: `User logged out.`,
  });

  res.cookie('jwt', '', { httpOnly: true, expires: new Date(0) });
  res.status(200).json({ message: 'Logged out successfully' });
});

/**
 * @desc    Update User Preferences
 * @route   PUT /api/auth/preferences
 * @access  Private
 */
const updatePreferences = asyncHandler(async (req, res) => {
  const { autoSaveEnabled } = req.body;

  // Use dot notation to update only the specific nested field
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { "preferences.autoSaveEnabled": autoSaveEnabled } },
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.status(200).json({ 
    message: "Preferences updated", 
    preferences: user.preferences 
  });
});
/**
 * @desc    Register a new company and its owner
 * @route   POST /api/auth/register-company
 * @access  Public
 */
const registerCompany = asyncHandler(async (req, res) => {
  const {
    companyName, owner, username, email, password,
    streetAddress, city, state, zipCode, country,
    phoneNumber, nominalCapital, industry, companyEmail
  } = req.body;

  if (!username || !email || !password || !companyName || !companyEmail) {
    res.status(400);
    throw new Error('Please fill out all required fields.');
  }

  // Check if User already exists
  const userExists = await User.findOne({ $or: [{ email }, { username }] });
  if (userExists) {
    res.status(400);
    throw new Error('Email or Username is already taken by a user account.');
  }

  // ⭐ FIX 1: Check if Company Email already exists
  const companyExists = await Company.findOne({ companyEmail });
  if (companyExists) {
    res.status(400);
    throw new Error('A company with this email is already registered.');
  }

  // Combine Address fields into one string
  const fullAddress = `${streetAddress}, ${city}, ${state} ${zipCode}, ${country}`;

  // Create the Company first (to get the ID)
  const company = await Company.create({
    companyName,
    ownerName: owner,
    fullAddress, 
    companyEmail, 
    phoneNumber, 
    nominalCapital, 
    industry
  });

  // ⭐ FIX 2: Removed the invalid `role: ['company owner']` which caused the ObjectId CastError.
  // We use a try/catch block to delete the company if user creation fails, preventing "ghost" companies.
  let user;
  try {
    user = await User.create({
      name: owner,
      email,
      username, 
      password,
      company: company._id, // Linking here satisfies 'required: true'
      isCompanyOwner: true
    });
  } catch (error) {
    // Rollback: Delete the company if the user failed to create
    await Company.findByIdAndDelete(company._id);
    res.status(400);
    throw new Error(error.message || 'Failed to create user account. Company registration aborted.');
  }

  // Finalize Company owner link
  company.ownerId = user._id;
  await company.save();

  // Log the user in immediately by generating a token
  const token = generateToken(user._id);
  res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    maxAge: 30 * 24 * 60 * 60 * 1000 
  });

  await logAudit(req, {
    user: user._id,
    company: company._id,
    action: 'COMPANY_REGISTERED',
    resourceType: 'Company',
    resourceId: company._id,
    afterState: company.toObject(),
    description: `Company ${companyName} registered with owner ${email}.`,
  });

  res.status(201).json({
    message: 'Company and Owner registered successfully',
    _id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
     preferences: user.preferences,
    isCompanyOwner: user.isCompanyOwner,
    company: company,
    token // Sending token back just in case your frontend requires it
  });
});

/**
 * @desc    Forgot Password
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(200).json({ message: 'Email sent if user exists.' });

  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

  const message = `<h1>Password Reset Request</h1><p>Click below to reset:</p><a href="${resetUrl}">${resetUrl}</a>`;

  try {
    await sendEmail({
      to: user.email,
      subject: 'Task Manager - Password Reset Request',
      text: message,
    });
    res.status(200).json({ message: 'Reset link has been sent.' });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    res.status(500);
    throw new Error('Email could not be sent.');
  }
});

/**
 * @desc    Reset Password
 */
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

  res.status(200).json({ message: 'Password reset successful.' });
});

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  updatePreferences,
  registerCompany,
  forgotPassword,
  resetPassword,
};