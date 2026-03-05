const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  fileUrl: { type: String, required: true },
  originalName: String,
  fileType: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // ⭐ New Access Controls
  accessType: { type: String, enum: ['public', 'restricted'], default: 'public' },
  allowedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  accessRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // Users who asked for access
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);