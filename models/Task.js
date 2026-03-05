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
  
  // ⭐ NEW: This field differentiates between Tasks and Issues
  itemType: {
    type: String,
    enum: ['Task', 'Issue'], // Restricts the value to only these two options
    default: 'Task',         // Defaults to 'Task' if nothing is provided
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
    ref: 'User'
  }
}, {
  timestamps: true 
});

// ⭐ GOAL 3: DATABASE INDEXES FOR MASSIVE PERFORMANCE BOOST
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ mentionedUsers: 1 });
taskSchema.index({ createdAt: -1 }); 

// ⭐ NEW INDEX: Makes filtering by "Tasks" vs "Issues" lightning fast
taskSchema.index({ itemType: 1 }); 

module.exports = mongoose.model('Task', taskSchema);