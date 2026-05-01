const express = require("express");
const logger = require("./utils/logger");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const http = require("http");
const { Server } = require("socket.io");
const taskStatusRoutes = require('./routes/taskStatusRoutes');
const path = require('path');
const session = require('express-session');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const companyRoutes = require('./routes/companyRoutes');
const activityRoutes = require('./routes/activityRoutes');
const cron = require('node-cron');
const { markAbsent } = require('./controllers/attendanceController');

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

// ⭐ FIX FOR 304 NOT MODIFIED: Disable ETags to prevent aggressive API caching
app.disable('etag');

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const documentRoutes = require('./routes/documentRoutes');

// ⭐ Update these with your ACTUAL Dev Tunnel URLs
const allowedOrigins = [
  "https://fm8bp5cj-3000.inc1.devtunnels.ms", // Your Frontend Tunnel
  "http://localhost:3000",
  "https://task-manager-frontend-9n66-gxda6leb5-chirayu911s-projects.vercel.app/"
];

// ---------------- MIDDLEWARE ----------------
app.use(cors({
  origin: (origin, callback) => {
    // Allow any devtunnels.ms origin explicitly to avoid hardcoded domain mismatches
    if (!origin || allowedOrigins.includes(origin) || (origin && origin.endsWith('.devtunnels.ms'))) {
      callback(null, true);
    } else {
      logger.error(`CORS blocked for origin: ${origin}`);
      callback(null, false); // Best practice: Don't throw error, just reject origin
    }
  },
  credentials: true, // ⭐ Required to share cookies across domains
}));

app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// ⭐ Configured for Dev Tunnels and Cross-PC access
app.use(session({
  secret: process.env.SESSION_SECRET || 'f3a9b2c8d1e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,    // Required for HTTPS Tunnels
    sameSite: 'none', // Required for cross-site requests
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// ---------------- SOCKET.IO ----------------
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  const userId = socket.handshake.auth?.userId;
  if (userId) {
    socket.join(userId);
    console.log(`User ${userId} connected`);
  }

  // Handle joining a specific conversation room
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`User joined room: ${roomId}`);
  });

  socket.on("leaveRoom", (roomId) => {
    socket.leave(roomId);
  });

  // Handle typing indicator
  socket.on("typing", ({ roomId, user }) => {
    socket.to(roomId).emit("typing", user);
  });
  
  socket.on("stopTyping", ({ roomId, user }) => {
    socket.to(roomId).emit("stopTyping", user);
  });

  // Also handle sendMessage natively through socket if desired
  socket.on("sendMessage", async (data) => {
    // The controller HTTP method is preferred for saving, but we can do it here too if needed.
    // We already do it in the HTTP route, which then broadcasts via io.to().emit()
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// ---------------- ROUTES ----------------
// app.use('/uploads', express.static('uploads'));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/roles", require("./routes/roleRoutes"));
app.use("/api/tasks", require("./routes/taskRoutes"));
app.use("/api/issues", require("./routes/taskRoutes"));
app.use("/api/permissions", require("./routes/permissionRoutes"));
app.use('/api/task-statuses', taskStatusRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use("/api/projects", require("./routes/projectRoutes"));
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/company', companyRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/activities', activityRoutes);
app.use('/api/website-settings', require('./routes/websiteSettingRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));

// ---------------- CRON JOBS ----------------
cron.schedule('59 23 * * *', () => {
  logger.info('[CRON] Running daily attendance job (23:59)...');
  markAbsent();
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => logger.info(`🚀 Server running on port ${PORT}`));