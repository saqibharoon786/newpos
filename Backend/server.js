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
// const staffRoutes = require("./routes/staff.routes");
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

// Create uploads and receipts directories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const receiptsDir = path.join(__dirname, 'receipts');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logger.info(`Created uploads directory: ${uploadsDir}`);
}

if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
  logger.info(`Created receipts directory: ${receiptsDir}`);
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
  setHeaders: (res, filePath) => {
    // Set proper headers for images
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    } else if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    }
    // Allow CORS for static files
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// ✅ Serve static files from receipts directory
app.use("/receipts", express.static(path.join(__dirname, "receipts"), {
  setHeaders: (res, filePath) => {
    // Set proper headers for images
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    } else if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    }
    // Allow CORS for static files
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// Log static file requests (for debugging)
app.use("/uploads", (req, res, next) => {
  logger.info(`Static file request - uploads: ${req.url}`);
  next();
});

app.use("/receipts", (req, res, next) => {
  logger.info(`Static file request - receipts: ${req.url}`);
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/members", memberRoutes);
// app.use("/api/staff", staffRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/purchases", popRoutes);
app.use("/api/sales", posRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/employees", employeeRoutes);

// Test route for uploads file access
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
      message: "File not found in uploads",
      searchedFor: filename,
      filesInUploads: filesInUploads
    });
  }
});

// Test route for receipts file access
app.get("/api/test-receipt/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "receipts", filename);
  
  if (fs.existsSync(filePath)) {
    res.json({
      exists: true,
      path: filePath,
      url: `http://localhost:${PORT}/receipts/${filename}`,
      size: fs.statSync(filePath).size
    });
  } else {
    const filesInReceipts = fs.existsSync(path.join(__dirname, "receipts")) 
      ? fs.readdirSync(path.join(__dirname, "receipts"))
      : [];
    
    res.status(404).json({
      exists: false,
      message: "File not found in receipts",
      searchedFor: filename,
      filesInReceipts: filesInReceipts
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

// List all receipts
app.get("/api/receipts", (req, res) => {
  if (fs.existsSync(receiptsDir)) {
    const files = fs.readdirSync(receiptsDir);
    res.json({
      count: files.length,
      files: files.map(file => {
        const filePath = path.join(receiptsDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          created: stats.birthtime,
          url: `http://localhost:${PORT}/receipts/${file}`
        };
      })
    });
  } else {
    res.json({
      count: 0,
      message: "Receipts directory does not exist"
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

  const receiptsInfo = fs.existsSync(receiptsDir) 
    ? {
        exists: true,
        fileCount: fs.readdirSync(receiptsDir).length,
        path: receiptsDir
      }
    : {
        exists: false,
        message: "Receipts directory not found"
      };
  
  res.status(200).json({ 
    status: "OK",
    serverTime: new Date().toISOString(),
    port: PORT,
    uploads: uploadsInfo,
    receipts: receiptsInfo,
    staticFileUrls: {
      uploads: `http://localhost:${PORT}/uploads/`,
      receipts: `http://localhost:${PORT}/receipts/`
    },
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
      sales: "/api/sales",
      uploads: "/api/uploads",
      receipts: "/api/receipts",
      health: "/api/health",
      staticFiles: {
        uploads: "/uploads/{filename}",
        receipts: "/receipts/{filename}"
      }
    }
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
  logger.info(`Receipts directory: ${receiptsDir}`);
  logger.info(`Uploads files available at: http://localhost:${PORT}/uploads/`);
  logger.info(`Receipts files available at: http://localhost:${PORT}/receipts/`);
  
  // Simple console output
  console.log(`
====================================================
        GYM MANAGEMENT SYSTEM API SERVER
====================================================
PORT:           ${PORT}
ENVIRONMENT:    ${process.env.NODE_ENV || 'development'}
UPLOADS DIR:    ${uploadsDir}
RECEIPTS DIR:   ${receiptsDir}
====================================================
HEALTH CHECK:   http://localhost:${PORT}/api/health
TEST UPLOADS:   http://localhost:${PORT}/api/uploads
TEST RECEIPTS:  http://localhost:${PORT}/api/receipts
UPLOADS FILES:  http://localhost:${PORT}/uploads/
RECEIPTS FILES: http://localhost:${PORT}/receipts/
====================================================
  `);
});

module.exports = app;