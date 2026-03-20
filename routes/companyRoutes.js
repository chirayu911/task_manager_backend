const express = require('express');
const router = express.Router();
const { 
    getAllCompanies, 
    getMyCompany, 
    updateMyCompany, 
    getCompanyUsage,
    deleteCompany // ⭐ Added for Admin management
} = require('../controllers/companyController');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ==========================================
// SETUP MULTER FOR LOGOS
// ==========================================
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

const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        // Only allow images
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// ==========================================
// ROUTES
// ==========================================

/**
 * ⭐ NOTE ON ROUTE ORDER:
 * Static routes like /all, /mine, and /usage must come BEFORE 
 * parameterized routes like /:id to prevent the router from 
 * mistaking "mine" as a company ID.
 */

// @desc    Get all companies (Superadmin view)
router.get('/all', protect, getAllCompanies);

// @desc    Get specific company details & usage (Scoped or Admin Context)
router.get('/mine', protect, getMyCompany);
router.get('/usage', protect, getCompanyUsage);

// @desc    Update company settings (Includes logo upload)
router.put('/mine', protect, upload.single('logo'), updateMyCompany);

// @desc    Delete a company (Admin Only)
// @route   DELETE /api/company/:id
router.delete('/:id', protect, deleteCompany);

module.exports = router;