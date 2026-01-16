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

// Cache middleware
const { cacheMiddleware, clearCache } = require("./middleware/cacheMiddleware");

// Import routes
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const memberRoutes = require("./routes/member.routes");
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
const HOST = process.env.HOST || "localhost";

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
const corsOptions = {
  origin: process.env.FRONTEND_URL || true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Security headers with CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:", "http://localhost:5000", "http://localhost:3000", process.env.FRONTEND_URL || ""],
      connectSrc: ["'self'", process.env.FRONTEND_URL || ""],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// Logging middleware
app.use(morgan("combined", { 
  stream: { 
    write: (message) => logger.info(message.trim()) 
  },
  skip: (req) => req.path === '/api/health' // Skip health checks from main logs
}));

// Body parser middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting configurations (using memory store)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased limit for general API calls
  message: { 
    message: "Too many requests from this IP, please try again later.",
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and static files
    return req.path === '/api/health' || 
           req.path.startsWith('/uploads/') || 
           req.path.startsWith('/receipts/');
  },
  keyGenerator: (req) => {
    // Use IP address for rate limiting
    return req.ip;
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Higher limit for auth endpoints
  message: { 
    message: "Too many authentication attempts. Please try again later." 
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip
});

const dashboardLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 200, // Higher limit for dashboard (no Redis cache initially)
  message: { 
    message: "Too many dashboard requests. Please wait a few moments before trying again." 
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS'
});

// Apply rate limiters
app.use("/api/auth", authLimiter);
app.use("/api/dashboard", dashboardLimiter);
app.use("/api/", generalLimiter);

// ✅ Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  setHeaders: (res, filePath) => {
    // Set proper content type
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    } else if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (filePath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    }
    
    // Cache static files for 1 hour
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Allow CORS for static files
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  },
  fallthrough: false // Don't fall through to next middleware if file not found
}));

// ✅ Serve static files from receipts directory
app.use("/receipts", express.static(path.join(__dirname, "receipts"), {
  setHeaders: (res, filePath) => {
    // Set proper content type
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    } else if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (filePath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    }
    
    // Cache static files for 1 hour
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Allow CORS for static files
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  },
  fallthrough: false
}));

// Log static file requests (for debugging - optional)
if (process.env.NODE_ENV === 'development') {
  app.use("/uploads", (req, res, next) => {
    logger.debug(`Static file request - uploads: ${req.url}`);
    next();
  });

  app.use("/receipts", (req, res, next) => {
    logger.debug(`Static file request - receipts: ${req.url}`);
    next();
  });
}

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/purchases", popRoutes);
app.use("/api/sales", posRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/employees", employeeRoutes);

// Apply caching middleware to specific routes
// We'll apply it directly to the routes instead of using app.use

// Test route for uploads file access
app.get("/api/test-upload/:filename", cacheMiddleware(60), (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "uploads", filename);

  if (fs.existsSync(filePath)) {
    res.json({
      exists: true,
      path: filePath,
      url: `http://${HOST}:${PORT}/uploads/${filename}`,
      size: fs.statSync(filePath).size,
      mimeType: getMimeType(filePath)
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
app.get("/api/test-receipt/:filename", cacheMiddleware(60), (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "receipts", filename);

  if (fs.existsSync(filePath)) {
    res.json({
      exists: true,
      path: filePath,
      url: `http://${HOST}:${PORT}/receipts/${filename}`,
      size: fs.statSync(filePath).size,
      mimeType: getMimeType(filePath)
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

// Helper function to get MIME type
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// List all uploads with pagination
app.get("/api/uploads", cacheMiddleware(30), (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  if (fs.existsSync(uploadsDir)) {
    const allFiles = fs.readdirSync(uploadsDir);
    const total = allFiles.length;
    const files = allFiles.slice(skip, skip + limit).map(file => {
      const filePath = path.join(uploadsDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        url: `http://${HOST}:${PORT}/uploads/${file}`,
        mimeType: getMimeType(filePath)
      };
    });

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      files
    });
  } else {
    res.json({
      page: 1,
      limit,
      total: 0,
      totalPages: 0,
      files: [],
      message: "Uploads directory does not exist"
    });
  }
});

// List all receipts with pagination
app.get("/api/receipts", cacheMiddleware(30), (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  if (fs.existsSync(receiptsDir)) {
    const allFiles = fs.readdirSync(receiptsDir);
    const total = allFiles.length;
    const files = allFiles.slice(skip, skip + limit).map(file => {
      const filePath = path.join(receiptsDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        url: `http://${HOST}:${PORT}/receipts/${file}`,
        mimeType: getMimeType(filePath)
      };
    });

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      files
    });
  } else {
    res.json({
      page: 1,
      limit,
      total: 0,
      totalPages: 0,
      files: [],
      message: "Receipts directory does not exist"
    });
  }
});

// Health check with system info
app.get("/api/health", (req, res) => {
  const uploadsInfo = fs.existsSync(uploadsDir)
    ? {
      exists: true,
      fileCount: fs.readdirSync(uploadsDir).length,
      path: uploadsDir,
      size: getDirectorySize(uploadsDir)
    }
    : {
      exists: false,
      message: "Uploads directory not found"
    };

  const receiptsInfo = fs.existsSync(receiptsDir)
    ? {
      exists: true,
      fileCount: fs.readdirSync(receiptsDir).length,
      path: receiptsDir,
      size: getDirectorySize(receiptsDir)
    }
    : {
      exists: false,
      message: "Receipts directory not found"
    };

  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();

  res.status(200).json({
    status: "OK",
    serverTime: new Date().toISOString(),
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB'
    },
    uploads: uploadsInfo,
    receipts: receiptsInfo,
    staticFileUrls: {
      uploads: `http://${HOST}:${PORT}/uploads/`,
      receipts: `http://${HOST}:${PORT}/receipts/`
    },
    rateLimiting: {
      enabled: true,
      limits: {
        general: "500 requests per 15 minutes",
        auth: "100 requests per 15 minutes",
        dashboard: "200 requests per 5 minutes"
      }
    },
    caching: {
      enabled: true,
      memoryCache: true,
      redisCache: false
    }
  });
});

// Helper function to get directory size
function getDirectorySize(dir) {
  let size = 0;
  
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        size += stats.size;
      }
    });
    
    if (size < 1024) {
      return size + ' bytes';
    } else if (size < 1024 * 1024) {
      return (size / 1024).toFixed(2) + ' KB';
    } else {
      return (size / (1024 * 1024)).toFixed(2) + ' MB';
    }
  }
  
  return '0 bytes';
}

