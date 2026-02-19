const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

/**
 * @desc    Authenticate User & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body; // ⭐ Ensure frontend sends 'email'

    // 1. Check if user exists
    const user = await User.findOne({ username });

    if (!user) {
      console.warn(`Login attempt failed: User with username ${username} not found.`);
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // 2. Compare Passwords using Bcrypt
    // ⭐ Important: user.password is the hashed string from DB
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.warn(`Login attempt failed: Incorrect password for ${username}.`);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // 3. Generate JWT Token
    const token = jwt.sign(
      { id: user._id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '30d' }
    );

    // 4. Set HTTP-Only Cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    // 5. Return user data (excluding password)
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });

  } catch (error) {
    console.error("Login Controller Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

/**
 * @desc    Logout user / clear cookie
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = (req, res) => {
  res.cookie('token', '', { httpOnly: true, expires: new Date(0) });
  res.json({ message: 'Logged out successfully' });
};

module.exports = { loginUser, getMe, logout };