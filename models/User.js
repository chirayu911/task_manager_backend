const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
    },
    username: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple users without a username temporarily if needed
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Prevents the password from being accidentally returned in API responses
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role', // References your Role model for RBAC
    },
    permissions: {
      type: [String],
      default: [],
    },
    
    // ⭐ Forgot Password Fields
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  {
    timestamps: true,
  }
);

// ⭐ Middleware: Hash the password before saving it to the database
userSchema.pre('save', async function (next) {
  // If the password field wasn't modified (e.g., user is just updating their name), skip hashing
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ⭐ Method: Compare the entered password with the hashed database password during login
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ⭐ Method: Generate and hash the password reset token
userSchema.methods.getResetPasswordToken = function () {
  // 1. Generate an unhashed, random token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // 2. Hash the token and set it to the schema field (to store safely in the database)
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // 3. Set expiration to 15 minutes from now
  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

  // 4. Return the UNHASHED token so the controller can send it in the email
  return resetToken;
};

module.exports = mongoose.model('User', userSchema);