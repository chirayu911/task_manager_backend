const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add an issue title'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please add an issue description'],
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'An issue must be linked to a project'],
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // Null until an admin/manager assigns it
    },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Under Review', 'Resolved', 'Closed'],
      default: 'Open',
    },
    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Issue', issueSchema);