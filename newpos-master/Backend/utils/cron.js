// src/utils/cron.js
const cron = require("node-cron");
const Member = require("../models/member.model");
const Payment = require("../models/payment.model");
// FIX: correct filename spelling
const Attendance = require("../models/attendence.model");
const logger = require("../loaders/logger");
const { sendSMS, sendEmail } = require("./notifications");

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const TZ = "Asia/Karachi";
const CRON_PAYMENT_CHECK = process.env.PAYMENT_CHECK_CRON || "0 0 * * *"; // every day 00:00
const CRON_SMS_REMINDER   = process.env.SMS_REMINDER_CRON   || "0 9 * * *"; // every day 09:00

// Guard to avoid crashing when dates are missing
const toDays = (ms) => Math.ceil(ms / (1000 * 60 * 60 * 24));

// ─────────────────────────────────────────────────────────────
// Jobs
// ─────────────────────────────────────────────────────────────
const checkOverduePayments = async () => {
  try {
    logger.info("Starting overdue payment check...");
    const now = new Date();
    const gracePeriodMs = 30 * 24 * 60 * 60 * 1000;

    const overdueMembers = await Member.find({
      paymentStatus: { $ne: "paid" },
      nextPaymentDue: { $lt: new Date(now.getTime() - gracePeriodMs) },
      isActive: true,
    });

    logger.info(`Found ${overdueMembers.length} members with overdue payments`);

    for (const member of overdueMembers) {
      member.paymentStatus = "overdue";
      if (member.doorAccessEnabled) {
        member.doorAccessEnabled = false;
        logger.info(`Door access disabled for overdue member: ${member.fullName}`);
      }
      await member.save();
    }

    logger.info("Overdue payment check completed");
  } catch (error) {
    logger.error("Error in overdue payment check:", error);
  }
};

const sendPaymentReminders = async () => {
  try {
    logger.info("Starting payment reminder process...");

    const now = new Date();
    const reminderWindowMs = 3 * 24 * 60 * 60 * 1000;

    // Due within next 3 days
    const upcomingDueMembers = await Member.find({
      paymentStatus: { $ne: "paid" },
      nextPaymentDue: { $gte: now, $lte: new Date(now.getTime() + reminderWindowMs) },
      isActive: true,
    });

    // Already overdue
    const overdueMembers = await Member.find({
      paymentStatus: "overdue",
      isActive: true,
    });

    const allMembersToRemind = [...upcomingDueMembers, ...overdueMembers];
    logger.info(`Sending payment reminders to ${allMembersToRemind.length} members`);

    for (const member of allMembersToRemind) {
      if (!member.nextPaymentDue) {
        logger.warn(`Skipping ${member.fullName}: nextPaymentDue is missing`);
        continue;
      }

      const isOverdue = member.paymentStatus === "overdue";
      let message;

      if (isOverdue) {
        const daysOverdue = toDays(now - member.nextPaymentDue);
        message = `Hi ${member.firstName}, your gym membership payment is ${daysOverdue} days overdue. Please pay $${member.monthlyFee} to avoid service interruption. Your door access has been disabled.`;
      } else {
        const daysUntilDue = toDays(member.nextPaymentDue - now);
        message = `Hi ${member.firstName}, your gym membership payment of $${member.monthlyFee} is due in ${daysUntilDue} days (${member.nextPaymentDue.toDateString()}). Please pay to avoid service interruption.`;
      }

      try {
        // SMS
        await sendSMS(member.phone, message);

        // Email (FIX: use object signature)
        await sendEmail({
          to: member.email,
          subject: isOverdue ? "Overdue Payment Notice" : "Payment Reminder",
          html: `
            <h2>${isOverdue ? "Payment Overdue" : "Payment Reminder"}</h2>
            <p>Dear ${member.firstName} ${member.lastName},</p>
            <p>${message}</p>
            <p><strong>Member ID:</strong> ${member.memberId}</p>
            <p><strong>Amount Due:</strong> $${member.monthlyFee}</p>
            <p><strong>Due Date:</strong> ${member.nextPaymentDue.toDateString()}</p>
            ${isOverdue ? "<p><strong>Note:</strong> Your door access has been disabled due to overdue payment.</p>" : ""}
            <p>Please contact the gym reception to make your payment.</p>
            <p>Thank you,<br>Gym Management Team</p>
          `,
        });

        logger.info(`Payment reminder sent to ${member.fullName}`);
      } catch (err) {
        logger.error(`Failed to send reminder to ${member.fullName}:`, err);
      }
    }

    logger.info("Payment reminder process completed");
  } catch (error) {
    logger.error("Error in payment reminder process:", error);
  }
};

