const Payment = require("../models/payment.model");
const Member = require("../models/member.model");
const memberService = require("./member.service");
const logger = require("../loaders/logger");

class PaymentService {
  // Process payment
  async processPayment(paymentData, processedBy) {
    try {
      // Accept either paymentData.member (ObjectId) or paymentData.memberId (human id like GYM000123)
      let memberDoc = null;

      if (paymentData.member) {
        memberDoc = await Member.findById(paymentData.member);
      } else if (paymentData.memberId) {
        memberDoc = await Member.findOne({ memberId: String(paymentData.memberId).toUpperCase() });
      }

      if (!memberDoc) throw new Error("Member not found");

      // Build payment payload aligned with schema
      const start = paymentData.periodCovered?.startDate
        ? new Date(paymentData.periodCovered.startDate)
        : new Date();

      const end = paymentData.periodCovered?.endDate
        ? new Date(paymentData.periodCovered.endDate)
        : new Date(start.getFullYear(), start.getMonth() + 1, start.getDate());

      const payment = await Payment.create({
        member: memberDoc._id,
        amount: paymentData.amount,
        paymentType: paymentData.paymentType || "membership_fee",
        paymentMethod: paymentData.paymentMethod || "cash",
        paymentStatus: paymentData.paymentStatus || "completed",
        transactionId: paymentData.transactionId || null,
        paymentDate: paymentData.paymentDate ? new Date(paymentData.paymentDate) : new Date(),
        dueDate: paymentData.dueDate ? new Date(paymentData.dueDate) : start,
        periodCovered: { startDate: start, endDate: end },
        receiptUrl: paymentData.receiptUrl || null,
        notes: paymentData.notes || "",
        processedBy,
      });

      // Update member's payment status if payment is completed
      if (payment.paymentStatus === 'completed') {
        try {
          await memberService.updatePaymentStatus(memberDoc._id, "paid", payment.paymentDate);
        } catch (e) {
          logger.warn("memberService.updatePaymentStatus failed", { err: e?.message, memberId: memberDoc._id });
        }
      }

      logger.info(`Payment processed: ${payment.paymentId} for member ${memberDoc.memberId}`);
      return payment;
    } catch (error) {
      logger.error("Process payment error:", error);
      throw error;
    }
  }

