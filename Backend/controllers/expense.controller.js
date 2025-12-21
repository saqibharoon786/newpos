const Expense = require("../models/expense.model");
const mongoose = require("mongoose");

// Get all expenses with filters
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

    // Filter by date range
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = startDate;
      }
      if (endDate) {
        query.date.$lte = endDate;
      }
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

    const expenses = await Expense.find(query)
      .sort(sortOptions)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .select("-__v");

    const total = await Expense.countDocuments(query);

    res.json({
      success: true,
      data: expenses,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
        hasNext: Number(page) * Number(limit) < total,
        hasPrevious: Number(page) > 1,
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

    // Create expense object
    const expenseData = {
      subject,
      description,
      purpose: purpose || "Car",
      price,
      personResponsible: personResponsible || "HR",
      usage: usage || "Personal",
      date,
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
    const updateData = req.body;

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

// Get expense statistics
exports.getExpenseStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const matchStage = {};

    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) matchStage.date.$gte = startDate;
      if (endDate) matchStage.date.$lte = endDate;
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