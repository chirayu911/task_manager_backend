const asyncHandler = require('express-async-handler');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Get all audit logs
 * @route   GET /api/admin/audit-logs
 * @access  Private (Super Admin)
 */
const getAuditLogs = asyncHandler(async (req, res) => {
  const { company, user, action, startDate, endDate, page = 1, limit = 50 } = req.query;

  const User = require('../models/User');
  const userDoc = await User.findById(req.user._id).populate('role');
  
  const roleName = userDoc.role?.name;
  const isGlobalAdmin = roleName === 'admin' || userDoc.role?.permissions?.includes('*');
  const isCompanyOwner = userDoc.isCompanyOwner;
  const isCompanyAdmin = roleName === 'admin';

  if (!isGlobalAdmin && !isCompanyOwner && !isCompanyAdmin) {
    res.status(403);
    throw new Error('Access strictly limited to Admin or Company Owner');
  }

  let query = {};
  
  // Scope logs to company if the user is a Company Owner or Admin but not a Global Admin
  if (!isGlobalAdmin && (isCompanyOwner || isCompanyAdmin)) {
    query.company = userDoc.company;
  } else if (company) {
    query.company = company;
  }

  if (user) query.user = user;
  if (action) query.action = action;

  if (startDate && endDate) {
    query.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const pageNumber = parseInt(page);
  const limitNumber = parseInt(limit);
  const skip = (pageNumber - 1) * limitNumber;

  const logs = await AuditLog.find(query)
    .populate('user', 'name email')
    .populate('company', 'companyName companyEmail')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNumber)
    .lean();

  const totalLogs = await AuditLog.countDocuments(query);

  res.status(200).json({
    logs,
    totalLogs,
    totalPages: Math.ceil(totalLogs / limitNumber),
    currentPage: pageNumber
  });
});

module.exports = {
  getAuditLogs
};
