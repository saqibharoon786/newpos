const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const compression = require("compression");

// Database & logger
const connectDB = require("./loaders/connectionDB");
const logger = require("./loaders/logger");

// Cron
const { startCronJobs } = require("./utils/cron");

// Middleware
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { cacheMiddleware, clearCache } = require("./middleware/cacheMiddleware");
const { RATE_LIMITS } = require("./middleware/constants");

// Routes
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

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

// ================= DATABASE =================
connectDB();

// ================= DIRECTORIES =================
const uploadsDir = path.join(__dirname, "uploads");
const receiptsDir = path.join(__dirname, "receipts");

[uploadsDir, receiptsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Created directory: ${dir}`);
  }
});

// ================= SECURITY & CONFIG =================
app.set("trust proxy", 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// ================= CORS =================
const allowedOrigins = [
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:3000",
  "http://localhost:3001",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization", "Cache-Control", "Pragma"],
  })
);

// ================= RATE LIMITING =================
const limiter = rateLimit({
  windowMs: RATE_LIMITS.GENERAL.windowMs,
  max: RATE_LIMITS.GENERAL.max,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
});
app.use("/api/", limiter);

// ================= BODY PARSER =================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ================= SANITIZATION =================
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// ================= COMPRESSION =================
app.use(compression());

// ================= LOGGING =================
app.use(
  morgan("combined", {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);

// ================= STATIC FILES =================
app.use("/uploads", express.static(uploadsDir));
app.use("/receipts", express.static(receiptsDir));

// ================= ROUTES =================
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/members", cacheMiddleware(300), memberRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/purchases", popRoutes);
app.use("/api/sales", posRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/dashboard", cacheMiddleware(30), dashboardRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/process", processRoutes);
app.use("/api/processing", processRoutes); // alias

// ================= HEALTH CHECK =================
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    time: new Date().toISOString(),
  });
});

// ================= ROOT =================
app.get("/", (req, res) => {
  res.send("API is running...");
});

// ================= DEV CACHE CLEAR =================
if (process.env.NODE_ENV === "development") {
  app.post("/api/clear-cache", async (req, res) => {
    const { key } = req.body;
    await clearCache(key);
    res.json({ success: true });
  });
}

// ================= ERROR HANDLERS =================
app.use(notFound);
app.use(errorHandler);

// ================= CRON =================
startCronJobs();

// ================= SERVER START =================
app.listen(PORT, HOST, () => {
  logger.info(`Server running on http://${HOST}:${PORT}`);
  console.log(`Server running on http://${HOST}:${PORT}`);
});

module.exports = app;
