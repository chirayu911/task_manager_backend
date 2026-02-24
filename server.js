const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const http = require("http");
const { Server } = require("socket.io");
const taskStatusRoutes = require('./routes/taskStatusRoutes');
const path = require('path');
const session = require('express-session');

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

// ⭐ Update these with your ACTUAL Dev Tunnel URLs
const allowedOrigins = [
  "https://fm8bp5cj-3000.inc1.devtunnels.ms", // Your Frontend Tunnel
  "http://localhost:3000"
];

// ---------------- MIDDLEWARE ----------------
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // ⭐ Required to share cookies across domains
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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
  if (userId) socket.join(userId);
});

// ---------------- ROUTES ----------------
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/roles", require("./routes/roleRoutes"));
app.use("/api/tasks", require("./routes/taskRoutes"));
app.use("/api/permissions", require("./routes/permissionRoutes"));
app.use('/api/task-statuses', taskStatusRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use("/api/projects", require("./routes/projectRoutes"));
app.use("/api/issues", require("./routes/issueRoutes"));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));