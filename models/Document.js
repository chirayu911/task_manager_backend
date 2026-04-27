const mongoose = require('mongoose');

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
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: false, // For safety with old docs, but should be set for new ones
    default: null
  },
  
  type: { 
    type: String, 
    enum: ['file', 'text'], 
    default: 'file'
  },
  
  // ⭐ Used when type === 'file'
  fileUrl: { 
    type: String, 
    required: function() { return this.type === 'file'; }
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
  
  readOnlyUsers: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],

  canEditUsers: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],

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
  timestamps: true,
  toJSON: { virtuals: true }, // Ensure virtuals show up in API responses
  toObject: { virtuals: true }
});

// Indexing
documentSchema.index({ project: 1, title: 1 });
documentSchema.index({ readOnlyUsers: 1 });
documentSchema.index({ canEditUsers: 1 });

module.exports = mongoose.model('Document', documentSchema);