const express = require("express")
const router = express.Router()

// Import all routes
const authRoutes = require("./auth.routes")
const userRoutes = require("./user.routes")
const customerRoutes = require("./customer.route")
const memberRoutes = require("./member.routes")
const staffRoutes = require("./staff.routes")
const employeeRoutes = require("./employee.route")
const attendenceRoutes = require("./attendence.routes")
const paymentRoutes = require("./payment.routes")
const expenseRoutes = require("./expense.route")
const dashboardRoutes = require("./dashboard.route")
const financeRoutes = require("./finance.route")
const posRoutes = require("./pos.routes")
const popRoutes = require("./pop.routes")
const processRoutes = require("./process.route")
const assetsRoutes = require("./assets.route")

// Use routes
router.use("/auth", authRoutes)
router.use("/users", userRoutes)
router.use("/customers", customerRoutes)
router.use("/members", memberRoutes)
// router.use("/staff", staffRoutes) // Commented out - all code is commented
router.use("/employees", employeeRoutes)
router.use("/attendance", attendenceRoutes)
router.use("/payments", paymentRoutes)
router.use("/expenses", expenseRoutes)
router.use("/dashboard", dashboardRoutes)
router.use("/finance", financeRoutes)
router.use("/pos", posRoutes)
router.use("/pop", popRoutes)
router.use("/process", processRoutes)
router.use("/assets", assetsRoutes)

module.exports = router