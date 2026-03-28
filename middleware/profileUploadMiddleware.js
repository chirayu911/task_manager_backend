const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = 'uploads/profiles';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 1. Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `profile-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// 2. File Filter (Validation)
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|webp|svg|gif/;
  
  const extname = allowedImageTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedImageTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    // Use an Error object to be caught by Express error handlers
    cb(new Error('Invalid file type. Only standard images (jpeg, png, webp) are allowed for profile pictures!'), false);
  }
};

// 3. Initialize Multer limits suitable for user avatars
const profileUpload = multer({
  storage: storage,
  limits: { 
    // Increased limit to 5MB to accommodate standard avatars safely
    fileSize: 5 * 1024 * 1024 
  },
  fileFilter: fileFilter
});

module.exports = profileUpload;
