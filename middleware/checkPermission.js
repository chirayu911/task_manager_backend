const User = require("../models/User");
const Role = require("../models/Role");

const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      // ✅ Load user with role
      const user = await User.findById(req.user.id).populate("role");

      if (!user || !user.role) {
        return res.status(404).json({
          message: "User or role not found",
        });
      }

      const role = user.role;

      // ⭐ ADMIN / SUPERADMIN BYPASS
      if (
        role.name === "admin" ||
        role.name === "superadmin" ||
        role.permissions.includes("*")
      ) {
        return next();
      }

      // ✅ Check permission string
      console.log(role.permissions);
      if (role.permissions.includes(requiredPermission)) {
        return next();
      }

      return res.status(403).json({
        message: `Forbidden: Missing permission '${requiredPermission}'`,
      });

    } catch (err) {
      console.error("Permission Middleware Error:", err);
      return res.status(500).json({
        message: "Server Error",
      });
    }
  };
};

module.exports = checkPermission;