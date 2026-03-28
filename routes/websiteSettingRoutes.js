const express = require('express');
const router = express.Router();
const websiteSettingController = require('../controllers/websiteSettingController');
const { protect } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/checkPermission');
const websiteUploadMiddleware = require('../middleware/websiteUploadMiddleware');

// Public route to get landing page assets
router.get('/', websiteSettingController.getSettings);

// Protected Admin route to update settings. We allow checking permission.
// Depending on user structure, we might just use admin roles, but checking auth is essential.
router.put('/', 
  protect, 
  websiteUploadMiddleware.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'images', maxCount: 10 },
    { name: 'videos', maxCount: 5 }
  ]),
  websiteSettingController.updateSettings
);

module.exports = router;
