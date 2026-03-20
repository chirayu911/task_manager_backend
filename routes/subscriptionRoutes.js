const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');

// Import your auth middleware to protect the routes
const { protect } = require('../middleware/authMiddleware');

// ==========================================
// ⭐ NEW ONBOARDING ROUTES
// ==========================================

// Get all ACTIVE plans (Must be placed BEFORE /:id to prevent routing conflicts)
router.get('/active', protect, subscriptionController.getActiveSubscriptions);

// Save the company's plan selection to the database
router.post('/select', protect, subscriptionController.selectSubscription);


// ==========================================
// STANDARD ADMIN CRUD ROUTES
// ==========================================

// Get all plans 
router.get('/', subscriptionController.getAllSubscriptions);

// Get single plan
router.get('/:id', subscriptionController.getSubscriptionById);

// Create, Update, Delete
router.post('/', protect, subscriptionController.createSubscription);
router.put('/:id', protect, subscriptionController.updateSubscription);
router.delete('/:id', protect, subscriptionController.deleteSubscription);

module.exports = router;