const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');

// Import your auth middleware here if you have one!
// const { verifyAuth, checkPermission } = require('../middleware/authMiddleware');

// Get all plans (Usually public or readable by all authenticated users)
router.get('/', subscriptionController.getAllSubscriptions);

// Get single plan
router.get('/:id', subscriptionController.getSubscriptionById);

// Create, Update, Delete (Should ideally be protected for Admins only)
router.post('/', subscriptionController.createSubscription);
router.put('/:id', subscriptionController.updateSubscription);
router.delete('/:id', subscriptionController.deleteSubscription);

module.exports = router;