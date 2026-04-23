// controllers/member.controller.js
const Member = require("../models/member.model");
const Payment = require("../models/payment.model");
const logger = require("../loaders/logger");
const { generateResponse } = require("../utils/response");
const memberService = require("../services/member.service");

// CREATE
// @route   POST /api/members
// @access  Private (Staff only)
const createMember = async (req, res, next) => {
  try {
    const memberData = {
      ...req.body,
      createdBy: req.user._id || req.user.id || req.user.userId,
    };
    console.log("CreateBy",req.user._id)
    // membership dates
    const startDate = new Date(memberData.membershipStartDate || Date.now());
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);
    
    memberData.membershipEndDate = endDate;
    memberData.nextPaymentDue = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      startDate.getDate()
    );

    const member = await Member.create(memberData);

    // initial payment (optional)
    await Payment.create({
      member: member._id,
      amount: member.monthlyFee,
      paymentType: "membership_fee",
      paymentMethod: req.body.paymentMethod || "cash",
      paymentStatus: "completed",
      dueDate: startDate,
      periodCovered: {
        startDate,
        endDate: new Date(
          startDate.getFullYear(),
          startDate.getMonth() + 1,
          startDate.getDate()
        ),
      },
      processedBy: memberData.createdBy,
    });

   await member.populate([
  { path: "createdBy", select: "firstName lastName" },
]);


    logger.info(`New member created: ${member.fullName}`, {
      memberId: member._id,
      membershipType: member.membershipType,
      createdBy: memberData.createdBy,
    });

    res.status(201).json(
      generateResponse(true, "Member created successfully", {
        member: {
          id: member._id,
          memberId: member.memberId,
          firstName: member.firstName,
          lastName: member.lastName,
          fullName: member.fullName,
          email: member.email,
          phone: member.phone,
          membershipType: member.membershipType,
          membershipStatus: member.membershipStatus,
          monthlyFee: member.monthlyFee,
          paymentStatus: member.paymentStatus,
          doorAccessEnabled: member.doorAccessEnabled,
          createdBy: member.createdBy,
          createdAt: member.createdAt,
        },
      })
    );
    console.log("The member is",member)
  } catch (error) {
    logger.error("Create member error:", error);
    next(error);
  }
};

// LIST
// @route   GET /api/members
// @access  Private (Staff only)
const getAllMembers = async (req, res, next) => {
  try {
    const page = Number.parseInt(req.query.page) || 1;
    const limit = Number.parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.membershipType) filter.membershipType = req.query.membershipType;
    if (req.query.paymentStatus)  filter.paymentStatus  = req.query.paymentStatus;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === "true";
    if (req.query.search) {
      filter.$or = [
        { firstName: { $regex: req.query.search, $options: "i" } },
        { lastName:  { $regex: req.query.search, $options: "i" } },
        { email:     { $regex: req.query.search, $options: "i" } },
        { memberId:  { $regex: req.query.search, $options: "i" } },
      ];
    }

    const members = await Member.find(filter)
      .populate({ path: "createdBy", select: "firstName lastName" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Member.countDocuments(filter);

    res.status(200).json(
      generateResponse(true, "Members retrieved successfully", {
        members: members.map((m) => ({
          id: m._id,
          memberId: m.memberId,
          firstName: m.firstName,
          lastName: m.lastName,
          fullName: m.fullName,
          email: m.email,
          phone: m.phone,
          age: m.age,
          membershipType: m.membershipType,
          membershipStatus: m.membershipStatus,
          monthlyFee: m.monthlyFee,
          paymentStatus: m.paymentStatus,
          lastPaymentDate: m.lastPaymentDate,
          nextPaymentDue: m.nextPaymentDue,
          doorAccessEnabled: m.doorAccessEnabled,
          isActive: m.isActive,
          createdBy: m.createdBy,
          createdAt: m.createdAt,
        })),

        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalMembers: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      })
    );
  } catch (error) {
    logger.error("Get all members error:", error);
    next(error);
  }
};

// DETAIL
// @route   GET /api/members/:id
// @access  Private (Staff only)
const getMemberById = async (req, res, next) => {
  try {
    const member = await Member.findById(req.params.id)
      .populate({ path: "createdBy", select: "firstName lastName" });

    if (!member) {
      return res.status(404).json(generateResponse(false, "Member not found", null));
    }

    const recentPayments = await Payment.find({ member: member._id })
      .populate("processedBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json(
      generateResponse(true, "Member retrieved successfully", {
        member: {
          id: member._id,
          memberId: member.memberId,
          firstName: member.firstName,
          lastName: member.lastName,
          fullName: member.fullName,
          email: member.email,
          phone: member.phone,
          dateOfBirth: member.dateOfBirth,
          age: member.age,
          gender: member.gender,
          address: member.address,
          emergencyContact: member.emergencyContact,
          membershipType: member.membershipType,
          membershipStatus: member.membershipStatus,
          membershipStartDate: member.membershipStartDate,
          membershipEndDate: member.membershipEndDate,
          monthlyFee: member.monthlyFee,
          paymentStatus: member.paymentStatus,
          lastPaymentDate: member.lastPaymentDate,
          nextPaymentDue: member.nextPaymentDue,
          doorAccessEnabled: member.doorAccessEnabled,
          profilePicture: member.profilePicture,
          medicalConditions: member.medicalConditions,
          fitnessGoals: member.fitnessGoals,
          isActive: member.isActive,
          createdBy: member.createdBy,
          notes: member.notes,
          createdAt: member.createdAt,
          updatedAt: member.updatedAt,
        },
        recentPayments: recentPayments.map((p) => ({
          id: p._id,
          paymentId: p.paymentId,
          amount: p.amount,
          paymentType: p.paymentType,
          paymentMethod: p.paymentMethod,
          paymentStatus: p.paymentStatus,
          paymentDate: p.paymentDate,
          processedBy: p.processedBy,
        })),
      })
    );
  } catch (error) {
    logger.error("Get member by ID error:", error);
    next(error);
  }
};

// UPDATE
// @route   PUT /api/members/:id
// @access  Private (Staff only)
const updateMember = async (req, res, next) => {
  try {
    const member = await Member.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate({ path: "createdBy", select: "firstName lastName" });

    if (!member) {
      return res.status(404).json(generateResponse(false, "Member not found", null));
    }

    logger.info(`Member updated: ${member.fullName}`, {
      memberId: member._id,
      updatedBy: req.user._id || req.user.id || req.user.userId,
    });

    res.status(200).json(
      generateResponse(true, "Member updated successfully", {
        member: {
          id: member._id,
          memberId: member.memberId,
          firstName: member.firstName,
          lastName: member.lastName,
          fullName: member.fullName,
          email: member.email,
          phone: member.phone,
          membershipType: member.membershipType,
          membershipStatus: member.membershipStatus,
          monthlyFee: member.monthlyFee,
          paymentStatus: member.paymentStatus,
          doorAccessEnabled: member.doorAccessEnabled,
          createdBy: member.createdBy,
          updatedAt: member.updatedAt,
        },
      })
    );
  } catch (error) {
    logger.error("Update member error:", error);
    next(error);
  }
};

// TOGGLE DOOR ACCESS
// @route   PUT /api/members/:id/door-access
// @access  Private (Staff only)
const toggleDoorAccess = async (req, res, next) => {
  try {
    const { enabled } = req.body;
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json(generateResponse(false, "Member not found", null));
    }

    if (enabled) await member.enableDoorAccess();
    else await member.disableDoorAccess();

    logger.info(`Door access ${enabled ? "enabled" : "disabled"} for member: ${member.fullName}`, {
      memberId: member._id,
      updatedBy: req.user._id || req.user.id || req.user.userId,
    });

    res.status(200).json(
      generateResponse(true, `Door access ${enabled ? "enabled" : "disabled"} successfully`, {
        member: {
          id: member._id,
          memberId: member.memberId,
          fullName: member.fullName,
          doorAccessEnabled: member.doorAccessEnabled,
        },
      })
    );
  } catch (error) {
    logger.error("Toggle door access error:", error);
    next(error);
  }
};

