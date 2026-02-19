const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Role = require('./models/Role');
const Permission = require('./models/Permission');

dotenv.config();

const seedMatrix = async () => {
  try {
    console.log("Connecting to Database...");
    await mongoose.connect(process.env.MONGO_URI);
    
    // 1. Clear Old Data to ensure a fresh start
    await Permission.deleteMany({});
    await Role.deleteMany({});
    console.log("🧹 Cleared old Roles and Permissions.");

    // 2. Define Resources and Actions
    // These 'values' MUST match the strings used in Sidebar.jsx and checkPermission.js logic
    const resources = ['tasks', 'staff', 'roles'];
    const actions = ['read', 'create', 'update', 'delete'];
    
    let allPerms = [];

    // 3. Generate Permissions (e.g., tasks_read, staff_create)
    for (const res of resources) {
        for (const act of actions) {
            allPerms.push({
                name: `${res.charAt(0).toUpperCase() + res.slice(1)} ${act.charAt(0).toUpperCase() + act.slice(1)}`, 
                value: `${res}_${act}`, // Code-friendly value (e.g., tasks_read)
                group: res 
            });
        }
    }

    // Insert all generated permissions into the DB
    const createdPerms = await Permission.insertMany(allPerms);
    console.log(`✅ Created ${createdPerms.length} permissions.`);

    // 4. Create Roles and Assign Permissions
    
    // Admin: Gets EVERY permission created above
    const adminPerms = createdPerms.map(p => p._id);
    
    // Staff: Define exactly what staff can see
    // To make features show on the sidebar for staff, they MUST have the 'read' permission for that resource
    const staffPerms = createdPerms.filter(p => 
        (p.value.startsWith('tasks_') && !p.value.includes('delete')) || // Staff: Create/Read/Update Tasks
        (p.value === 'staff_read') // Staff: Can see the Staff List but not Edit/Delete
    ).map(p => p._id);

    // Create the Role documents
    // The 'name' must match the 'role' field in your User model
    await Role.create([
      { 
        name: 'admin', 
        permissions: adminPerms 
      },
      { 
        name: 'staff', 
        permissions: staffPerms 
      }
    ]);

    console.log("✅ Roles 'admin' and 'staff' seeded successfully.");
    console.log("🎉 Seeding Complete! Remember to logout and login again to refresh your session.");
    process.exit();
  } catch (err) {
    console.error("❌ Seeding Error:", err);
    process.exit(1);
  }
};

seedMatrix();