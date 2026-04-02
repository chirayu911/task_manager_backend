const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  // ⭐ Ensure this is 'user' and not 'userId'
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  action: { 
    type: String, 
    enum: ['assigned', 'mentioned', 'created', 'updated', 'deleted', 'uploaded'], 
    required: true 
  },
  resourceType: { 
    type: String, 
    enum: ['project', 'task', 'issue', 'document', 'comment'], 
    required: true 
  },
  resourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  description: { type: String },
}, { timestamps: true });

// Auto-delete activities after 7 days (604800 seconds)
activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

module.exports = mongoose.models.Activity || mongoose.model('Activity', activitySchema);