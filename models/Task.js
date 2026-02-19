const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  
  // ⭐ This MUST be defined exactly like this for populate() to work
  status: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'TaskStatus', // This must match the name in mongoose.model('TaskStatus', ...)
    required: true 
  },
  
  assignedTo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null 
  }
}, { timestamps: true });

// Ensure "Task" is the model name
module.exports = mongoose.model('Task', taskSchema);