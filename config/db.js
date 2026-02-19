const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on("error", (err) => {
      console.error(`❌ MongoDB Connection Error: ${err.message}`);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️  MongoDB Disconnected. Attempting to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("✅ MongoDB Reconnected");
    });
  } catch (error) {
    console.error(`❌ MongoDB Initial Connection Failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
