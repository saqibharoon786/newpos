const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const connectDB = require("./loaders/connectionDB");
const logger = require("./loaders/logger");

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

// const gymPlan = require('./routes/gymPlan.routes')
// const doorRoutes = require("./routes/doorRoutes");
// const attendanceRoutes = require("./routes/attendanceRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to database
connectDB();

// CORS (set once, do not call app.use(cors()) again later)
app.use(cors({
  origin: process.env.FRONTEND_URL, 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(helmet());
app.use(morgan("combined", { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use("/api/", limiter);

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
// app.use('/api/gym-plan', gymPlan)
// app.use("/api/door", doorRoutes);
// app.use("/api/attendance", attendanceRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Gym Management System API is running" });
});

// 404 + Error handler (order matters)
app.use(notFound);
app.use(errorHandler);

// Start cron jobs
startCronJobs();

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
