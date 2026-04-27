module.exports = {
  apps: [{
    name: "task-manager-backend",
    script: "./server.js",
    instances: "max",       // Or a specific number of instances
    exec_mode: "cluster",   // Enables clustering to balance the load
    watch: false,           // Set to true if you want auto-restart on file changes (not recommended in prod)
    max_memory_restart: "1G", // Auto-restart if the app exceeds 1GB of memory
    env: {
      NODE_ENV: "development",
    },
    env_production: {
      NODE_ENV: "production",
    }
  }]
};
