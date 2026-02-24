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
    ref: 'User'
  }
}, {
  timestamps: true 
});

// ⭐ GOAL 3: DATABASE INDEXES FOR MASSIVE PERFORMANCE BOOST
// This makes filtering by status, assignee, or mentions lightning fast.
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ mentionedUsers: 1 });
taskSchema.index({ createdAt: -1 }); 

module.exports = mongoose.model('Task', taskSchema);