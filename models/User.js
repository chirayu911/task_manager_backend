const mongoose = require('mongoose');

/**
 * User Model
 * The 'role' field stores a string (e.g., 'admin', 'staff') which 
 * corresponds to the 'name' field in the Role collection.
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
    type:mongoose.Schema.Types.ObjectId , 
    ref: 'Role', // Reference to Role collection
  },
  status: { 
    type: String, 
    default: 'Active' 
  },
}, { 
  timestamps: true 
});


userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('User', userSchema);