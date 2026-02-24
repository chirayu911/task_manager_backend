const mongoose = require('mongoose');

const taskStatusSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    // ⭐ Ensure this exists!
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Must belong to a project'],
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('TaskStatus', taskStatusSchema);