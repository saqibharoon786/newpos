const Expense = require("../models/expense.model");
const Transaction = require("../models/transaction.model");
const mongoose = require("mongoose");
const {
  reverseExpenseFinanceTransaction,
  findFinanceTransactionForExpense,
} = require("../utils/expenseFinanceDelete");

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

/** Expense form date + time → Finance Transaction.date (not today's createdAt). */
function parseExpenseFinanceDate(dateStr, timeStr) {
  const normalized = toNormalizedDate(dateStr);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return new Date();
  }
  const [y, m, d] = normalized.split("-").map(Number);
  let hours = 12;
  let minutes = 0;
  if (timeStr) {
    const match = String(timeStr).trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      const ampm = (match[3] || "").toUpperCase();
      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;
    }
  }
  return new Date(y, m - 1, d, hours, minutes, 0, 0);
}

async function syncExpenseFinanceTransactionDate(expense) {
  if (!expense) return;
  const tx = await findFinanceTransactionForExpense(expense);
  if (!tx) return;
  const nextDate = parseExpenseFinanceDate(expense.date, expense.time);
  if (tx.date && new Date(tx.date).getTime() === nextDate.getTime()) return;
  await Transaction.findByIdAndUpdate(tx._id, { date: nextDate });
}

function resolveExpenseSubject({ subject, purpose, description, category }) {
  const fromSubject = String(subject || "").trim();
  if (fromSubject) return fromSubject;
  const fromPurpose = String(purpose || category || "").trim();
  if (fromPurpose) return fromPurpose;
  const fromDesc = String(description || "").trim();
  if (fromDesc) return fromDesc.slice(0, 120);
  return "Expense";
}

/**
 * Aggregation expression: normalize stored `date` (YYYY-MM-DD or DD/MM/YYYY) to YYYY-MM-DD
 * so range filters include all legacy rows (string $gte/$lte on mixed formats misses DD/MM/YYYY).
 */
const expenseDateNormExpr = {
  $let: {
    vars: {
      raw: { $ifNull: ["$date", ""] },
      parts: { $split: [{ $ifNull: ["$date", ""] }, "/"] },
    },
    in: {
      $switch: {
        branches: [
          {
            case: { $regexMatch: { input: "$$raw", regex: /^\d{4}-\d{2}-\d{2}$/ } },
            then: "$$raw",
          },
          {
            case: { $regexMatch: { input: "$$raw", regex: /^\d{1,2}\/\d{1,2}\/\d{4}$/ } },
            then: {
              $concat: [
                { $arrayElemAt: ["$$parts", 2] },
                "-",
                {
                  $let: {
                    vars: { mo: { $arrayElemAt: ["$$parts", 1] } },
                    in: {
                      $cond: [
                        { $lt: [{ $strLenCP: "$$mo" }, 2] },
                        { $concat: ["0", "$$mo"] },
                        "$$mo",
                      ],
                    },
                  },
                },
                "-",
                {
                  $let: {
                    vars: { da: { $arrayElemAt: ["$$parts", 0] } },
                    in: {
                      $cond: [
                        { $lt: [{ $strLenCP: "$$da" }, 2] },
                        { $concat: ["0", "$$da"] },
                        "$$da",
                      ],
                    },
                  },
                },
              ],
            },
          },
        ],
        default: "$$raw",
      },
    },
  },
};

