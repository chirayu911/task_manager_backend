const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Auto-create the directory if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads/documents/');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer Storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); 
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
  }
});

const upload = multer({ storage: storage });

// ==========================================
// ⭐ PROTECTED ROUTES
// ==========================================

// --- 1. Access Request Management (Specific Routes First!) ---
// Fetches the user info and message for the popup
router.get('/requests/:requestId', protect, documentController.getRequestDetails);

// Moves user from accessRequests to allowedUsers
router.post('/grant-access/:requestId', protect, documentController.grantAccess);

// Removes the request from the array (Discard/Decline logic)
router.delete('/requests/:requestId', protect, documentController.declineAccess);


// --- 2. Collection & Creation Routes ---
// Get all documents for a project
router.get('/', protect, documentController.getDocumentsByProject);

// Handles physical file uploads via Multer
router.post('/', protect, upload.single('documentFile'), documentController.createDocument);

// ⭐ FIXED: Changed 'createTextDocument' to 'saveTextDocument' to match controller exports
// This handles the initial creation of CKEditor text documents
router.post('/text-doc', protect, documentController.saveTextDocument);


// --- 3. ID-Specific Routes (Dynamic IDs Last) ---
// Fetches document content (Review on open logic)
router.get('/:id', protect, documentController.getDocumentById);

// ⭐ FIXED: Handles both File updates and CKEditor Autosaves
router.put('/:id', protect, upload.single('documentFile'), documentController.saveTextDocument);

// Deletes document and associated physical files
router.delete('/:id', protect, documentController.deleteDocument);

// Initiates a new access request from a restricted user
router.post('/:id/request-access', protect, documentController.requestAccess);

module.exports = router;