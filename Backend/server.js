const express = require("express");
const path = require("path");
const fs = require("fs");

const connectDB = require("./loaders/connectionDB");
const logger = require("./loaders/logger");

const { startCronJobs } = require("./utils/cron");

const { notFound, errorHandler } = require("./middleware/errorHandler");

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

connectDB();

const uploadsDir = path.join(__dirname, "uploads");
const receiptsDir = path.join(__dirname, "receipts");

[uploadsDir, receiptsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Created directory: ${dir}`);
  }
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/uploads", express.static(uploadsDir));
app.use("/receipts", express.static(receiptsDir));

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
app.use("/api/finance", financeRoutes);
app.use("/api/process", processRoutes);
app.use("/api/processing", processRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    time: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use(notFound);
app.use(errorHandler);

startCronJobs();

app.listen(PORT, HOST, () => {
  logger.info(`Server running on http://${HOST}:${PORT}`);
  console.log(`Server running on http://${HOST}:${PORT}`);
});

module.exports = app;