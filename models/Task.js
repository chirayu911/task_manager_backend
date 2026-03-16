const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a task title'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  itemType: {
    type: String,
    enum: ['Task', 'Issue'],
    default: 'Task',
    required: true
  },
  // ⭐ Multi-Tenancy Anchor: Every task belongs to a specific company
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Must belong to a project'],
  },
  status: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TaskStatus', 
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', 
    default: null
  },
  images: [{ type: String }],
  videos: [{ type: String }],
  mentionedUsers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true 
});

// ⭐ PERFORMANCE INDEXES
taskSchema.index({ company: 1 }); // Essential for multi-tenant isolation
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ itemType: 1 }); 

module.exports = mongoose.model('Task', taskSchema);