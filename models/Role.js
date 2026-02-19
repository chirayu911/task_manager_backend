const mongoose = require('mongoose');

const roleSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
permissions: {
  type: [String],
  default: []
},

  status: {
    type: Number,
    default: 1 // 1 for active, 0 for inactive
  }
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);