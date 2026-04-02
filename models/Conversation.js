const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  isGroup: {
    type: Boolean,
    default: false
  },
  name: {
    type: String, // Only used if it's a group chat with a specific name, or project chat
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null // If null, it's either a direct message or non-project group chat
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  latestMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }
}, { timestamps: true });

conversationSchema.index({ company: 1 });
conversationSchema.index({ participants: 1 });
conversationSchema.index({ project: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
