const User = require("../models/User");
const Role = require("../models/Role");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// ================= TOKEN GENERATION =================
/**
 * Generates a JWT valid for 30 days
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// ================= LOGIN USER =================
/**
 * Authenticates user and returns populated role/permission data
 */
const loginUser = async (req, res) => {
  const { username, password } = req.body;

  try {
    // Deep populate to get the Permission objects hidden inside the Role
    const user = await User.findOne({ username }).populate({
      path: "role",
      populate: { 
        path: "permissions",
        select: "value" // Only fetch the slug (e.g., 'tasks_read') to save time
      }
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user._id);

    // Set HTTP-Only cookie for security
    res.cookie("jwt", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    // Map permissions to a flat array of strings for fast frontend checks
    const permissions =
      user.role?.name === "admin"
        ? ["*"]
        : user.role?.permissions?.map(p => p.value) || [];

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role?.name || "staff",
      permissions,
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================= GET ME (SESSION CHECK) =================
/**
 * Validates existing session and refreshes user data
 */
const getMe = async (req, res) => {
  try {
    // Re-populate permissions on every "me" check to reflect admin changes immediately
    const user = await User.findById(req.user.id)
      .populate({
        path: "role",
        populate: { 
          path: "permissions",
          select: "value" 
        }
      })
      .select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const permissions =
      user.role?.name === "admin"
        ? ["*"]
        : user.role?.permissions?.map(p => p.value) || [];

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role?.name || "staff",
      permissions,
    });

  } catch (err) {
    console.error("GetMe Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================= LOGOUT USER =================
const logoutUser = (req, res) => {
  res.cookie("jwt", "", {
    httpOnly: true,
    expires: new Date(0),
  });
  res.json({ message: "Logged out" });
};

module.exports = {
  loginUser,
  logoutUser,
  getMe,
};