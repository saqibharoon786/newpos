const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

// Database and logger
const connectDB = require("./loaders/connectionDB");
const logger = require("./loaders/logger");

// Cron jobs
const { startCronJobs } = require("./utils/cron");

// Error middleware
const { notFound, errorHandler } = require("./middleware/errorHandler");

// Import routes
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const memberRoutes = require("./routes/member.routes");
const staffRoutes = require("./routes/staff.routes");
const paymentRoutes = require("./routes/payment.routes");
const popRoutes = require("./routes/pop.routes");
const posRoutes = require("./routes/pos.routes");
const expenseRoutes = require("./routes/expense.route");
const assetRoutes = require("./routes/assets.route");
const customerRoutes = require("./routes/customer.route");
const dashboardRoutes = require("./routes/dashboard.route");
const employeeRoutes = require("./routes/employee.route");

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to database
connectDB();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logger.info(`Created uploads directory: ${uploadsDir}`);
}

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000", 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:", "http://localhost:5000", "http://localhost:3000"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(morgan("combined", { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "Too many requests from this IP, please try again later." }
});
app.use("/api/", limiter);

// ✅ Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  setHeaders: (res, path) => {
    // Set proper headers for images
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    }
    // Allow CORS for static files
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// Log static file requests (for debugging)
app.use("/uploads", (req, res, next) => {
  logger.info(`Static file request: ${req.url}`);
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/purchases", popRoutes);
app.use("/api/sales", posRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/employees", employeeRoutes);

// Test route for file access
app.get("/api/test-upload/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "uploads", filename);
  
  if (fs.existsSync(filePath)) {
    res.json({
      exists: true,
      path: filePath,
      url: `http://localhost:${PORT}/uploads/${filename}`,
      size: fs.statSync(filePath).size
    });
  } else {
    const filesInUploads = fs.existsSync(path.join(__dirname, "uploads")) 
      ? fs.readdirSync(path.join(__dirname, "uploads"))
      : [];
    
    res.status(404).json({
      exists: false,
      message: "File not found",
      searchedFor: filename,
      filesInUploads: filesInUploads
    });
  }
});

// List all uploads
app.get("/api/uploads", (req, res) => {
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    res.json({
      count: files.length,
      files: files.map(file => {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          created: stats.birthtime,
          url: `http://localhost:${PORT}/uploads/${file}`
        };
      })
    });
  } else {
    res.json({
      count: 0,
      message: "Uploads directory does not exist"
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  const uploadsInfo = fs.existsSync(uploadsDir) 
    ? {
        exists: true,
        fileCount: fs.readdirSync(uploadsDir).length,
        path: uploadsDir
      }
    : {
        exists: false,
        message: "Uploads directory not found"
      };
  
  res.status(200).json({ 
    status: "OK",
    serverTime: new Date().toISOString(),
    port: PORT,
    uploads: uploadsInfo,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Welcome route
app.get("/", (req, res) => {
  res.json({
    message: "Gym Management System API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      members: "/api/members",
      purchases: "/api/purchases",
      uploads: "/api/uploads",
      health: "/api/health",
      staticFiles: "/uploads/{filename}"
    },
    documentation: "Available at /api/docs (if configured)"
  });
});

// 404 + Error handler (order matters - these should be last)
app.use(notFound);
app.use(errorHandler);

// Start cron jobs
startCronJobs();

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Uploads directory: ${uploadsDir}`);
  logger.info(`Static files available at: http://localhost:${PORT}/uploads/`);
  
  // Simple console output without fancy formatting
  console.log(`
====================================================
        GYM MANAGEMENT SYSTEM API SERVER
====================================================
PORT:           ${PORT}
ENVIRONMENT:    ${process.env.NODE_ENV || 'development'}
UPLOADS DIR:    ${uploadsDir}
====================================================
HEALTH CHECK:   http://localhost:${PORT}/api/health
TEST UPLOADS:   http://localhost:${PORT}/api/uploads
STATIC FILES:   http://localhost:${PORT}/uploads/
====================================================
  `);
});

module.exports = app;