const express = require('express');
const router = express.Router();
const { getMyActivities, markAsRead } = require('../controllers/activityController');
const { protect } = require('../middleware/authMiddleware');

// All activity routes require a logged-in user
router.use(protect);

// GET /api/activities/mine
router.get('/mine', getMyActivities);

// PUT /api/activities/read
router.put('/read', markAsRead);

module.exports = router;