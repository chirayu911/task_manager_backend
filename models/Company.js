const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  companyName: { 
    type: String, 
    required: true 
  },
  logoUrl: {
    type: String,
    default: ''
  },
  ownerName: { 
    type: String, 
    required: true 
  },
  ownerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  // ⭐ Unified Address Field
  fullAddress: { 
    type: String 
  },
  companyEmail: { 
    type: String, 
    required: true, 
    unique: true 
  },
  phoneNumber: { 
    type: String 
  },

  // ⭐ Company Settings Fields
  workingDays: {
    type: [String],
    default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  },
  workingHours: {
    start: { type: String, default: '09:00' },
    end: { type: String, default: '17:00' }
  },
  breakTimings: {
    start: { type: String, default: '13:00' },
    end: { type: String, default: '14:00' }
  },
  holidays: [{
    name: String,
    date: String // Stored as YYYY-MM-DD for easy HTML5 date input handling
  }],

  // ⭐ NEW: Subscription System Fields
  subscriptionPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    default: null // Links to the specific tier (Basic, Pro, etc.) this company is on
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'trial', 'past_due', 'canceled'],
    default: 'active'
  },
  subscriptionExpiry: {
    type: Date,
    default: null // Tracks when their current billing cycle or trial ends
  }

}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);