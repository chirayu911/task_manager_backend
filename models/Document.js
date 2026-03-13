const mongoose = require('mongoose');

/**
 * Document Model
 * Supports both physical file uploads and CKEditor rich-text documents.
 */
const documentSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true,
    default: 'Untitled'
  },
  description: { 
    type: String, 
    trim: true 
  },
  project: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Project', 
    required: true 
  },
  
  type: { 
    type: String, 
    enum: ['file', 'text'], 
    default: 'file'
  },
  
  fileUrl: { 
    type: String, 
    required: function() { return this.type === 'file'; }
  },
  
  content: { 
    type: String, 
    required: function() { return this.type === 'text'; }
  },
  
  originalName: String, 
  fileType: String, 
  
  uploadedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },

  accessType: { 
    type: String, 
    enum: ['public', 'restricted'], 
    default: 'public'
  },
  
  // ⭐ UPDATED: Dedicated arrays for different permission levels
  // Use this if you want to store them as simple ID lists
  readOnlyUsers: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],

  canEditUsers: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],

  // OR Keep the original object-based structure which is more flexible
  // but ensures both userId and permission are explicitly stored
 

  accessRequests: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    message: String,
    requestedAt: { type: Date, default: Date.now }
  }],

  lastSavedAt: {
    type: Date,
    default: Date.now 
  }
}, { 
  timestamps: true 
});

// Updated Indexing for new fields
documentSchema.index({ project: 1, title: 1 });
documentSchema.index({ 'allowedUsers.userId': 1 });
documentSchema.index({ readOnlyUsers: 1 }); // Index for fast lookup
documentSchema.index({ canEditUsers: 1 });  // Index for fast lookup
documentSchema.index({ 'accessRequests._id': 1 });

module.exports = mongoose.model('Document', documentSchema);