// Clear cache endpoint (development only)
if (process.env.NODE_ENV === 'development') {
  app.post("/api/clear-cache", async (req, res) => {
    try {
      const { key } = req.body;
      let cleared = false;
      
      if (key) {
        cleared = await clearCache(key);
      } else {
        // Clear all cache from memory
        const { memoryCache } = require('./middleware/cacheMiddleware');
        memoryCache.clear();
        cleared = true;
      }
      
      res.json({
        success: true,
        message: key ? `Cache cleared for key: ${key}` : 'All cache cleared',
        cleared
      });
    } catch (error) {
      logger.error('Error clearing cache:', error);
      res.status(500).json({
        success: false,
        message: 'Error clearing cache',
        error: error.message
      });
    }
  });

  // Reset rate limit for IP (development only)
  app.post("/api/reset-rate-limit", (req, res) => {
    try {
      const { ip } = req.body;
      
      res.json({
        success: true,
        message: ip ? `Rate limit reset requested for IP: ${ip}` : 'Please specify IP address',
        note: 'Server restart may be required to fully reset rate limits'
      });
    } catch (error) {
      logger.error('Error resetting rate limit:', error);
      res.status(500).json({
        success: false,
        message: 'Error resetting rate limit',
        error: error.message
      });
    }
  });
}

// Welcome route
app.get("/", (req, res) => {
  res.json({
    message: "Gym Management System API",
    version: "1.0.0",
    documentation: "See /api/health for system status",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      members: "/api/members",
      payments: "/api/payments",
      purchases: "/api/purchases",
      sales: "/api/sales",
      expenses: "/api/expenses",
      assets: "/api/assets",
      customers: "/api/customers",
      dashboard: "/api/dashboard",
      employees: "/api/employees",
      uploads: "/api/uploads",
      receipts: "/api/receipts",
      health: "/api/health",
      staticFiles: {
        uploads: "/uploads/{filename}",
        receipts: "/receipts/{filename}"
      }
    },
    features: {
      caching: "Enabled (in-memory)",
      rateLimiting: "Enabled with generous limits",
      fileUploads: "Supports images and documents"
    },
    note: "Running without Redis - using in-memory cache and rate limiting"
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
  logger.info(`Uploads files available at: http://${HOST}:${PORT}/uploads/`);
  logger.info(`Receipts files available at: http://${HOST}:${PORT}/receipts/`);
  logger.info(`Rate limiting: Enabled with in-memory store`);
  logger.info(`Dashboard cache: Enabled (30 seconds in memory)`);

  // Simple console output
  console.log(`
====================================================
        GYM MANAGEMENT SYSTEM API SERVER
====================================================
PORT:           ${PORT}
ENVIRONMENT:    ${process.env.NODE_ENV || 'development'}
UPLOADS DIR:    ${uploadsDir}
RECEIPTS DIR:   ${receiptsDir}
CACHE:          In-memory (no Redis required)
====================================================
HEALTH CHECK:   http://${HOST}:${PORT}/api/health
TEST UPLOADS:   http://${HOST}:${PORT}/api/uploads
TEST RECEIPTS:  http://${HOST}:${PORT}/api/receipts
UPLOADS FILES:  http://${HOST}:${PORT}/uploads/
RECEIPTS FILES: http://${HOST}:${PORT}/receipts/
====================================================
RATE LIMITS (Increased to prevent dashboard errors):
  General:      500 req/15min
  Auth:         100 req/15min
  Dashboard:    200 req/5min
====================================================
CACHE DURATIONS:
  Dashboard:    30 seconds
  Members:      5 minutes
  Customers:    5 minutes
====================================================
NOTE: If you still get rate limit errors, you can:
1. Restart the server to reset limits
2. Use /api/clear-cache in development
3. Install Redis for persistent rate limiting
====================================================
  `);
});

module.exports = app;