  // Get all payments with filters
  async getPayments(filters = {}, pagination = {}) {
    try {
      const page = Number.parseInt(pagination.page) || 1;
      const limit = Number.parseInt(pagination.limit) || 20;
      const skip = (page - 1) * limit;

      const query = {};

      // memberId filter (human readable)
      if (filters.memberId) {
        const member = await Member.findOne({ memberId: String(filters.memberId).toUpperCase() });
        if (member) query.member = member._id; 
        else return { payments: [], pagination: { currentPage: page, totalPages: 0, totalItems: 0, itemsPerPage: limit } };
      }

      if (filters.method) query.paymentMethod = filters.method;
      if (filters.status) query.paymentStatus = filters.status;
      if (filters.type) query.paymentType = filters.type;

      // Date range filter
      if (filters.dateFrom || filters.dateTo) {
        query.paymentDate = {};
        if (filters.dateFrom) query.paymentDate.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.paymentDate.$lte = new Date(filters.dateTo);
      }

      const [payments, total] = await Promise.all([
        Payment.find(query)
          .populate("member", "memberId firstName lastName email phone")
          .populate("processedBy", "firstName lastName")
          .sort({ paymentDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Payment.countDocuments(query),
      ]);

      return {
        payments,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
        },
      };
    } catch (error) {
      logger.error("Get payments error:", error);
      throw error;
    }
  }

  // Get payment by ID
  async getPaymentById(paymentId) {
    try {
      const payment = await Payment.findById(paymentId)
        .populate("member", "memberId firstName lastName email phone")
        .populate("processedBy", "firstName lastName")
        .populate("refundDetails.refundedBy", "firstName lastName");

      if (!payment) throw new Error("Payment not found");
      return payment;
    } catch (error) {
      logger.error("Get payment by ID error:", error);
      throw error;
    }
  }

  // Get payment history for a specific member
  async getMemberPaymentHistory(memberId, filters = {}, pagination = {}) {
    try {
      const page = Number.parseInt(pagination.page) || 1;
      const limit = Number.parseInt(pagination.limit) || 20;
      const skip = (page - 1) * limit;

      // Find member by memberId (human readable ID like GYM000123)
      const member = await Member.findOne({ 
        memberId: String(memberId).toUpperCase() 
      });
      
      if (!member) throw new Error("Member not found");

      const query = { member: member._id };

      // Apply additional filters
      if (filters.method) query.paymentMethod = filters.method;
      if (filters.status) query.paymentStatus = filters.status;
      if (filters.type) query.paymentType = filters.type;

      // Date range filter
      if (filters.startDate || filters.endDate) {
        query.paymentDate = {};
        if (filters.startDate) query.paymentDate.$gte = new Date(filters.startDate);
        if (filters.endDate) query.paymentDate.$lte = new Date(filters.endDate);
      }

      const [payments, total] = await Promise.all([
        Payment.find(query)
          .populate("member", "memberId firstName lastName email phone")
          .populate("processedBy", "firstName lastName")
          .sort({ paymentDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Payment.countDocuments(query)
      ]);

      return {
        member: {
          memberId: member.memberId,
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          phone: member.phone
        },
        payments,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
        },
      };
    } catch (error) {
      logger.error("Get member payment history error:", error);
      throw error;
    }
  }

  // Get member payment summary
  async getMemberPaymentSummary(memberId) {
    try {
      const member = await Member.findOne({ 
        memberId: String(memberId).toUpperCase() 
      });
      
      if (!member) throw new Error("Member not found");

      const summary = await Payment.aggregate([
        { $match: { member: member._id } },
        {
          $group: {
            _id: "$paymentStatus",
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
          }
        }
      ]);

      const totalStats = await Payment.aggregate([
        { $match: { member: member._id } },
        {
          $group: {
            _id: null,
            totalPaid: { $sum: "$amount" },
            totalPayments: { $sum: 1 },
            lastPaymentDate: { $max: "$paymentDate" },
            averagePayment: { $avg: "$amount" }
          }
        }
      ]);

      const latestPayment = await Payment.findOne({ member: member._id })
        .sort({ paymentDate: -1 })
        .populate("processedBy", "firstName lastName");

      return {
        member: {
          memberId: member.memberId,
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          phone: member.phone
        },
        summary: summary.reduce((acc, item) => {
          acc[item._id] = { totalAmount: item.totalAmount, count: item.count };
          return acc;
        }, {}),
        totals: totalStats[0] || { 
          totalPaid: 0, 
          totalPayments: 0, 
          lastPaymentDate: null, 
          averagePayment: 0 
        },
        latestPayment: latestPayment ? {
          _id: latestPayment._id,
          paymentId: latestPayment.paymentId,
          amount: latestPayment.amount,
          paymentDate: latestPayment.paymentDate,
          paymentMethod: latestPayment.paymentMethod,
          paymentStatus: latestPayment.paymentStatus,
          processedBy: latestPayment.processedBy
        } : null
      };
    } catch (error) {
      logger.error("Get member payment summary error:", error);
      throw error;
    }
  }

  // Update payment
  async updatePayment(paymentId, updateData) {
    try {
      const payment = await Payment.findByIdAndUpdate(
        paymentId,
        { ...updateData, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).populate("member", "memberId firstName lastName")
       .populate("processedBy", "firstName lastName");

      if (!payment) throw new Error("Payment not found");

      logger.info(`Payment updated: ${payment.paymentId}`);
      return payment;
    } catch (error) {
      logger.error("Update payment error:", error);
      throw error;
    }
  }

  // Process refund
  async processRefund(paymentId, refundData, refundedBy) {
    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) throw new Error("Payment not found");

      if (payment.paymentStatus !== 'completed') {
        throw new Error("Only completed payments can be refunded");
      }

      const refundAmount = refundData.refundAmount || payment.amount;
      if (refundAmount > payment.amount) {
        throw new Error("Refund amount cannot exceed original payment amount");
      }

      await payment.processRefund(
        refundAmount,
        refundData.reason,
        refundedBy
      );

      // Update member payment status if needed
      try {
        await memberService.updatePaymentStatus(payment.member, "pending");
      } catch (e) {
        logger.warn("memberService.updatePaymentStatus failed after refund", { err: e?.message });
      }

      logger.info(`Payment refunded: ${payment.paymentId}`);
      return payment;
    } catch (error) {
      logger.error("Process refund error:", error);
      throw error;
    }
  }

  // Delete payment
  async deletePayment(paymentId) {
    try {
      const payment = await Payment.findByIdAndDelete(paymentId);
      if (!payment) throw new Error("Payment not found");

      logger.info(`Payment deleted: ${payment.paymentId}`);
      return { message: "Payment deleted successfully" };
    } catch (error) {
      logger.error("Delete payment error:", error);
      throw error;
    }
  }

  // Get payment statistics
  async getPaymentStats(dateRange = {}) {
    try {
      const match = {};
      if (dateRange.startDate || dateRange.endDate) {
        match.paymentDate = {};
        if (dateRange.startDate) match.paymentDate.$gte = new Date(dateRange.startDate);
        if (dateRange.endDate) match.paymentDate.$lte = new Date(dateRange.endDate);
      }

      const pipeline = [
        { $match: match },
        {
          $group: {
            _id: "$paymentStatus",
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ];

      const byStatus = await Payment.aggregate(pipeline);

      const totalsAgg = await Payment.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
            avgAmount: { $avg: "$amount" },
          },
        },
      ]);

      const totals = totalsAgg[0] || { totalAmount: 0, count: 0, avgAmount: 0 };

      // Payment method breakdown
      const methodAgg = await Payment.aggregate([
        { $match: match },
        { $group: { _id: "$paymentMethod", count: { $sum: 1 }, totalAmount: { $sum: "$amount" } } },
      ]);

      const paymentMethodBreakdown = methodAgg.reduce((acc, m) => {
        acc[m._id || "unknown"] = { count: m.count, totalAmount: m.totalAmount };
        return acc;
      }, {});

      // Payment type breakdown
      const typeAgg = await Payment.aggregate([
        { $match: match },
        { $group: { _id: "$paymentType", count: { $sum: 1 }, totalAmount: { $sum: "$amount" } } },
      ]);

      const paymentTypeBreakdown = typeAgg.reduce((acc, t) => {
        acc[t._id || "unknown"] = { count: t.count, totalAmount: t.totalAmount };
        return acc;
      }, {});

      return {
        byStatus,
        totals: { 
          totalRevenue: totals.totalAmount, 
          totalPayments: totals.count, 
          averagePayment: Math.round(totals.avgAmount * 100) / 100 
        },
        paymentMethodBreakdown,
        paymentTypeBreakdown,
      };
    } catch (error) {
      logger.error("Get payment stats error:", error);
      throw error;
    }
  }

  // Generate invoice (placeholder - integrate with your invoice system)
  async generateInvoice(paymentId) {
    try {
      const payment = await Payment.findById(paymentId)
        .populate("member", "memberId firstName lastName email phone address")
        .populate("processedBy", "firstName lastName");

      if (!payment) throw new Error("Payment not found");

      const invoice = {
        invoiceNumber: `INV-${payment.paymentId}`,
        invoiceDate: new Date(),
        payment: {
          id: payment._id,
          paymentId: payment.paymentId,
          amount: payment.amount,
          paymentType: payment.paymentType,
          paymentMethod: payment.paymentMethod,
          paymentDate: payment.paymentDate,
        },
        member: {
          memberId: payment.member.memberId,
          name: `${payment.member.firstName} ${payment.member.lastName}`,
          email: payment.member.email,
          phone: payment.member.phone,
          address: payment.member.address,
        },
        items: [
          {
            description: this.getPaymentTypeDescription(payment.paymentType),
            quantity: 1,
            unitPrice: payment.amount,
            totalPrice: payment.amount,
          },
        ],
        subtotal: payment.amount,
        tax: 0, // Adjust based on your tax requirements
        totalAmount: payment.amount,
        status: payment.paymentStatus === "completed" ? "paid" : payment.paymentStatus,
        dueDate: payment.dueDate,
        notes: payment.notes,
      };

      logger.info(`Invoice generated for payment: ${payment.paymentId}`);
      return invoice;
    } catch (error) {
      logger.error("Generate invoice error:", error);
      throw error;
    }
  }

  getPaymentTypeDescription(paymentType) {
    const descriptions = {
      membership_fee: "Monthly Membership Fee",
      registration_fee: "Registration Fee",
      personal_training: "Personal Training Session",
      equipment_rental: "Equipment Rental",
      other: "Other Service"
    };
    return descriptions[paymentType] || "Payment";
  }
}

module.exports = new PaymentService();