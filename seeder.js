const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

dotenv.config();

const connectDB = require("./config/db");
const User = require("./models/User");
const Role = require("./models/Role");

const seedAdmin = async () => {
  try {
    await connectDB();

    // 1️⃣ Ensure admin role exists
    let adminRole = await Role.findOne({ name: "admin" });

    if (!adminRole) {
      adminRole = await Role.create({
        name: "admin",
        permissions: ["*"],
        status: 1
      });
      console.log("✅ Admin role created");
    } else {
      console.log("✅ Admin role exists");
    }

    // 2️⃣ Check admin user by username
    const adminExists = await User.findOne({ username: "admin" });

    if (adminExists) {
      console.log("🔄 Updating existing Admin to Global context...");
      adminExists.company = null;
      adminExists.role = adminRole._id;
      await adminExists.save();
      console.log("✅ Admin updated successfully");
      process.exit(0);
    }

    // 3️⃣ Create admin user
    const hashedPassword = await bcrypt.hash("admin123", 10);

    await User.create({
      name: "Super Admin",
      username: "admin",
      email: "admin@test.com",
      password: hashedPassword,
      role: adminRole._id,
      company: null, // explicit global context
      status: "Active"
    });

    console.log("\n🔥 ADMIN CREATED SUCCESSFULLY");
    console.log("username: admin");
    console.log("password: admin123\n");

    process.exit(0);

  } catch (err) {
    console.error("❌ Seeder Error:", err);
    process.exit(1);
  }
};

seedAdmin();