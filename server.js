const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const http = require("http");
const { Server } = require("socket.io");
const taskStatusRoutes = require('./routes/taskStatusRoutes');
const path = require('path');

dotenv.config();
connectDB();

// ---------------- APP INIT ----------------
const app = express();
const server = http.createServer(app);

// ---------------- SOCKET.IO ----------------
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

// Make io available in controllers
app.set("io", io);

// Socket connection logic
io.on("connection", (socket) => {
  console.log("⚡ Client connected:", socket.id);

  const userId = socket.handshake.auth?.userId;

  if (userId) {
    socket.join(userId);
    console.log(`✅ User ${userId} joined personal room`);
  } else {
    console.log("⚠️ No userId provided to socket");
  }

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// ---------------- MIDDLEWARE ----------------
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


// ---------------- ROUTES ----------------
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/roles", require("./routes/roleRoutes"));
app.use("/api/tasks", require("./routes/taskRoutes"));
app.use("/api/permissions", require("./routes/permissionRoutes"));
app.use('/api/task-statuses', taskStatusRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server + Socket.io running on port ${PORT}`);
});