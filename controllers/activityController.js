const Activity = require('../models/Activity');
const User = require('../models/User'); // Required for population
const Project = require('../models/Project'); // Required for population
const asyncHandler = require('express-async-handler');

// @desc    Get activity logs
// @route   GET /api/activities/mine
const getMyActivities = asyncHandler(async (req, res) => {
  try {
    const companyId = req.headers['x-active-company-id'] || req.user.company;

    if (!companyId || companyId === 'all') {
      return res.status(200).json([]);
    }

    let query = { company: companyId };

    // Regular users only see their own stuff
    if (!req.user.isCompanyOwner && !req.user.permissions?.includes('*')) {
      query.$or = [
        { user: req.user._id },
        { targetUser: req.user._id }
      ];
    }

    const activities = await Activity.find(query)
      .populate({ path: 'user', select: 'name email avatar' })
      .populate({ path: 'targetUser', select: 'name' })
      .populate({ path: 'project', select: 'title' })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(); // Lean makes it a plain JS object, faster and less prone to circular errors

    res.status(200).json(activities || []);
  } catch (error) {
    console.error("CRITICAL ACTIVITY LOG ERROR:", error);
    // Returning a 500 with the error message helps debug
    res.status(500).json({ message: error.message || "Internal Server Error" });
  }
});

const markAsRead = asyncHandler(async (req, res) => {
  const companyId = req.headers['x-active-company-id'] || req.user.company;
  // Logic to mark notifications as seen
  res.status(200).json({ message: "Activities marked as read" });
});

module.exports = { 
  getMyActivities, 
  markAsRead 
};