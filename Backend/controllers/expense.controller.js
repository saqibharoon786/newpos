const Expense = require("../models/expense.model");
const mongoose = require("mongoose");

// Normalize date to YYYY-MM-DD so date range filters (Daily/Weekly/Monthly) work
function toNormalizedDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return dateStr;
  const trimmed = dateStr.trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // DD/MM/YYYY
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    const day = d.padStart(2, "0");
    const month = m.padStart(2, "0");
    return `${y}-${month}-${day}`;
  }
  return dateStr;
}

// Get all expenses with filters
// Backend: expenses.controller.js
exports.getAllExpenses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      purpose,
      personResponsible,
      usage,
      startDate,
      endDate,
      search,
    } = req.query;

    // Convert to numbers and validate
    const currentPage = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 per page

    const query = {};

    // Filter by purpose
    if (purpose && ["Car", "Office", "Travel", "Equipment"].includes(purpose)) {
      query.purpose = purpose;
    }

    // Filter by person responsible
    if (
      personResponsible &&
      ["HR", "Admin", "CEO", "Finance Dept"].includes(personResponsible)
    ) {
      query.personResponsible = personResponsible;
    }

    // Filter by usage
    if (usage && ["Personal", "Company"].includes(usage)) {
      query.usage = usage;
    }

    // Filter by date range (startDate/endDate as YYYY-MM-DD; backend normalizes on create/update)
    if (startDate || endDate) {
      const normStart = startDate ? toNormalizedDate(startDate) : null;
      const normEnd = endDate ? toNormalizedDate(endDate) : null;
      query.date = {};
      if (normStart) query.date.$gte = normStart;
      if (normEnd) query.date.$lte = normEnd;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const sortDirection = sortOrder === "desc" ? -1 : 1;
    const sortOptions = { [sortBy]: sortDirection };

    // Calculate skip value
    const skip = (currentPage - 1) * pageSize;

    // Execute queries in parallel for better performance
    const [expenses, total] = await Promise.all([
      Expense.find(query)
        .sort(sortOptions)
        .limit(pageSize)
        .skip(skip)
        .select("-__v"),
      Expense.countDocuments(query),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / pageSize);
    const hasNext = currentPage < totalPages;
    const hasPrevious = currentPage > 1;

    res.json({
      success: true,
      data: expenses,
      pagination: {
        currentPage: currentPage,
        totalPages: totalPages,
        totalItems: total,
        itemsPerPage: pageSize,
        hasNext: hasNext,
        hasPrevious: hasPrevious,
      },
    });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching expenses",
      error: error.message,
    });
  }
};

// Get single expense by ID
exports.getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      });
    }

    const expense = await Expense.findById(id).select("-__v");

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    res.json({
      success: true,
      data: expense,
    });
  } catch (error) {
    console.error("Error fetching expense:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching expense",
      error: error.message,
    });
  }
};

// Create new expense
exports.createExpense = async (req, res) => {
  try {
    const {
      subject,
      description,
      purpose,
      price,
      personResponsible,
      usage,
      date,
      time,
    } = req.body;

    // Validation
    if (!subject || !description || !price || !date || !time) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Create expense object (date normalized to YYYY-MM-DD so Daily/Weekly/Monthly filters work)
    const expenseData = {
      subject,
      description,
      purpose: purpose || "Car",
      price,
      personResponsible: personResponsible || "HR",
      usage: usage || "Personal",
      date: toNormalizedDate(date),
      time,
    };

    const expense = await Expense.create(expenseData);

    res.status(201).json({
      success: true,
      message: "Expense created successfully",
      data: expense,
    });
  } catch (error) {
    console.error("Error creating expense:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while creating expense",
      error: error.message,
    });
  }
};

// Update expense
exports.updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    if (updateData.date) {
      updateData.date = toNormalizedDate(updateData.date);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      });
    }

    const expense = await Expense.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-__v");

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    res.json({
      success: true,
      message: "Expense updated successfully",
      data: expense,
    });
  } catch (error) {
    console.error("Error updating expense:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while updating expense",
      error: error.message,
    });
  }
};

// Delete expense
exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      });
    }

    const expense = await Expense.findByIdAndDelete(id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    res.json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting expense:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting expense",
      error: error.message,
    });
  }
};

// Get expense statistics (same filters as get-all so Total Expense matches filtered list)
exports.getExpenseStats = async (req, res) => {
  try {
    const { startDate, endDate, purpose, personResponsible, usage } = req.query;

    const matchStage = {};

    if (startDate || endDate) {
      const normStart = startDate ? toNormalizedDate(startDate) : null;
      const normEnd = endDate ? toNormalizedDate(endDate) : null;
      matchStage.date = {};
      if (normStart) matchStage.date.$gte = normStart;
      if (normEnd) matchStage.date.$lte = normEnd;
    }

    if (purpose && ["Car", "Office", "Travel", "Equipment"].includes(purpose)) {
      matchStage.purpose = purpose;
    }
    if (personResponsible && ["HR", "Admin", "CEO", "Finance Dept"].includes(personResponsible)) {
      matchStage.personResponsible = personResponsible;
    }
    if (usage && ["Personal", "Company"].includes(usage)) {
      matchStage.usage = usage;
    }

    const stats = await Expense.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalExpenses: {
            $sum: {
              $toDouble: {
                $replaceOne: { input: "$price", find: ",", replacement: "" },
              },
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          totalExpenses: 1,
          count: 1,
        },
      },
    ]);

    // Expenses by purpose
    const purposeStats = await Expense.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$purpose",
          total: {
            $sum: {
              $toDouble: {
                $replaceOne: { input: "$price", find: ",", replacement: "" },
              },
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Expenses by person responsible
    const personStats = await Expense.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$personResponsible",
          total: {
            $sum: {
              $toDouble: {
                $replaceOne: { input: "$price", find: ",", replacement: "" },
              },
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        summary: stats[0] || {
          totalExpenses: 0,
          count: 0,
        },
        byPurpose: purposeStats,
        byPerson: personStats,
      },
    });
  } catch (error) {
    console.error("Error fetching expense stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching expense statistics",
      error: error.message,
    });
  }
};