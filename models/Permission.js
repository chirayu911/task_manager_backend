const mongoose = require('mongoose');

const permissionSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  value: {
    type: String,
    required: true,
    unique: true, // Ensures we don't have duplicates
  },
  description: {
    type: String,
    required: false,
  },
  status: {
    type: Number,
    enum: [0, 1],
    default: 1,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Permission', permissionSchema);