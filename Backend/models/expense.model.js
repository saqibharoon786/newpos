const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    purpose: {
      type: String,
      enum: ["Car", "Office", "Travel", "Equipment"],
      default: "Car",
      required: true,
    },
    price: {
      type: String,
      required: [true, "Price is required"],
      trim: true,
    },
    personResponsible: {
      type: String,
      enum: ["HR", "Admin", "CEO", "Finance Dept"],
      default: "HR",
      required: true,
    },
    usage: {
      type: String,
      enum: ["Personal", "Company"],
      default: "Personal",
      required: true,
    },
    date: {
      type: String,
      required: [true, "Date is required"],
      trim: true,
    },
    time: {
      type: String,
      required: [true, "Time is required"],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
expenseSchema.index({ date: -1 });
expenseSchema.index({ purpose: 1 });
expenseSchema.index({ personResponsible: 1 });

module.exports = mongoose.model("Expense", expenseSchema);