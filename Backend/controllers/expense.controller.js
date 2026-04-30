const Expense = require("../models/expense.model");
const mongoose = require("mongoose");
const { asyncHandler } = require("../utils/asyncHandler");

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
exports.getAllExpenses = asyncHandler(async (req, res) => {
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
});

// Get single expense by ID
exports.getExpenseById = asyncHandler(async (req, res) => {
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
});

// Create new expense
exports.createExpense = asyncHandler(async (req, res) => {
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
});

// Update expense
exports.updateExpense = asyncHandler(async (req, res) => {
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
});

// Delete expense
exports.deleteExpense = asyncHandler(async (req, res) => {
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
});

// Get expense statistics (same filters as get-all so Total Expense matches filtered list)
exports.getExpenseStats = asyncHandler(async (req, res) => {
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
});