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
  },
  
  // Usage Limits for the Subscription System
  // (Note: Use -1 to represent 'unlimited' in your application logic)
  
  maxProjects: {
    type: Number,
    required: [true, 'Max Projects limit is required'],
    default: 1 
  },
  maxTasks: {
    type: Number,
    required: [true, 'Max Tasks limit is required'],
    default: 50 
  },
  maxDocuments: {
    type: Number,
    required: [true, 'Max Documents limit is required'],
    default: 10
  },

  // ⭐ NEW limitations added below:

  maxStaff: {
    type: Number,
    required: [true, 'Total Staff limit is required'],
    default: 5 // Total employees the company can create
  },

  maxTeamMembersPerProject: {
    type: Number,
    required: [true, 'Max Team members per project is required'],
    default: 5 // Limitation on how many staff can be assigned to a single project team
  },

  hasBulkUpload: {
    type: Boolean,
    required: [true, 'Bulk Upload feature status is required'],
    default: false // Toggle for Excel/CSV task/staff upload feature
  }
  
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);