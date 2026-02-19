const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Role = require('./models/Role');
const Permission = require('./models/Permission');

dotenv.config();

const fixAdmin = async () => {
  try {
    console.log("🔌 Connecting to DB...");
    await mongoose.connect(process.env.MONGO_URI);
    
    // 1. Get ALL Permissions
    const allPerms = await Permission.find({});
    if (allPerms.length === 0) {
        console.log("❌ No permissions found! Run your seeder first.");
        process.exit();
    }
    const allPermIds = allPerms.map(p => p._id);

    // 2. Find Admin Role
    const adminRole = await Role.findOne({ name: 'admin' });
    if (!adminRole) {
        console.log("❌ Admin role not found!");
        process.exit();
    }

    // 3. Update Admin to have EVERYTHING
    adminRole.permissions = allPermIds;
    await adminRole.save();

    console.log("✅ SUCCESS: Admin role now has ALL permissions.");
    console.log("👉 PLEASE LOGOUT AND LOG BACK IN (or Refresh) to see changes.");
    
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

fixAdmin();