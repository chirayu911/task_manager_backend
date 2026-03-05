const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Plan Name is required'],
    maxLength: [50, 'Plan Name cannot exceed 50 characters'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  cycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly'
  },
  status: {
    type: Number, 
    enum: [1, 2], // 1 = Active, 2 = Inactive
    default: 1
  },
  features: {
    type: [String],
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'At least one feature is required'
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);