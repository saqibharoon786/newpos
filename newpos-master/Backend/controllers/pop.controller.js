const Purchase = require("../models/pop.model");
const Sale = require("../models/pos.model");
const Transaction = require("../models/transaction.model");
const {
  computePurchasePayment,
  withComputedPayment,
  validatePurchasePaymentLimits,
} = require("../utils/purchasePayment");
const { generatePurchaseInvoiceNo } = require("../utils/invoiceGenerator");
const vendorController = require("./vendor.controller");
const { logActivity } = require("../utils/activityLogger");
const notificationController = require("./notification.controller");

// Add Purchase
const addPurchase = async (req, res) => {
  try {
    console.log('=== START addPurchase ===');
    console.log('Request body:', req.body);
    
    const {
      materialName,
      vendor,
      price,
      weight,
      quality,
      purchaseDate,
      materialColor,
      vehicleName,
      vehicleType,
      vehicleNumber,
      driverName,
      vehicleColor,
      deliveryDate,
      receiptNo,
      advancePayment,
      amountPaid,
    } = req.body;

    console.log('Payment details from request:');
    console.log('advancePayment:', advancePayment);
    console.log('amountPaid:', amountPaid);

    // Validate required fields
    if (!materialName || !vendor || !price || !weight || !purchaseDate) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing: materialName, vendor, price, weight, purchaseDate"
      });
    }

    // Convert price to number
    const priceNum = parseFloat(price) || 0;
    
    let advancePaymentNum = 0;
    if (advancePayment !== undefined && advancePayment !== null && advancePayment !== "") {
      advancePaymentNum = parseFloat(advancePayment) || 0;
    }

    let amountPaidNum = 0;
    if (amountPaid !== undefined && amountPaid !== null && amountPaid !== "") {
      amountPaidNum = parseFloat(amountPaid) || 0;
    }

    const paymentCheck = validatePurchasePaymentLimits({
      price: priceNum,
      advancePayment: advancePaymentNum,
      amountPaid: amountPaidNum,
    });
    if (!paymentCheck.ok) {
      return res.status(400).json({ success: false, message: paymentCheck.message });
    }

    const payment = paymentCheck.payment;

    const materialsCheck = validatePurchaseMaterials(req.body.materials);
    if (!materialsCheck.ok) {
      return res.status(400).json({ success: false, message: materialsCheck.message });
    }

    const invoiceNo = await generatePurchaseInvoiceNo(new Date(purchaseDate));
    let vendorDoc = null;
    try {
      vendorDoc = await vendorController.getVendorByName(vendor);
    } catch (e) {
      console.error('Vendor lookup:', e.message);
    }

    console.log("Payment calculations:");
    console.log("Total Price:", priceNum);
    console.log("Advance Payment:", advancePaymentNum);
    console.log("Amount Paid (at purchase):", amountPaidNum);
    console.log("Total Paid:", payment.totalPaid);
    console.log("Payment Status:", payment.paidAmount);
    console.log("Remaining Amount:", payment.remainingAmount);

    // Handle vehicle image
    const vehicleImage = req.file ? `/uploads/${req.file.filename}` : "";

    // Create purchase
    const purchase = await Purchase.create({
      invoiceNo,
      billNo: req.body.billNo || receiptNo || '',
      materialName,
      vendor,
      vendorId: vendorDoc?._id,
      price,
      weight,
      quality,
      purchaseDate,
      materialColor,
      vehicleName,
      vehicleType,
      vehicleNumber,
      driverName,
      vehicleColor,
      deliveryDate,
      receiptNo: receiptNo || invoiceNo,
      advancePayment: advancePaymentNum,
      amountPaid: amountPaidNum,
      totalPaid: payment.totalPaid,
      paidAmount: payment.paidAmount,
      remainingAmount: payment.remainingAmount,
      paymentMethod: req.body.paymentMethod || 'cash',
      approvalStatus: 'pending',
      createdBy: req.body.createdBy || req.user?.username || 'system',
      vehicleImage,
      materials: materialsCheck.materials,
    });

    if (vendorDoc) {
      await vendorController.updateVendorLedger(vendor, {
        type: 'purchase',
        purchaseId: purchase._id,
        description: `Purchase ${invoiceNo} - ${materialName}`,
        debit: priceNum,
        credit: 0,
      });
      if (amountPaidNum > 0) {
        await vendorController.updateVendorLedger(vendor, {
          type: 'payment',
          purchaseId: purchase._id,
          description: `Payment on ${invoiceNo}`,
          debit: 0,
          credit: amountPaidNum,
        });
      }
      if (advancePaymentNum > 0) {
        await vendorController.updateVendorLedger(vendor, {
          type: 'advance',
          purchaseId: purchase._id,
          description: `Advance applied on ${invoiceNo}`,
          debit: 0,
          credit: Math.min(advancePaymentNum, priceNum),
        });
      }
    }

    const payMethod = req.body.paymentMethod || 'drawer';
    const cashPaid = amountPaidNum;
    if (cashPaid > 0 && ['drawer', 'easypaisa', 'jazzcash', 'bank'].includes(payMethod)) {
      const balances = await Transaction.getBalances();
      if ((balances[payMethod] || 0) < cashPaid) {
        await Purchase.findByIdAndDelete(purchase._id);
        return res.status(400).json({
          success: false,
          message: `Insufficient balance in ${payMethod}. Available: Rs. ${balances[payMethod] || 0}`,
        });
      }
      await Transaction.create({
        type: 'withdraw',
        method: payMethod,
        amount: cashPaid,
        net: cashPaid,
        description: `POP payment ${invoiceNo} - ${vendor}`,
        reference: invoiceNo,
        status: 'completed',
      });
    }

    await notificationController.createNotification({
      title: 'Purchase Pending Approval',
      message: `Purchase ${invoiceNo} from ${vendor} requires owner approval`,
      type: 'pending_approval',
      targetRoles: ['owner', 'admin'],
      module: 'POP',
      recordId: String(purchase._id),
      priority: 'high',
    });

    await logActivity({
      userId: req.user?._id || req.body.createdBy,
      userName: req.user?.username || req.body.createdBy || 'system',
      action: 'Create',
      module: 'POP',
      recordId: purchase._id,
      afterValues: purchase.toObject(),
      req,
    });

    console.log('Purchase created with payment summary:');
    console.log('- Advance Payment:', purchase.advancePayment);
    console.log('- Amount Paid:', purchase.amountPaid);
    console.log('- Total Paid:', purchase.totalPaid);
    console.log('- Payment Status:', purchase.paidAmount);
    console.log('- Remaining Amount:', purchase.remainingAmount);

    res.status(201).json({
      success: true,
      message: "Purchase added successfully",
      data: purchase,
    });

  } catch (error) {
    console.error('=== ERROR in addPurchase ===');
    console.error('Error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: messages
      });
    }
    
    // Handle cast errors
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Invalid data format for field: ${error.path}`,
        error: error.message
      });
    }

    res.status(500).json({ 
      success: false, 
      message: error.message || "Internal server error"
    });
  } finally {
    console.log('=== END addPurchase ===');
  }
};
// Get All Purchases (remaining weight = original - sold - productionConsumed, so it shows everywhere in POP)
const getPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find().sort({ createdAt: -1 }).lean();
    const data = purchases.map((p) => {
      const totalWeight = parseFloat(p.weight) || 0;
      const sold = p.soldWeight || 0;
      const productionConsumed = p.productionConsumedWeight || 0;
      const remainingWeight = Math.max(0, totalWeight - sold - productionConsumed);
      return withComputedPayment({ ...p, remainingWeight });
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Single Purchase (include computed remaining weight for POP display)
const getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id).lean();
    if (!purchase)
      return res.status(404).json({ success: false, message: "Not Found" });
    const totalWeight = parseFloat(purchase.weight) || 0;
    const sold = purchase.soldWeight || 0;
    const productionConsumed = purchase.productionConsumedWeight || 0;
    const remainingWeight = Math.max(0, totalWeight - sold - productionConsumed);
    res.status(200).json({
      success: true,
      data: withComputedPayment({ ...purchase, remainingWeight }),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

function parseMaterialsField(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return fallback;
  }
}

function validatePurchaseMaterials(raw) {
  if (!raw) {
    return { ok: false, message: 'At least one material with product code is required' };
  }
  let materials;
  try {
    materials = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return { ok: false, message: 'Invalid materials data' };
  }
  if (!Array.isArray(materials) || materials.length === 0) {
    return { ok: false, message: 'At least one material with product code is required' };
  }
  for (let i = 0; i < materials.length; i++) {
    const m = materials[i];
    if (!String(m.productCode || '').trim()) {
      return {
        ok: false,
        message: `Material row ${i + 1}: product code (100, 105, 110) is required`,
      };
    }
    if (!(parseFloat(m.weight) > 0)) {
      return { ok: false, message: `Material row ${i + 1}: weight (kg) is required` };
    }
    if (!(parseFloat(m.pricePerKg) > 0)) {
      return { ok: false, message: `Material row ${i + 1}: price per kg is required` };
    }
    if (!String(m.name || m.materialName || '').trim()) {
      return { ok: false, message: `Material row ${i + 1}: material name is required` };
    }
  }
  return { ok: true, materials };
}

// Update Purchase
const updatePurchase = async (req, res) => {
  try {
    const existing = await Purchase.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Not Found" });
    }

    const priceNum = parseFloat(req.body.price) || parseFloat(existing.price) || 0;
    const advancePaymentNum =
      req.body.advancePayment !== undefined && req.body.advancePayment !== ''
        ? parseFloat(req.body.advancePayment) || 0
        : Number(existing.advancePayment) || 0;
    const amountPaidNum =
      req.body.amountPaid !== undefined && req.body.amountPaid !== ''
        ? parseFloat(req.body.amountPaid) || 0
        : Number(existing.amountPaid) || 0;

    const paymentCheck = validatePurchasePaymentLimits({
      price: priceNum,
      advancePayment: advancePaymentNum,
      amountPaid: amountPaidNum,
    });
    if (!paymentCheck.ok) {
      return res.status(400).json({ success: false, message: paymentCheck.message });
    }
    const payment = paymentCheck.payment;

    const materialsCheck = validatePurchaseMaterials(req.body.materials);
    if (!materialsCheck.ok) {
      return res.status(400).json({ success: false, message: materialsCheck.message });
    }

    let vendorDoc = null;
    if (req.body.vendor) {
      try {
        vendorDoc = await vendorController.getVendorByName(req.body.vendor);
      } catch (e) {
        console.error('Vendor lookup on update:', e.message);
      }
    }

    const updatedFields = {
      materialName: req.body.materialName ?? existing.materialName,
      vendor: req.body.vendor ?? existing.vendor,
      vendorId: vendorDoc?._id ?? existing.vendorId,
      price: String(priceNum),
      weight: req.body.weight ?? existing.weight,
      quality: req.body.quality ?? existing.quality,
      purchaseDate: req.body.purchaseDate ?? existing.purchaseDate,
      materialColor: req.body.materialColor ?? existing.materialColor,
      vehicleName: req.body.vehicleName ?? existing.vehicleName,
      vehicleType: req.body.vehicleType ?? existing.vehicleType,
      vehicleNumber: req.body.vehicleNumber ?? existing.vehicleNumber,
      driverName: req.body.driverName ?? existing.driverName,
      vehicleColor: req.body.vehicleColor ?? existing.vehicleColor,
      deliveryDate: req.body.deliveryDate ?? existing.deliveryDate,
      receiptNo: req.body.receiptNo ?? existing.receiptNo,
      billNo: req.body.billNo ?? req.body.receiptNo ?? existing.billNo,
      paymentMethod: req.body.paymentMethod ?? existing.paymentMethod,
      materials: materialsCheck.materials,
      advancePayment: advancePaymentNum,
      amountPaid: amountPaidNum,
      totalPaid: payment.totalPaid,
      paidAmount: payment.paidAmount,
      remainingAmount: payment.remainingAmount,
      soldWeight: existing.soldWeight,
      productionConsumedWeight: existing.productionConsumedWeight,
      status: existing.status,
      invoiceNo: existing.invoiceNo,
      approvalStatus: existing.approvalStatus,
      createdBy: existing.createdBy,
    };

    if (req.file) {
      updatedFields.vehicleImage = `/uploads/vehicles/${req.file.filename}`;
    }

    const purchase = await Purchase.findByIdAndUpdate(req.params.id, updatedFields, {
      new: true,
      runValidators: true,
    });

    await logActivity({
      userId: req.user?._id || req.body.createdBy,
      userName: req.user?.username || req.body.createdBy || 'system',
      action: 'Update',
      module: 'POP',
      recordId: purchase._id,
      beforeValues: existing.toObject(),
      afterValues: purchase.toObject(),
      req,
    });

    res.status(200).json({
      success: true,
      message: "Purchase updated successfully",
      data: withComputedPayment(purchase.toObject()),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Purchase
const deletePurchase = async (req, res) => {
  try {
    await Purchase.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Purchase deleted successfully",
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🔍 Get purchase with remaining weight calculation
const getPurchaseWithRemainingWeight = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get purchase
    const purchase = await Purchase.findById(id);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found"
      });
    }
    
    // Get all sales for this material
    const sales = await Sale.find({ materialName: purchase.materialName });
    
    // Calculate sold weight
    let soldWeight = 0;
    sales.forEach(sale => {
      soldWeight += parseFloat(sale.weight) || 0;
    });
    
    const totalWeight = parseFloat(purchase.weight) || 0;
    const productionConsumed = purchase.productionConsumedWeight || 0;
    const remainingWeight = Math.max(0, totalWeight - soldWeight - productionConsumed);
    
    const purchaseWithRemaining = {
      ...purchase.toObject(),
      totalWeight,
      soldWeight,
      remainingWeight,
      salesCount: sales.length
    };
    
    res.status(200).json({
      success: true,
      data: purchaseWithRemaining
    });
    
  } catch (error) {
    console.error('Error in getPurchaseWithRemainingWeight:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 📊 Get all purchases with remaining weight (for POP view)
// controllers/pop.controller.js

// Get all purchases with remaining weight
const getAllPurchasesWithRemainingWeight = async (req, res) => {
  try {
    const purchases = await Purchase.find().sort({ createdAt: -1 });
    
    const purchasesWithRemaining = await Promise.all(
      purchases.map(async (purchase) => {
        try {
          // Get all sales for this purchase
          const sales = await Sale.find({ 
            materialName: purchase.materialName 
          });
          
          // Calculate sold weight
          let soldWeight = 0;
          sales.forEach(sale => {
            soldWeight += parseFloat(sale.weight) || 0;
          });
          
          const totalWeight = parseFloat(purchase.weight) || 0;
          const productionConsumed = purchase.productionConsumedWeight || 0;
          const remainingWeight = Math.max(0, totalWeight - soldWeight - productionConsumed);
          
          return withComputedPayment({
            ...purchase.toObject(),
            totalWeight,
            soldWeight,
            remainingWeight,
            salesCount: sales.length
          });
        } catch (error) {
          console.error(`Error calculating for ${purchase.materialName}:`, error);
          const totalWeight = parseFloat(purchase.weight) || 0;
          const productionConsumed = purchase.productionConsumedWeight || 0;
          return {
            ...purchase.toObject(),
            totalWeight,
            soldWeight: 0,
            remainingWeight: Math.max(0, totalWeight - productionConsumed),
            salesCount: 0
          };
        }
      })
    );
    
    res.status(200).json({
      success: true,
      data: purchasesWithRemaining
    });
    
  } catch (error) {
    console.error('Error in getAllPurchasesWithRemainingWeight:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 📈 Get purchase statistics
const getPurchaseStatistics = async (req, res) => {
  try {
    const totalPurchases = await Purchase.countDocuments();
    const totalWeight = await Purchase.aggregate([
      {
        $group: {
          _id: null,
          totalWeight: { 
            $sum: { 
              $convert: { input: "$weight", to: "double", onError: 0 } 
            }
          }
        }
      }
    ]);
    
    const totalValue = await Purchase.aggregate([
      {
        $group: {
          _id: null,
          totalValue: { 
            $sum: { 
              $convert: { input: "$price", to: "double", onError: 0 } 
            }
          }
        }
      }
    ]);
    
    const totalAdvancePayment = await Purchase.aggregate([
      {
        $group: {
          _id: null,
          totalAdvance: { $sum: "$advancePayment" }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalPurchases,
        totalWeight: totalWeight[0]?.totalWeight || 0,
        totalValue: totalValue[0]?.totalValue || 0,
        totalAdvancePayment: totalAdvancePayment[0]?.totalAdvance || 0,
      }
    });
  } catch (error) {
    console.error('Error in getPurchaseStatistics:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

const approvePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ success: false, message: 'Not Found' });
    purchase.approvalStatus = 'approved';
    purchase.approvedBy = req.user?.username || req.body.approvedBy || 'owner';
    purchase.approvedAt = new Date();
    await purchase.save();
    await logActivity({
      userId: req.user?._id,
      userName: req.user?.username || 'owner',
      action: 'Approve',
      module: 'POP',
      recordId: purchase._id,
      afterValues: purchase.toObject(),
      req,
    });
    res.json({ success: true, data: withComputedPayment(purchase.toObject()) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getVendorBalance = async (req, res) => {
  try {
    const vendor = await vendorController.getVendorByName(req.params.name);
    res.json({
      success: true,
      data: {
        name: vendor.name,
        advanceBalance: vendor.advanceBalance,
        payableBalance: vendor.payableBalance,
        netBalance: vendor.payableBalance - vendor.advanceBalance,
        ledger: vendor.ledger,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  addPurchase,
  getPurchases,
  getPurchaseById,
  updatePurchase,
  deletePurchase,
  getPurchaseWithRemainingWeight,
  getAllPurchasesWithRemainingWeight,
  getPurchaseStatistics,
  approvePurchase,
  getVendorBalance,
};