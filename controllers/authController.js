const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username }).populate('role');

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    // ⭐ JWT Cookie must match Session Cookie settings for Tunnels
    res.cookie('jwt', token, {
      path: '/',
      httpOnly: true,
      secure: true,      // Must be true for SameSite: 'none'
      sameSite: 'none',  // Required for Dev Tunnels
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password').populate('role');
    if (!user) return res.status(401).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(401).json({ message: 'Not authorized' }); // ⭐ Triggers catch in App.js
  }
};

const logout = (req, res) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0),
    secure: true,
    sameSite: 'none',
  });
  res.status(200).json({ message: "Logged out successfully" });
};

module.exports = { loginUser, getMe, logout };