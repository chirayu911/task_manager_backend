const mongoose = require('mongoose');

const taskStatusSchema = new mongoose.Schema({
  // The name of the status (e.g., "Pending", "Testing")
  name: { 
    type: String, 
    required: true, 
    unique: true 
  },
  // ⭐ Status toggle: active / inactive
  status: { 
    type: String, 
    enum: ['active', 'inactive'], 
    default: 'active' 
  }
}, { timestamps: true });

module.exports = mongoose.model('TaskStatus', taskStatusSchema);