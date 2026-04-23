const nodemailer = require("nodemailer")
const twilio = require("twilio")
const logger = require("../loaders/logger")

// Initialize Twilio client
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

// Initialize email transporter
const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

/**
 * Send SMS message
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} message - SMS message content
 * @returns {Promise} SMS sending result
 */
const sendSMS = async (phoneNumber, message) => {
  try {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      logger.warn("Twilio credentials not configured, SMS not sent")
      return { success: false, error: "SMS service not configured" }
    }

    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    })

    logger.info(`SMS sent successfully to ${phoneNumber}`, {
      messageId: result.sid,
      status: result.status,
    })

    return { success: true, messageId: result.sid, status: result.status }
  } catch (error) {
    logger.error(`Failed to send SMS to ${phoneNumber}:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Send email
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML content
 * @param {string} text - Email text content (optional)
 * @returns {Promise} Email sending result
 */
const sendEmail = async (to, subject, html, text = null) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      logger.warn("Email credentials not configured, email not sent")
      return { success: false, error: "Email service not configured" }
    }

    const mailOptions = {
      from: `"Gym Management System" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML tags for text version
    }

    const result = await emailTransporter.sendMail(mailOptions)

    logger.info(`Email sent successfully to ${to}`, {
      messageId: result.messageId,
      subject,
    })

    return { success: true, messageId: result.messageId }
  } catch (error) {
    logger.error(`Failed to send email to ${to}:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Send bulk SMS to multiple recipients
 * @param {Array} phoneNumbers - Array of phone numbers
 * @param {string} message - SMS message content
 * @returns {Promise} Bulk SMS sending results
 */
const sendBulkSMS = async (phoneNumbers, message) => {
  const results = []

  for (const phoneNumber of phoneNumbers) {
    const result = await sendSMS(phoneNumber, message)
    results.push({ phoneNumber, ...result })

    // Add delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  const successCount = results.filter((r) => r.success).length
  const failureCount = results.length - successCount

  logger.info(`Bulk SMS completed: ${successCount} sent, ${failureCount} failed`)

  return {
    totalSent: successCount,
    totalFailed: failureCount,
    results,
  }
}

/**
 * Send bulk email to multiple recipients
 * @param {Array} recipients - Array of email addresses
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML content
 * @returns {Promise} Bulk email sending results
 */
const sendBulkEmail = async (recipients, subject, html) => {
  const results = []

  for (const recipient of recipients) {
    const result = await sendEmail(recipient, subject, html)
    results.push({ recipient, ...result })

    // Add delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  const successCount = results.filter((r) => r.success).length
  const failureCount = results.length - successCount

  logger.info(`Bulk email completed: ${successCount} sent, ${failureCount} failed`)

  return {
    totalSent: successCount,
    totalFailed: failureCount,
    results,
  }
}

/**
 * Send payment reminder notification
 * @param {Object} member - Member object
 * @param {boolean} isOverdue - Whether payment is overdue
 * @returns {Promise} Notification sending result
 */
const sendPaymentReminder = async (member, isOverdue = false) => {
  const daysOverdue = isOverdue
    ? Math.ceil((new Date() - member.nextPaymentDue) / (1000 * 60 * 60 * 24))
    : Math.ceil((member.nextPaymentDue - new Date()) / (1000 * 60 * 60 * 24))

  const smsMessage = isOverdue
    ? `Hi ${member.firstName}, your gym membership payment is ${daysOverdue} days overdue. Please pay $${member.monthlyFee} immediately to restore access.`
    : `Hi ${member.firstName}, your gym membership payment of $${member.monthlyFee} is due in ${daysOverdue} days. Please pay by ${member.nextPaymentDue.toDateString()}.`

  const emailSubject = isOverdue ? "URGENT: Overdue Payment Notice" : "Payment Reminder"
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${isOverdue ? "#dc3545" : "#007bff"};">${emailSubject}</h2>
      <p>Dear ${member.firstName} ${member.lastName},</p>
      <p>${smsMessage}</p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Payment Details:</h3>
        <p><strong>Member ID:</strong> ${member.memberId}</p>
        <p><strong>Amount Due:</strong> $${member.monthlyFee}</p>
        <p><strong>Due Date:</strong> ${member.nextPaymentDue.toDateString()}</p>
        <p><strong>Membership Type:</strong> ${member.membershipType}</p>
      </div>
      
      ${
        isOverdue
          ? '<p style="color: #dc3545;"><strong>Important:</strong> Your gym access has been suspended due to overdue payment.</p>'
          : ""
      }
      
      <p>Please visit the gym reception or contact us to make your payment.</p>
      <p>Thank you for your prompt attention to this matter.</p>
      
      <hr style="margin: 30px 0;">
      <p style="color: #6c757d; font-size: 12px;">
        This is an automated message from the Gym Management System.<br>
        If you have already made this payment, please disregard this notice.
      </p>
    </div>
  `

  const smsResult = await sendSMS(member.phone, smsMessage)
  const emailResult = await sendEmail(member.email, emailSubject, emailHtml)

  return {
    sms: smsResult,
    email: emailResult,
    member: {
      id: member._id,
      name: member.fullName,
      memberId: member.memberId,
    },
  }
}

/**
 * Test notification services
 * @returns {Promise} Test results
 */
const testNotificationServices = async () => {
  const testResults = {
    sms: { available: false, error: null },
    email: { available: false, error: null },
  }

  // Test SMS service
  try {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      await twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch()
      testResults.sms.available = true
    } else {
      testResults.sms.error = "Twilio credentials not configured"
    }
  } catch (error) {
    testResults.sms.error = error.message
  }

  // Test email service
  try {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await emailTransporter.verify()
      testResults.email.available = true
    } else {
      testResults.email.error = "Email credentials not configured"
    }
  } catch (error) {
    testResults.email.error = error.message
  }

  return testResults
}

module.exports = {
  sendSMS,
  sendEmail,
  sendBulkSMS,
  sendBulkEmail,
  sendPaymentReminder,
  testNotificationServices,
}
