// services/member.service.js
const Member = require("../models/member.model");
const logger = require("../loaders/logger");

class MemberService {
  // Create new member
  async createMember(memberData, createdBy) {
    try {
      // Guard: existing by email or phone
      const existingMember = await Member.findOne({
        $or: [{ email: memberData.email }, { phone: memberData.phone }],
      });
      if (existingMember) {
        throw new Error("Member already exists with this email or phone");
      }

      const member = new Member({
        ...memberData,
        createdBy,
      });

      await member.save();

      logger.info(`New member created: ${member.memberId} - ${member.fullName}`);

      return member;
    } catch (error) {
      logger.error("Create member error:", error);
      throw error;
    }
  }

  // Get member by ID
  async getMemberById(memberId) {
    try {
      const member = await Member.findById(memberId)
        .populate({ path: "createdBy", select: "firstName lastName" })
        .populate({ path: "notes.addedBy", select: "firstName lastName" });

      if (!member) {
        throw new Error("Member not found");
      }
      return member;
    } catch (error) {
      logger.error("Get member error:", error);
      throw error;
    }
  }

  // Get all members with pagination and filters
  async getMembers(filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;

      const query = {};
      if (filters.search) {
        query.$or = [
          { firstName: { $regex: filters.search, $options: "i" } },
          { lastName:  { $regex: filters.search, $options: "i" } },
          { email:     { $regex: filters.search, $options: "i" } },
          { memberId:  { $regex: filters.search, $options: "i" } },
        ];
      }
      if (filters.membershipType) query.membershipType = filters.membershipType;
      if (filters.paymentStatus)  query.paymentStatus  = filters.paymentStatus;
      if (filters.isActive !== undefined) query.isActive = filters.isActive;

      const [members, total] = await Promise.all([
        Member.find(query)
          .populate({ path: "createdBy", select: "firstName lastName" })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Member.countDocuments(query),
      ]);

      return {
        members,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
        },
      };
    } catch (error) {
      logger.error("Get members error:", error);
      throw error;
    }
  }

  // Update member
  async updateMember(memberId, updateData) {
    try {
      const member = await Member.findByIdAndUpdate(
        memberId,
        updateData,
        { new: true, runValidators: true }
      )
        .populate({ path: "createdBy", select: "firstName lastName" });

      if (!member) {
        throw new Error("Member not found");
      }

      logger.info(`Member updated: ${member.memberId} - ${member.fullName}`);
      return member;
    } catch (error) {
      logger.error("Update member error:", error);
      throw error;
    }
  }

  // Delete member (soft delete)
  async deleteMember(memberId) {
    try {
      const member = await Member.findByIdAndUpdate(
        memberId,
        { isActive: false },
        { new: true }
      );

      if (!member) {
        throw new Error("Member not found");
      }

      logger.info(`Member deactivated: ${member.memberId} - ${member.fullName}`);
      return member;
    } catch (error) {
      logger.error("Delete member error:", error);
      throw error;
    }
  }

  // Add note to member
  async addMemberNote(memberId, note, addedBy) {
    try {
      const member = await Member.findById(memberId);
      if (!member) throw new Error("Member not found");

      member.notes.push({
        note,
        addedBy,
        addedAt: new Date(),
      });

      await member.save();
      logger.info(`Note added to member: ${member.memberId}`);

      return member;
    } catch (error) {
      logger.error("Add member note error:", error);
      throw error;
    }
  }

  // Check overdue payments
  async getOverdueMembers() {
    try {
      const now = new Date();
      const gracePeriod = 30 * 24 * 60 * 60 * 1000; // 30 days
      const overdueDate = new Date(now.getTime() - gracePeriod);

      const overdueMembers = await Member.find({
        paymentStatus: { $in: ["unpaid", "overdue"] },
        nextPaymentDue: { $lt: overdueDate },
        isActive: true,
      });

      return overdueMembers;
    } catch (error) {
      logger.error("Get overdue members error:", error);
      throw error;
    }
  }

  // Update payment status
  async updatePaymentStatus(memberId, paymentStatus, paymentDate = null) {
    try {
      const updateData = { paymentStatus };
      if (paymentDate) {
        updateData.lastPaymentDate = paymentDate;
        const nextDue = new Date(paymentDate);
        nextDue.setDate(nextDue.getDate() + 30);
        updateData.nextPaymentDue = nextDue;
      }

      const member = await Member.findByIdAndUpdate(
        memberId,
        updateData,
        { new: true }
      );

      if (!member) {
        throw new Error("Member not found");
      }

      logger.info(`Payment status updated for member: ${member.memberId} - ${paymentStatus}`);
      return member;
    } catch (error) {
      logger.error("Update payment status error:", error);
      throw error;
    }
  }
}

module.exports = new MemberService();
