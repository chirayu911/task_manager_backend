const Subscription = require('../models/Subscription');

// @desc    Create a new subscription plan
// @route   POST /api/subscriptions
exports.createSubscription = async (req, res) => {
  try {
    const { name, price, cycle, status, features } = req.body;

    // Backend Validation Check
    if (!name || price === undefined || !features || features.length === 0) {
      return res.status(400).json({ message: "Name, price, and at least one feature are required." });
    }

    const newSubscription = new Subscription({
      name,
      price,
      cycle,
      status,
      features
    });

    const savedSubscription = await newSubscription.save();
    res.status(201).json(savedSubscription);
  } catch (error) {
    res.status(500).json({ message: error.message || "Internal server error while creating plan." });
  }
};

// @desc    Get all subscription plans
// @route   GET /api/subscriptions
exports.getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find().sort({ price: 1 }); // Sorts by price ascending (cheapest first)
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
    const { name, price, cycle, status, features } = req.body;

    if (!features || features.length === 0) {
        return res.status(400).json({ message: "At least one feature is required." });
    }

    const updatedSubscription = await Subscription.findByIdAndUpdate(
      req.params.id,
      { name, price, cycle, status, features },
      { new: true, runValidators: true } // returns the newly updated document
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