const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a task title'],
    trim: true
  },
  // ⭐ Added: Multi-line description for task details
  description: {
    type: String,
    trim: true,
    default: ''
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
  // ⭐ Array of strings for multiple image paths
  images: [
    {
      type: String
    }
  ],
  // ⭐ Updated: Renamed to 'videos' (plural) to match frontend FormData
  videos: [
    {
      type: String
    }
  ],
  // ⭐ Added: Track which users were mentioned in the description
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

module.exports = mongoose.model('Task', taskSchema);