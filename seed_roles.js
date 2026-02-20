const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Role = require('./models/Role');
const Permission = require('./models/Permission');

dotenv.config();

const seed = async () => {
  try {
    console.log("Connecting to DB...");
    await mongoose.connect(process.env.MONGO_URI);
    
    // 1. Clear existing data to avoid duplicates
    await Role.deleteMany({});
    await Permission.deleteMany({});
    console.log("🧹 Cleared old Roles and Permissions.");

    // 2. Create Permissions
    const perms = [
      { name: 'Manage Staff', value: 'manage_staff', status: 'active' },
      { name: 'Manage Tasks', value: 'manage_tasks', status: 'active' },
      { name: 'Delete Tasks', value: 'delete_tasks', status: 'active' },
      { name: 'View Reports', value: 'view_reports', status: 'active' }
    ];
    
    const createdPerms = await Permission.insertMany(perms);
    console.log("✅ Created Permissions");

    // Helper: Find a permission ID by its value
    const getPermId = (value) => createdPerms.find(p => p.value === value)._id;

    // 3. Create Roles
    const roles = [
      {
        name: 'admin',
        permissions: createdPerms.map(p => p._id) // Admin gets ALL permissions
      },
      {
        name: 'staff',
        permissions: [
          getPermId('manage_tasks'), // Staff can only manage tasks
          getPermId('view_reports')  // Staff can view reports
        ]
      }
    ];

    await Role.insertMany(roles);
   
    process.exit();
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

seed();