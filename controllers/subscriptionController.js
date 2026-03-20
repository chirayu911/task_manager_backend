const Subscription = require('../models/Subscription');
const Company = require('../models/Company'); // ⭐ Required for assigning plans to companies

// @desc    Create a new subscription plan
// @route   POST /api/subscriptions
exports.createSubscription = async (req, res) => {
  try {
    // ⭐ Added new usage limit fields: maxStaff, maxTeamMembersPerProject, hasBulkUpload
    const { 
      name, price, cycle, status, features, 
      maxProjects, maxTasks, maxDocuments, 
      maxStaff, maxTeamMembersPerProject, hasBulkUpload 
    } = req.body;

    // Backend Validation Check
    if (!name || price === undefined || !features || features.length === 0) {
      return res.status(400).json({ message: "Name, price, and at least one feature are required." });
    }

    const newSubscription = new Subscription({
      name,
      price,
      cycle,
      status,
      features,
      maxProjects,
      maxTasks,
      maxDocuments,
      maxStaff,                  // ⭐ NEW: Total global staff limit
      maxTeamMembersPerProject,  // ⭐ NEW: Per-project team limit
      hasBulkUpload              // ⭐ NEW: Feature toggle
    });

    const savedSubscription = await newSubscription.save();
    res.status(201).json(savedSubscription);
  } catch (error) {
    res.status(500).json({ message: error.message || "Internal server error while creating plan." });
  }
};

// @desc    Get all subscription plans (Admin View)
// @route   GET /api/subscriptions
exports.getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find().sort({ price: 1 }); // Sorts by price ascending
    res.status(200).json(subscriptions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch subscription plans." });
  }
};



// @desc    Get a single subscription plan by ID
// @route   GET /api/subscriptions/:id
exports.getSubscriptionById = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    
    if (!subscription) {
      return res.status(404).json({ message: "Subscription plan not found." });
    }
    
    res.status(200).json(subscription);
  } catch (error) {
    res.status(500).json({ message: "Error fetching subscription plan details." });
  }
};

// @desc    Update a subscription plan
// @route   PUT /api/subscriptions/:id
exports.updateSubscription = async (req, res) => {
  try {
    // ⭐ Added new usage limit fields to the destructuring
    const { 
      name, price, cycle, status, features, 
      maxProjects, maxTasks, maxDocuments,
      maxStaff, maxTeamMembersPerProject, hasBulkUpload
    } = req.body;

    if (!features || features.length === 0) {
        return res.status(400).json({ message: "At least one feature is required." });
    }

    const updatedSubscription = await Subscription.findByIdAndUpdate(
      req.params.id,
      { 
        name, price, cycle, status, features, 
        maxProjects, maxTasks, maxDocuments,
        maxStaff, maxTeamMembersPerProject, hasBulkUpload // ⭐ NEW limits updated here
      }, 
      { new: true, runValidators: true }
    );

    if (!updatedSubscription) {
      return res.status(404).json({ message: "Subscription plan not found." });
    }

    res.status(200).json(updatedSubscription);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to update subscription plan." });
  }
};

// @desc    Delete a subscription plan
// @route   DELETE /api/subscriptions/:id
exports.deleteSubscription = async (req, res) => {
  try {
    const deletedSubscription = await Subscription.findByIdAndDelete(req.params.id);
    
    if (!deletedSubscription) {
      return res.status(404).json({ message: "Subscription plan not found." });
    }
    
    res.status(200).json({ message: "Subscription plan deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete subscription plan." });
  }
};

// ==========================================
// NEW ENDPOINTS FOR ONBOARDING
// ==========================================

// @desc    Get all ACTIVE subscriptions (For the Pricing Selection Page)
// @route   GET /api/subscriptions/active
// @access  Public / Logged in users
exports.getActiveSubscriptions = async (req, res) => {
  try {
    const plans = await Subscription.find({ status: 1 }).sort({ price: 1 });
    res.status(200).json(plans);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch active subscription plans." });
  }
};

// @desc    Company assigns a subscription plan to their account
// @route   POST /api/subscriptions/select
// @access  Private (Company Owner)
exports.selectSubscription = async (req, res) => {
  try {
    const { planId } = req.body;

    if (!req.user || !req.user.company) {
      return res.status(404).json({ message: 'No company assigned to this user.' });
    }

    const updatedCompany = await Company.findByIdAndUpdate(
      req.user.company,
      { 
        subscriptionPlan: planId, 
        subscriptionStatus: 'active',
        subscriptionExpiry: new Date(new Date().setMonth(new Date().getMonth() + 1)) 
      },
      { new: true }
    );

    res.status(200).json(updatedCompany);
  } catch (error) {
    res.status(500).json({ message: "Failed to select subscription plan." });
  }
};