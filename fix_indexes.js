const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const fix = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);

  

    // This deletes the collection AND the bad 'code' index
    try {
        await mongoose.connection.collection('permissions').drop();
    } catch (e) {
        if (e.code === 26) {
            console.log("ℹ️ Collection didn't exist. That's fine too.");
        } else {
            throw e;
        }
    }

    process.exit();
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
};

fix();