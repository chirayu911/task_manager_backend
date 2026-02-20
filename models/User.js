const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // ⭐ Added missing import

/**
 * User Model
 * The 'role' field stores an ObjectId referencing the Role collection.
 */
const userSchema = mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  username: { 
    type: String, 
    required: true, 
    unique: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Role', // Reference to Role collection
  },
  status: { 
    type: String, 
    default: 'Active' 
  },
}, { 
  timestamps: true 
});

// Middleware to hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  // Use bcrypt here now that it is defined at the top
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('User', userSchema);