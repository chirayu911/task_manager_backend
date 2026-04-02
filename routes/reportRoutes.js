const express = require('express');
const router = express.Router();
const { getDashboardReports } = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');

router.get('/dashboard', protect, getDashboardReports);

module.exports = router;
