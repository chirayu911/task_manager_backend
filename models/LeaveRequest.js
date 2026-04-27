const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// Optional: you might want to only allow one request per date per user, or limit it
leaveRequestSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