// ADD NOTE
// @route   POST /api/members/:id/notes
// @access  Private (Staff only)
const addMemberNote = async (req, res, next) => {
  try {
    const { note } = req.body;
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json(generateResponse(false, "Member not found", null));
    }

    member.notes.push({
      note,
      addedBy: req.user._id || req.user.id || req.user.userId,
    });

    await member.save();
    await member.populate({ path: "notes.addedBy", select: "firstName lastName" });

    logger.info(`Note added to member: ${member.fullName}`, {
      memberId: member._id,
      addedBy: req.user._id || req.user.id || req.user.userId,
    });

    res.status(200).json(
      generateResponse(true, "Note added successfully", {
        note: member.notes[member.notes.length - 1],
      })
    );
  } catch (error) {
    logger.error("Add member note error:", error);
    next(error);
  }
};

// OVERDUE
// @route   GET /api/members/overdue
// @access  Private (Staff only)
const getOverdueMembers = async (req, res, next) => {
  try {
    const now = new Date();
    const gracePeriod = 30 * 24 * 60 * 60 * 1000; // 30 days

    const overdueMembers = await Member.find({
      paymentStatus: "unpaid",
      nextPaymentDue: { $lt: new Date(now - gracePeriod) },
      isActive: true,
    }).select("firstName lastName email phone memberId nextPaymentDue monthlyFee");

    res.status(200).json(
      generateResponse(true, "Overdue members retrieved successfully", {
        members: overdueMembers.map((m) => ({
          id: m._id,
          memberId: m.memberId,
          fullName: m.fullName,
          email: m.email,
          phone: m.phone,
          nextPaymentDue: m.nextPaymentDue,
          monthlyFee: m.monthlyFee,
          daysOverdue: Math.ceil((now - m.nextPaymentDue) / (1000 * 60 * 60 * 24)),
        })),
        totalOverdue: overdueMembers.length,
      })
    );
  } catch (error) {
    logger.error("Get overdue members error:", error);
    next(error);
  }
};

// UPDATE PAYMENT STATUS
// @route   PUT /api/members/:id/payment-status
// @access  Private (Staff only)
const updatePaymentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentStatus, paymentDate } = req.body;

    const allowed = ["paid", "unpaid", "overdue"];
    if (!allowed.includes(paymentStatus)) {
      return res
        .status(400)
        .json(generateResponse(false, "paymentStatus must be one of: paid, unpaid, overdue"));
    }

    const member = await memberService.updatePaymentStatus(id, paymentStatus, paymentDate);

    logger.info(`Payment status updated: ${member.memberId} -> ${member.paymentStatus}`, {
      memberId: member._id,
      by: req.user._id || req.user.id || req.user.userId,
    });

    return res.status(200).json(
      generateResponse(true, "Payment status updated successfully", {
        member: {
          id: member._id,
          memberId: member.memberId,
          fullName: member.fullName,
          paymentStatus: member.paymentStatus,
          lastPaymentDate: member.lastPaymentDate,
          nextPaymentDue: member.nextPaymentDue,
          monthlyFee: member.monthlyFee,
          updatedAt: member.updatedAt,
        },
      })
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createMember,
  getAllMembers,
  getMemberById,
  updateMember,
  toggleDoorAccess,
  addMemberNote,
  getOverdueMembers,
  updatePaymentStatus,
};
