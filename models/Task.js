const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a task title'],
    trim: true
  },
  status: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TaskStatus', // References the TaskStatus collection
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // References the User collection
    default: null
  },
  // ⭐ Array of strings for multiple image paths
  images: [
    {
      type: String
    }
  ],
  // ⭐ Updated: Array of strings for multiple video paths
  video: [
    {
      type: String
    }
  ],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true // Tracks createdAt and updatedAt automatically
});

module.exports = mongoose.model('Task', taskSchema);