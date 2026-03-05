const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { protect } = require('../middleware/authMiddleware'); // ⭐ Explicitly import auth guard
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

// ⭐ Apply 'protect' to ALL routes so the backend always knows who the user is!
router.get('/', protect, documentController.getDocumentsByProject);
router.get('/:id', protect, documentController.getDocumentById);
router.post('/', protect, upload.single('documentFile'), documentController.createDocument);
router.put('/:id', protect, upload.single('documentFile'), documentController.updateDocument);
router.delete('/:id', protect, documentController.deleteDocument);
router.post('/:id/request-access', protect, documentController.requestAccess);

module.exports = router;