const generateMonthlyPayments = async () => {
  try {
    logger.info("Starting monthly payment generation...");

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const members = await Member.find({
      isActive: true,
      nextPaymentDue: { $gte: firstDay, $lte: lastDay },
    });

    logger.info(`Generating payment records for ${members.length} members`);

    for (const member of members) {
      if (!member.nextPaymentDue) continue;

      const existing = await Payment.findOne({
        member: member._id,
        paymentType: "membership_fee",
        dueDate: member.nextPaymentDue,
      });

      if (existing) continue;

      const nextMonth = new Date(member.nextPaymentDue);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      await Payment.create({
        member: member._id,
        amount: member.monthlyFee,
        paymentType: "membership_fee",
        paymentMethod: "pending",
        paymentStatus: "pending",
        dueDate: member.nextPaymentDue,
        periodCovered: { startDate: member.nextPaymentDue, endDate: nextMonth },
        processedBy: null,
      });

      member.paymentStatus = "paid";
      await member.save();

      logger.info(`Payment record created for ${member.fullName}`);
    }

    logger.info("Monthly payment generation completed");
  } catch (error) {
    logger.error("Error in monthly payment generation:", error);
  }
};

const cleanupOldLogs = async () => {
  try {
    logger.info("Starting log cleanup...");
    const DoorAccess = require("../models/doorAccess.model");

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const result = await DoorAccess.deleteMany({ accessTime: { $lt: cutoff } });
    logger.info(`Cleaned up ${result.deletedCount} old access log entries`);
  } catch (error) {
    logger.error("Error in log cleanup:", error);
  }
};

const cleanupAttendanceRecords = async () => {
  try {
    logger.info("Starting attendance cleanup...");

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const oldRecords = await Attendance.deleteMany({
      createdAt: { $lt: cutoff },
      status: "checked-out",
    });

    logger.info(`Cleaned up ${oldRecords.deletedCount} old attendance records`);

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const incomplete = await Attendance.find({
      status: "checked-in",
      checkInTime: { $lt: oneDayAgo },
      checkOutTime: null,
    });

    logger.info(`Found ${incomplete.length} incomplete attendance sessions`);

    for (const session of incomplete) {
      const estimatedCheckout = new Date(session.checkInTime);
      estimatedCheckout.setHours(estimatedCheckout.getHours() + 2);

      session.checkOutTime = estimatedCheckout;
      session.notes = `${session.notes || ""} | Auto-checkout: Session exceeded 24 hours`;
      session.status = "incomplete";
      await session.save();

      logger.info(`Auto-checkout completed for incomplete session: ${session._id}`);
    }

    logger.info("Attendance cleanup completed");
  } catch (error) {
    logger.error("Error in attendance cleanup:", error);
  }
};

const generateDailyAttendanceReport = async () => {
  try {
    logger.info("Generating daily attendance report...");

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const report = await Attendance.getDailyAttendanceReport(yesterday);
    const summary = report?.[0] || {
      totalCheckIns: 0,
      uniqueMembers: 0,
      completedSessions: 0,
      totalDuration: 0,
      averageDuration: 0,
    };

    logger.info(`Daily attendance report for ${yesterday.toDateString()}:`, {
      totalCheckIns: summary.totalCheckIns,
      uniqueMembers: summary.uniqueMembers,
      completedSessions: summary.completedSessions,
      averageDuration: Math.round(summary.averageDuration) + " minutes",
    });

    // Optionally email to admin
    // await sendEmail({ to: adminEmail, subject: 'Daily Attendance Report', html: reportHtml })
  } catch (error) {
    logger.error("Error generating daily attendance report:", error);
  }
};

// ─────────────────────────────────────────────────────────────
// Scheduler
// ─────────────────────────────────────────────────────────────
const startCronJobs = () => {
  logger.info("Starting cron jobs...");

  // Daily checks/reminders (Karachi time)
  cron.schedule(CRON_PAYMENT_CHECK, checkOverduePayments, { timezone: TZ });
  cron.schedule(CRON_SMS_REMINDER,   sendPaymentReminders, { timezone: TZ });

  // Monthly payments: 1st of month at 01:00
  cron.schedule("0 1 1 * *", generateMonthlyPayments, { timezone: TZ });

  // Weekly log cleanup: Sunday 02:00
  cron.schedule("0 2 * * 0", cleanupOldLogs, { timezone: TZ });

  // Daily attendance cleanup: 03:00
  cron.schedule("0 3 * * *", cleanupAttendanceRecords, { timezone: TZ });

  // Daily attendance report: 08:00
  cron.schedule("0 8 * * *", generateDailyAttendanceReport, { timezone: TZ });

  logger.info(`All cron jobs started successfully (Timezone: ${TZ})`);
};

// Optional: quick test mode (every minute) if you ever need it
// cron.schedule("* * * * *", sendPaymentReminders, { timezone: TZ });

const stopCronJobs = () => {
  cron.getTasks().forEach((task) => task.stop());
  logger.info("All cron jobs stopped");
};

module.exports = {
  checkOverduePayments,
  sendPaymentReminders,
  generateMonthlyPayments,
  cleanupOldLogs,
  cleanupAttendanceRecords,
  generateDailyAttendanceReport,
  startCronJobs,
  stopCronJobs,
};
