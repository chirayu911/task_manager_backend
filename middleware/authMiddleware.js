const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

const protect = asyncHandler(async (req, res, next) => {
  // Access the cookie named 'jwt'
  let token = req.cookies.jwt;

  if (token) {
    try {
      // 1. Verify token
      const decoded = jwt.verify(token, import.meta.env.JWT_SECRET);

      // 2. Get user from the token (exclude password)
      // Ensure 'role' exists in your User model if using .populate()
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        res.status(401);
        throw new Error('Not authorized, user not found');
      }

      next();
    } catch (error) {
      console.error("JWT Verification Error:", error.message);
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
  } else {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

module.exports = { protect };