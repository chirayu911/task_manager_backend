const Company = require('../models/Company');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Document = require('../models/Document');
const User = require('../models/User');
const asyncHandler = require('express-async-handler');
const path = require('path');
const fs = require('fs');

/**
 * ⭐ UTILITY: Resolve Company ID based on Role
 * If Admin + Header provided: Use Header
 * Otherwise: Use User's assigned company
 */
const resolveCompanyContext = (req) => {
  const roleName = typeof req.user.role === 'object' ? req.user.role?.name : req.user.role;
  const isSystemAdmin = roleName === 'admin' || roleName === 'superadmin' || req.user.permissions?.includes('*');
  const activeHeaderId = req.headers['x-active-company-id'];

  if (isSystemAdmin && activeHeaderId && activeHeaderId !== 'all' && activeHeaderId !== 'null') {
    return { id: activeHeaderId, isSystemAdmin };
  }
  return { id: req.user.company, isSystemAdmin };
};

// @desc    Get all companies
// @route   GET /api/company/all
// @access  Private/Admin
const getAllCompanies = asyncHandler(async (req, res) => {
  const companies = await Company.find({})
    .populate('subscriptionPlan')
    .sort({ createdAt: -1 });

  if (!companies) {
    res.status(404);
    throw new Error('No companies found');
  }

  res.json(companies);
});

// @desc    Get specific company details (Context-Aware)
// @route   GET /api/company/mine
const getMyCompany = asyncHandler(async (req, res) => {
  const { id: companyId } = resolveCompanyContext(req);

  if (!companyId) {
    res.status(404);
    throw new Error('Company context not found');
  }

  const company = await Company.findById(companyId).populate('subscriptionPlan');

  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }

  res.status(200).json(company);
});

// @desc    Update company settings (Timings, Holidays, Details, Logo)
// @route   PUT /api/company/mine
const updateMyCompany = asyncHandler(async (req, res) => {
  // 1. Identify User Role & Global Permission
  const roleName = typeof req.user.role === 'object' ? req.user.role?.name : req.user.role;
  
  // Check for 'admin', 'superadmin', or the '*' permission string
  const isGlobalAdmin = 
    roleName?.toLowerCase() === 'admin' || 
    roleName?.toLowerCase() === 'superadmin' || 
    req.user.permissions?.includes('*');

  // 2. Resolve the Target Company (The "Context")
  const activeHeaderId = req.headers['x-active-company-id'];
  
  // ⭐ THE FIX: If Global Admin, prioritize the Navbar selection (Header).
  // If not, fall back to the user's assigned company.
  const companyId = (isGlobalAdmin && activeHeaderId && activeHeaderId !== 'all') 
    ? activeHeaderId 
    : req.user.company;

  console.log(`🛠️ Update Attempt by ${roleName}. Target Company: ${companyId}`);

  if (!companyId || companyId === 'null') {
    res.status(400);
    throw new Error('No company context. Please select a company from the dropdown.');
  }

  // 3. Permission Bypass
  // Standard check: user.company must match target company.
  // Master check: If isGlobalAdmin is true, SKIP the match check.
  const isTargetOwner = req.user.company?.toString() === companyId.toString();

  if (!isGlobalAdmin && !isTargetOwner) {
    res.status(403);
    throw new Error('Permission Denied: You do not have authority over this company.');
  }

  // 4. Perform the Update
  const company = await Company.findById(companyId);
  if (!company) {
    res.status(404);
    throw new Error('Company not found.');
  }

  // Map the fields (handle JSON strings from FormData)
  const updateData = {
    companyName: req.body.companyName || company.companyName,
    companyEmail: req.body.companyEmail || company.companyEmail,
    phoneNumber: req.body.phoneNumber || company.phoneNumber,
    fullAddress: req.body.fullAddress || company.fullAddress,
    industry: req.body.industry || company.industry,
    themeColor: req.body.themeColor || company.themeColor,
    workingDays: req.body.workingDays ? JSON.parse(req.body.workingDays) : company.workingDays,
    workingHours: req.body.workingHours ? JSON.parse(req.body.workingHours) : company.workingHours,
    breakTimings: req.body.breakTimings ? JSON.parse(req.body.breakTimings) : company.breakTimings,
    holidays: req.body.holidays ? JSON.parse(req.body.holidays) : company.holidays,
  };

  // Only Admin can override these
  if (isGlobalAdmin && req.body.subscriptionPlan) {
    updateData.subscriptionPlan = req.body.subscriptionPlan;
  }

  const updated = await Company.findByIdAndUpdate(
    companyId,
    { $set: updateData },
    { new: true, runValidators: true }
  ).populate('subscriptionPlan');

  res.status(200).json(updated);
});

// @desc    Get current usage statistics
// @route   GET /api/company/usage
const getCompanyUsage = asyncHandler(async (req, res) => {
  const roleName = typeof req.user.role === 'object' ? req.user.role?.name : req.user.role;
  const isSystemAdmin = roleName === 'admin' || roleName === 'superadmin' || req.user.permissions?.includes('*');

  const activeHeaderId = req.headers['x-active-company-id'];
  const companyId = isSystemAdmin && activeHeaderId && activeHeaderId !== 'all' 
    ? activeHeaderId 
    : req.user.company;

  if (!companyId || companyId === 'all') {
    return res.status(200).json({ noContext: true });
  }

  const company = await Company.findById(companyId).populate('subscriptionPlan');
  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }

  // Count existing resources
  const [projectCount, taskCount, documentCount, staffCount] = await Promise.all([
    Project.countDocuments({ company: companyId }),
    Task.countDocuments({ company: companyId }),
    Document.countDocuments({ company: companyId }),
    User.countDocuments({ company: companyId }),
  ]);

  const plan = company.subscriptionPlan || {};

  res.status(200).json({
    planName: plan.name || 'Default Plan',
    status: company.subscriptionStatus || 'active',
    staff: { current: staffCount, max: plan.maxStaff ?? 5 },
    projects: { current: projectCount, max: plan.maxProjects ?? 1 },
    tasks: { current: taskCount, max: plan.maxTasks ?? 50 },
    documents: { current: documentCount, max: plan.maxDocuments ?? 10 },
    hasBulkUpload: plan.hasBulkUpload || false,
  });
});

// @desc    Delete company
const deleteCompany = asyncHandler(async (req, res) => {
  const roleName = typeof req.user.role === 'object' ? req.user.role?.name : req.user.role;
  const isSuperAdmin = req.user.permissions?.includes('*') || roleName === 'admin';
  
  if (!isSuperAdmin) {
    res.status(403);
    throw new Error('Only system admins can delete companies');
  }

  const company = await Company.findById(req.params.id);
  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }

  await company.deleteOne();
  res.status(200).json({ message: 'Company removed successfully' });
});

module.exports = {
  getAllCompanies,
  getMyCompany,
  updateMyCompany,
  getCompanyUsage,
  deleteCompany
};