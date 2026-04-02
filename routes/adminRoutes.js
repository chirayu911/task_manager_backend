const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');

router.get('/audit-logs', protect, getAuditLogs);

module.exports = router;
