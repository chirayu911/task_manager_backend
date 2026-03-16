const express = require('express');
const router = express.Router();
// ⭐ FIX: Added getAllCompanies back into this import line!
const { getAllCompanies, getMyCompany, updateMyCompany } = require('../controllers/companyController');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ⭐ Setup Multer for Company Logos
const uploadDir = path.join(__dirname, '../uploads/logos/');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Creates a clean filename: logo-16982348.png
        cb(null, `logo-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });

// ==========================================
// ROUTES
// ==========================================

// Get all companies (Usually for Super Admins)
router.get('/all', protect, getAllCompanies);

// Get the specific company of the logged-in user
router.get('/mine', protect, getMyCompany);

// Update the specific company (Includes the multer middleware for the logo image)
router.put('/mine', protect, upload.single('logo'), updateMyCompany);

module.exports = router;