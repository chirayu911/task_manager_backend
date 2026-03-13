const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true 
  },
  description: { 
    type: String, 
    trim: true 
  },
  // ⭐ Multi-Tenancy: Every project belongs to a specific company
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  // Array of ObjectIds to store multiple assigned users
  assignedUsers: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  // The person who created the project
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  }
}, { timestamps: true });

// Indexing by company will make project lookups much faster as your database grows
projectSchema.index({ company: 1 });

module.exports = mongoose.model('Project', projectSchema);