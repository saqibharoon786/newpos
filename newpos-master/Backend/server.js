const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
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
const financeRoutes = require("./routes/finance.route");
const processRoutes = require("./routes/process.route");
const settingsRoutes = require("./routes/settings.route");
const activityLogRoutes = require("./routes/activityLog.route");
const notificationRoutes = require("./routes/notification.route");
const vendorRoutes = require("./routes/vendor.route");
const investmentRoutes = require("./routes/investment.route");
const reportRoutes = require("./routes/report.route");
const ledgerRoutes = require("./routes/ledger.route");
const materialCatalogRoutes = require("./routes/materialCatalog.route");
const expenseCategoryRoutes = require("./routes/expenseCategory.route");
const cmsUsersRoutes = require("./routes/cmsUsers.route");
const { cmsProtect } = require("./middleware/cmsAuth");

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "localhost";

// Behind nginx / Cloudflare — required for rate-limit + correct client IP
app.set("trust proxy", 1);

// Connect to database
connectDB();

// Create directories
const uploadsDir = path.join(__dirname, "uploads");
const receiptsDir = path.join(__dirname, "receipts");

[uploadsDir, receiptsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Created directory: ${dir}`);
  }
});

// CORS
// Allow both dev ports (8081, 8082) plus any FRONTEND_URL
const allowedOrigins = [
  "http://localhost:8081",
  "http://localhost:8082",
  "https://internationalplasticplus.cloud",
  "https://www.internationalplasticplus.cloud",
  "http://internationalplasticplus.cloud",
].filter(Boolean);
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
if (process.env.CORS_ORIGINS) {
  process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean).forEach((o) => {
    if (!allowedOrigins.includes(o)) allowedOrigins.push(o);
  });
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser tools (no origin) and any whitelisted origin
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "X-CMS-Email",
    "X-CMS-Role",
    "X-CMS-User-Id",
  ],
};

app.use(cors(corsOptions));

// Security
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", process.env.FRONTEND_URL || ""],
        connectSrc: ["'self'", process.env.FRONTEND_URL || ""],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Logging
app.use(
  morgan("combined", {
    stream: { write: (msg) => logger.info(msg.trim()) },
    skip: (req) => req.path === "/api/health",
  })
);

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files - uploads
app.use(
  "/uploads",
  express.static(uploadsDir, {
    setHeaders: (res, filePath) => {
      const mime = getMimeType(filePath);
      if (mime) res.setHeader("Content-Type", mime);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    },
    fallthrough: false,
  })
);

// Static files - receipts
app.use(
  "/receipts",
  express.static(receiptsDir, {
    setHeaders: (res, filePath) => {
      const mime = getMimeType(filePath);
      if (mime) res.setHeader("Content-Type", mime);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    },
    fallthrough: false,
  })
);

// Debug in dev
if (process.env.NODE_ENV === "development") {
  app.use("/uploads", (req, res, next) => {
    logger.debug(`Static request - uploads: ${req.url}`);
    next();
  });
  app.use("/receipts", (req, res, next) => {
    logger.debug(`Static request - receipts: ${req.url}`);
    next();
  });
}

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/members", cacheMiddleware(300), memberRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/purchases", cmsProtect, popRoutes);
app.use("/api/sales", cmsProtect, posRoutes);
app.use("/api/expenses", cmsProtect, expenseRoutes);
app.use("/api/assets", cmsProtect, assetRoutes);
app.use("/api/customers", cmsProtect, customerRoutes);
app.use("/api/dashboard", cmsProtect, cacheMiddleware(30), dashboardRoutes);
app.use("/api/employees", cmsProtect, employeeRoutes);
app.use("/api/finance", cmsProtect, financeRoutes);
app.use("/api/process", cmsProtect, processRoutes);
app.use("/api/materials", materialCatalogRoutes);
app.use("/api/expense-categories", expenseCategoryRoutes);
app.use("/api/cms-users", cmsUsersRoutes);
// Alias for legacy frontend expecting /api/processing
app.use("/api/processing", cmsProtect, processRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/activity-logs", cmsProtect, activityLogRoutes);
app.use("/api/notifications", cmsProtect, notificationRoutes);
app.use("/api/vendors", cmsProtect, vendorRoutes);
app.use("/api/investment", cmsProtect, investmentRoutes);
app.use("/api/reports", cmsProtect, reportRoutes);
app.use("/api/ledger", cmsProtect, ledgerRoutes);

// Test endpoints
app.get("/api/test-upload/:filename", (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    return res.json({
      exists: true,
      url: `http://${HOST}:${PORT}/uploads/${req.params.filename}`,
      size: fs.statSync(filePath).size,
      mimeType: getMimeType(filePath),
    });
  }
  res.status(404).json({ exists: false, message: "File not found" });
});

app.get("/api/test-receipt/:filename", (req, res) => {
  const filePath = path.join(receiptsDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    return res.json({
      exists: true,
      url: `http://${HOST}:${PORT}/receipts/${req.params.filename}`,
      size: fs.statSync(filePath).size,
      mimeType: getMimeType(filePath),
    });
  }
  res.status(404).json({ exists: false, message: "File not found" });
});

// MIME helper
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
    ".svg": "image/svg+xml",
    ".txt": "text/plain",
    ".json": "application/json",
  };
  return types[ext] || "application/octet-stream";
}

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    serverTime: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    rateLimiting: "Disabled",
    caching: "Enabled (in-memory)",
    features: {
      vendors: true,
      vendorRoutes: ["/api/vendors", "GET|POST /", "GET|PUT|DELETE /:id"],
    },
    static: {
      uploadsCount: fs.readdirSync(uploadsDir).length,
      receiptsCount: fs.readdirSync(receiptsDir).length,
    },
  });
});

// Dev clear cache
if (process.env.NODE_ENV === "development") {
  app.post("/api/clear-cache", async (req, res) => {
    const { key } = req.body;
    const cleared = await clearCache(key);
    res.json({ success: true, cleared: key ? `for ${key}` : "all" });
  });
}

// Welcome
app.get("/", (req, res) => {
  res.json({
    message: "Mara Ha International Plastic - CMS API",
    version: "1.0.0",
    note: "Rate limiting disabled",
  });
});

// Error handlers
app.use(notFound);
app.use(errorHandler);

// Cron
startCronJobs();

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on http://${HOST}:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
  logger.info(`Rate limiting: DISABLED`);
  logger.info(`Vendor API: POST/GET /api/vendors (cmsProtect)`);

  console.log(`
====================================================
        GYM MANAGEMENT SYSTEM API SERVER
====================================================
PORT:           ${PORT}
RATE LIMIT:     DISABLED
CACHE:          In-memory
====================================================
HEALTH:         http://${HOST}:${PORT}/api/health
====================================================
  `);
});

module.exports = app;