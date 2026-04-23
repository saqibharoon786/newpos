const mongoose = require('mongoose');

const processingMaterialSchema = new mongoose.Schema({
  purchaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    required: true
  },
  receiptNo: {
    type: String,
    required: true
  },
  materialName: {
    type: String,
    required: true
  },
  quality: {
    type: String,
    required: true
  },
  color: {
    type: String,
    default: '#FFFFFF'
  },
  originalWeight: {
    type: Number,
    required: true,
    min: 0
  },
  availableWeight: {
    type: Number,
    required: true,
    min: 0
  },
  vendor: {
    type: String,
    required: true
  },
  purchaseDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'processed', 'on_hold'],
    default: 'pending'
  },
  batchNo: String,
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const productionDataSchema = new mongoose.Schema(
  {
    batchNo: {
      type: String,
      required: true,
    },
    materialName: {
      type: String,
      required: true,
    },
    quality: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      required: true,
    },
    totalWeight: {
      type: Number,
      required: true,
      min: 0,
    },
    availableWeight: {
      type: Number,
      required: false,
      min: 0,
    },
    totalBags: {
      type: Number,
      required: true,
      min: 1,
    },
    machine: {
      type: String,
      required: true,
      // Match frontend machines list (machine_1 ... machine_5)
      enum: ["machine_1", "machine_2", "machine_3", "machine_4", "machine_5"],
    },
    shift: {
      type: String,
      required: true,
      // Allow night shift because frontend uses it in filters
      enum: ["morning", "evening", "night"],
    },
    productionDate: {
      type: Date,
      required: true,
    },
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Purchase",
      required: false,
    },
    employees: [
      {
        employeeId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
          required: true,
        },
        name: String,
        department: String,
      },
    ],
    notes: String,
    weightUsedFromPOP: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true }
);

const ProcessingMaterial = mongoose.model("ProcessingMaterial", processingMaterialSchema);
const ProductionData = mongoose.model("ProductionData", productionDataSchema);

module.exports = {
  ProcessingMaterial,
  ProductionData
};