const Company = require('../models/Company');
const asyncHandler = require('express-async-handler');
const path = require('path');
const fs = require('fs');

// @desc    Get all companies
// @route   GET /api/company/all
// @access  Private/Admin
const getAllCompanies = asyncHandler(async (req, res) => {
  // Find all companies and sort by newest first
  const companies = await Company.find({}).sort({ createdAt: -1 });

  if (!companies) {
    res.status(404);
    throw new Error('No companies found');
  }

  res.json(companies);
});

// @desc    Get logged in user's company details
// @route   GET /api/company/mine
const getMyCompany = asyncHandler(async (req, res) => {
  if (!req.user.company) {
    res.status(404);
    throw new Error('User is not assigned to a company');
  }
  const company = await Company.findById(req.user.company);
  res.status(200).json(company);
});

// @desc    Update company settings (Timings, Holidays, Details, Logo)
// @route   PUT /api/company/mine
const updateMyCompany = asyncHandler(async (req, res) => {
  if (!req.user.isCompanyOwner && !req.user.permissions?.includes('*')) {
    res.status(403);
    throw new Error('Not authorized to update company settings');
  }

  const companyId = req.user.company;
  const company = await Company.findById(companyId);

  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }

  // 1. Extract standard text fields from FormData
  const { companyName, companyEmail, phoneNumber, fullAddress, industry } = req.body;

  // 2. Safely parse the JSON strings sent by frontend FormData
  let workingDays, workingHours, breakTimings, holidays;
  try {
    if (req.body.workingDays) workingDays = JSON.parse(req.body.workingDays);
    if (req.body.workingHours) workingHours = JSON.parse(req.body.workingHours);
    if (req.body.breakTimings) breakTimings = JSON.parse(req.body.breakTimings);
    if (req.body.holidays) holidays = JSON.parse(req.body.holidays);
  } catch (err) {
    res.status(400);
    throw new Error('Invalid JSON formatting in settings data');
  }

  // 3. Build the update object dynamically
  const updateData = {
    companyName, 
    companyEmail, 
    phoneNumber, 
    fullAddress, 
    industry,
    ...(workingDays && { workingDays }),
    ...(workingHours && { workingHours }),
    ...(breakTimings && { breakTimings }),
    ...(holidays && { holidays }),
  };

  // 4. Handle Logo Upload & Old Logo Cleanup
  if (req.file) {
    // Check for existing logo (handles both logoUrl or logo naming conventions)
    const existingLogo = company.logoUrl || company.logo;
    
    if (existingLogo) {
      const oldPath = path.join(__dirname, '..', existingLogo);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath); // Deletes the old file from the server
      }
    }
    // Save the new relative path to the database
    updateData.logoUrl = `uploads/logos/${req.file.filename}`;
  }

  // 5. Update the database
  const updatedCompany = await Company.findByIdAndUpdate(
    companyId,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  res.status(200).json(updatedCompany);
});

module.exports = { getAllCompanies, getMyCompany, updateMyCompany };