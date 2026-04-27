const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: false
  },
  messageType: {
    type: String,
    enum: ['text', 'document'],
    default: 'text'
  },
  document: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });

messageSchema.index({ conversationId: 1 });
messageSchema.index({ sender: 1 });

module.exports = mongoose.model('Message', messageSchema);