function buildBaseFilterMatch(purpose, personResponsible, usage) {
  const m = {};
  if (purpose && ["Car", "Office", "Travel", "Equipment"].includes(purpose)) {
    m.purpose = purpose;
  }
  if (
    personResponsible &&
    ["HR", "Admin", "CEO", "Finance Dept"].includes(personResponsible)
  ) {
    m.personResponsible = personResponsible;
  }
  if (usage && ["Personal", "Company"].includes(usage)) {
    m.usage = usage;
  }
  return m;
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

    const currentPage = Math.max(1, parseInt(page, 10));
    const pageSize = Math.min(1000, Math.max(1, parseInt(limit, 10)));

    const sortDirection = sortOrder === "desc" ? -1 : 1;
    const skip = (currentPage - 1) * pageSize;

    const baseMatch = buildBaseFilterMatch(purpose, personResponsible, usage);
    const normStart = startDate ? toNormalizedDate(startDate) : null;
    const normEnd = endDate ? toNormalizedDate(endDate) : null;
    const hasDateFilter = !!(normStart || normEnd);

    if (!hasDateFilter) {
      const query = { ...baseMatch };
      if (search) {
        query.$or = [
          { subject: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }
      const sortOptions = { [sortBy]: sortDirection };
      const [expenses, total] = await Promise.all([
        Expense.find(query)
          .sort(sortOptions)
          .limit(pageSize)
          .skip(skip)
          .select("-__v"),
        Expense.countDocuments(query),
      ]);
      const totalPages = Math.ceil(total / pageSize);
      return res.json({
        success: true,
        data: expenses,
        pagination: {
          currentPage,
          totalPages,
          totalItems: total,
          itemsPerPage: pageSize,
          hasNext: currentPage < totalPages,
          hasPrevious: currentPage > 1,
        },
      });
    }

    const dateRange = {};
    if (normStart) dateRange.$gte = normStart;
    if (normEnd) dateRange.$lte = normEnd;

    const pipeline = [];
    if (Object.keys(baseMatch).length) {
      pipeline.push({ $match: baseMatch });
    }
    pipeline.push({ $addFields: { _expDateNorm: expenseDateNormExpr } });
    pipeline.push({ $match: { _expDateNorm: dateRange } });

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { subject: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    const sortField = sortBy === "date" ? "_expDateNorm" : sortBy;

    const [listResult, countResult] = await Promise.all([
      Expense.aggregate([
        ...pipeline,
        { $sort: { [sortField]: sortDirection } },
        { $skip: skip },
        { $limit: pageSize },
        { $project: { _expDateNorm: 0 } },
      ]),
      Expense.aggregate([...pipeline, { $count: "c" }]),
    ]);

    const total = countResult[0]?.c ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    res.json({
      success: true,
      data: listResult,
      pagination: {
        currentPage,
        totalPages,
        totalItems: total,
        itemsPerPage: pageSize,
        hasNext: currentPage < totalPages,
        hasPrevious: currentPage > 1,
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
      paymentMethod,
      category,
    } = req.body;

    // Validation
    if (!description || !price || !date || !time) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    const resolvedSubject = resolveExpenseSubject({
      subject,
      purpose,
      description,
      category,
    });

    // Create expense object (date normalized to YYYY-MM-DD so Daily/Weekly/Monthly filters work)
    const priceNum = parseFloat(String(price).replace(/[^\d.]/g, '')) || 0;
    const method = paymentMethod === 'cash' ? 'drawer' : (paymentMethod || 'drawer');

    const financeDate = parseExpenseFinanceDate(date, time);

    let walletNote = null;
    let financeTransaction = null;
    if (priceNum > 0 && ['drawer', 'easypaisa', 'jazzcash', 'bank'].includes(method)) {
      try {
        const balances = await Transaction.getBalances();
        if ((balances[method] || 0) >= priceNum) {
          financeTransaction = await Transaction.create({
            type: 'withdraw',
            method,
            amount: priceNum,
            net: priceNum,
            description: `Expense: ${resolvedSubject}`,
            reference: `EXP-PENDING-${Date.now()}`,
            status: 'completed',
            date: financeDate,
          });
        } else {
          walletNote = `Kharcha save ho gaya (wallet mein balance kam tha: ${method})`;
        }
      } catch (walletErr) {
        console.warn('Expense wallet deduction skipped:', walletErr.message);
        walletNote = 'Kharcha save ho gaya (wallet update skip)';
      }
    }

    const expenseData = {
      subject: resolvedSubject,
      description,
      purpose: purpose || "Office",
      price,
      personResponsible: personResponsible || "HR",
      usage: usage || "Company",
      date: toNormalizedDate(date),
      time,
      paymentMethod: method,
      category: category || purpose || "General",
      transactionId: financeTransaction?._id,
    };

    const expense = await Expense.create(expenseData);

    if (financeTransaction) {
      financeTransaction.reference = `EXP-${expense._id}`;
      await financeTransaction.save();
    }

    res.status(201).json({
      success: true,
      message: walletNote || "Expense created successfully",
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
    updateData.subject = resolveExpenseSubject({
      subject: updateData.subject,
      purpose: updateData.purpose,
      description: updateData.description,
      category: updateData.category,
    });

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

    if (updateData.date || updateData.time) {
      try {
        await syncExpenseFinanceTransactionDate(expense);
      } catch (syncErr) {
        console.warn("Expense finance date sync skipped:", syncErr.message);
      }
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

    const expense = await Expense.findById(id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    const financeResult = await reverseExpenseFinanceTransaction(expense);
    await Expense.findByIdAndDelete(id);

    const balances = await Transaction.getBalances();

    res.json({
      success: true,
      message: financeResult.reversed
        ? financeResult.message
        : "Expense deleted successfully",
      financeReversed: financeResult.reversed,
      amountReversed: financeResult.amountReversed,
      balances,
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

    const baseMatch = buildBaseFilterMatch(purpose, personResponsible, usage);
    const normStart = startDate ? toNormalizedDate(startDate) : null;
    const normEnd = endDate ? toNormalizedDate(endDate) : null;
    const hasDateFilter = !!(normStart || normEnd);

    const preGroup = [];
    if (Object.keys(baseMatch).length) {
      preGroup.push({ $match: baseMatch });
    }
    if (hasDateFilter) {
      const dateRange = {};
      if (normStart) dateRange.$gte = normStart;
      if (normEnd) dateRange.$lte = normEnd;
      preGroup.push({ $addFields: { _expDateNorm: expenseDateNormExpr } });
      preGroup.push({ $match: { _expDateNorm: dateRange } });
    }

    const stats = await Expense.aggregate([
      ...preGroup,
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
      ...preGroup,
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
      ...preGroup,
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