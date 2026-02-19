const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Role = require('../models/Role');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const sendWelcomeEmail = require('../utils/sendEmail');

// ================= PERMISSION HELPER =================
/**
 * Since the User model stores role as an ObjectId, we find the Role 
 * by its _id and populate its permissions.
 */
const getFlattenedPermissions = async (roleId) => {
  if (!roleId) return [];
  
  const roleObj = await Role.findById(roleId).populate('permissions');
  if (!roleObj || !roleObj.permissions) return [];

  return roleObj.permissions.map(p => (p.value ? p.value : p));
};

// ================= LOGIN =================
const loginUser = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // Populate 'role' to get the role name (e.g., 'admin')
  const user = await User.findOne({ username }).populate('role');

  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

  // Use the ID from the populated role object
  const permissions = await getFlattenedPermissions(user.role._id);

  res.cookie('jwt', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });

  res.json({
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role.name, // Returns the string name for the frontend
    permissions
  });
});

// ================= LOGOUT =================
const logoutUser = asyncHandler(async (req, res) => {
  res.cookie('jwt', '', { httpOnly: true, expires: new Date(0) });
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
  // Populate role to show the role name in the staff list
  const users = await User.find().populate('role', 'name').select('-password');
  res.json(users);
});

// ================= GET USER BY ID =================
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).populate('role').select('-password');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  res.json(user);
});

// ================= CREATE USER =================
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, username, role } = req.body; // 'role' here should be the Role's ObjectId

  if (!name || !email || !username || !role) {
    res.status(400);
    throw new Error('Missing required fields');
  }

  const exists = await User.findOne({ $or: [{ email }, { username }] });
  if (exists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const plainPassword = crypto.randomBytes(5).toString('hex');
  const hashed = await bcrypt.hash(plainPassword, 10);

  const user = await User.create({
    name,
    email,
    username,
    password: hashed,
    role // Save as ObjectId
  });

  if (user) {
    try {
      if (typeof sendWelcomeEmail === 'function') {
        await sendWelcomeEmail(user.email, user.name, user.username, plainPassword);
      }
    } catch (emailErr) {
      console.error("Email failed:", emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: "User created and credentials emailed.",
      user: {
        _id: user._id,
        name: user.name,
        role: user.role // This will be the ID
      }
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data received');
  }
});

// ================= UPDATE USER =================
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  user.name = req.body.name || user.name;
  user.email = req.body.email || user.email;
  user.username = req.body.username || user.username;
  user.role = req.body.role || user.role; // Update with new Role ObjectId

  if (req.body.password) {
    user.password = await bcrypt.hash(req.body.password, 10);
  }

  await user.save();
  res.json({ message: "User updated successfully" });
});

// ================= DELETE USER =================
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  await user.deleteOne();
  res.json({ message: 'User removed successfully' });
});

module.exports = {
  loginUser,
  logoutUser,
  getMe,
  getUsers,
  getUserById,
  registerUser,
  updateUser,
  deleteUser
};