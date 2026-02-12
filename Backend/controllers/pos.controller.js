const mongoose = require("mongoose");
const Sale = require("../models/pos.model");
const Purchase = require("../models/pop.model");
const { ProductionData } = require("../models/process.model.js");
const path = require("path");
const fs = require("fs");

// ➕ Add Sale (with optional receipt image)
// Supports sale from POP purchase (purchaseId) OR from Production List (productionId)
const addSale = async (req, res) => {
  try {
    const {
      purchaseId,
      productionId,
      customerName,
      customerPhone,
      customerEmail,
      sellingPrice,
      sellingWeight,
      saleDate,
      paymentMethod,
      paymentStatus,
      amountPaid = 0,
      invoiceNo,
      transportationCost,
      notes,
      materialName: bodyMaterialName,
      supplierName: bodySupplierName,
      materialColor: bodyMaterialColor,
      actualPrice: bodyActualPrice,
      unit: requestUnit,
    } = req.body;

    if (!customerName || !sellingPrice || !sellingWeight || !invoiceNo) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing: customerName, sellingPrice, sellingWeight, invoiceNo"
      });
    }
    if (productionId && purchaseId) {
      return res.status(400).json({
        success: false,
        message: "Provide either purchaseId or productionId, not both"
      });
    }
    if (!productionId && !purchaseId) {
      return res.status(400).json({
        success: false,
        message: "Required: purchaseId (POP) or productionId (Production List)"
      });
    }

    const weightToSell = parseFloat(sellingWeight);
    if (isNaN(weightToSell) || weightToSell <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid selling weight is required"
      });
    }

    const receiptImage = req.file ? `/uploads/receipts/${req.file.filename}` : "";
    const paidAmount = parseFloat(amountPaid) || 0;
    const sellingPriceNum = parseFloat(sellingPrice) || 0;
    const remainingAmount = Math.max(0, sellingPriceNum - paidAmount);
    let finalPaymentStatus = paymentStatus;
    if (!finalPaymentStatus) {
      if (paidAmount === 0) finalPaymentStatus = 'none';
      else if (paidAmount >= sellingPriceNum) finalPaymentStatus = 'paid';
      else finalPaymentStatus = 'partial';
    }

    let materialName, supplierName, materialColor, actualPrice, salePayload;

    if (productionId) {
      // Sale from Production List
      const production = await ProductionData.findById(productionId);
      if (!production) {
        return res.status(404).json({
          success: false,
          message: "Production record not found"
        });
      }
      const available = production.availableWeight ?? production.totalWeight ?? 0;
      if (weightToSell > available) {
        return res.status(400).json({
          success: false,
          message: `Cannot sell ${weightToSell}kg. Only ${available}kg available for this production.`
        });
      }
      const newAvailable = available - weightToSell;
      production.availableWeight = newAvailable;
      await production.save();

      materialName = bodyMaterialName || production.materialName;
      supplierName = bodySupplierName || "Production";
      materialColor = bodyMaterialColor || production.color || "";
      actualPrice = bodyActualPrice || "0";

      salePayload = {
        productionId: production._id,
        purchaseId: undefined,
        materialName,
        supplierName,
        invoiceNo,
        weight: sellingWeight.toString(),
        unit: (requestUnit !== undefined && requestUnit !== null && String(requestUnit).trim() !== "") ? String(requestUnit).trim() : "0",
        purchaseDate: saleDate ? (typeof saleDate === 'string' && saleDate.includes('T') ? saleDate.split('T')[0] : saleDate) : new Date().toISOString().split('T')[0],
        purchaseTime: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        branch: "Main",
        materialColor,
        actualPrice,
        productionCost: "0",
        sellingPrice: sellingPrice.toString(),
        discount: "0",
        finalAmount: sellingPrice.toString(),
        advancePayment: paidAmount,
        amountPaid: paidAmount,
        remainingAmount: remainingAmount,
        paymentStatus: finalPaymentStatus,
        buyerName: customerName,
        buyerAddress: "",
        buyerPhone: customerPhone || "",
        buyerEmail: customerEmail || "",
        buyerCnic: "",
        buyerCompany: "",
        receiptImage,
        transportationCost: transportationCost || 0,
        notes: notes || ""
      };
    } else {
      // Sale from POP purchase
      const purchase = await Purchase.findById(purchaseId);
      if (!purchase) {
        return res.status(404).json({
          success: false,
          message: "Purchase not found"
        });
      }
      const originalWeight = parseFloat(purchase.weight) || 0;
      const currentSoldWeight = parseFloat(purchase.soldWeight) || 0;
      const currentRemainingWeight = originalWeight - currentSoldWeight;

      if (weightToSell > currentRemainingWeight) {
        return res.status(400).json({
          success: false,
          message: `Cannot sell ${weightToSell}kg. Only ${currentRemainingWeight}kg available.`
        });
      }
      const newSoldWeight = currentSoldWeight + weightToSell;
      const newRemainingWeight = originalWeight - newSoldWeight;
      purchase.soldWeight = newSoldWeight;
      purchase.remainingWeight = newRemainingWeight;
      if (newRemainingWeight === 0) purchase.status = 'sold_out';
      else if (newRemainingWeight < originalWeight) purchase.status = 'partially_sold';
      else purchase.status = 'available';
      await purchase.save();

      materialName = purchase.materialName;
      supplierName = purchase.vendor || purchase.supplierName || "";
      materialColor = purchase.materialColor || "";
      actualPrice = purchase.price || "0";

      salePayload = {
        purchaseId: purchase._id,
        productionId: undefined,
        materialName,
        supplierName,
        invoiceNo,
        weight: sellingWeight.toString(),
        unit: (requestUnit !== undefined && requestUnit !== null && String(requestUnit).trim() !== "") ? String(requestUnit).trim() : (purchase.unit || "0"),
        purchaseDate: saleDate ? (typeof saleDate === 'string' && saleDate.includes('T') ? saleDate.split('T')[0] : saleDate) : new Date().toISOString().split('T')[0],
        purchaseTime: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        branch: "Main",
        materialColor,
        actualPrice,
        productionCost: "0",
        sellingPrice: sellingPrice.toString(),
        discount: "0",
        finalAmount: sellingPrice.toString(),
        advancePayment: paidAmount,
        amountPaid: paidAmount,
        remainingAmount: remainingAmount,
        paymentStatus: finalPaymentStatus,
        buyerName: customerName,
        buyerAddress: "",
        buyerPhone: customerPhone || "",
        buyerEmail: customerEmail || "",
        buyerCnic: "",
        buyerCompany: "",
        receiptImage,
        transportationCost: transportationCost || 0,
        notes: notes || ""
      };
    }

    const sale = await Sale.create(salePayload);

    res.status(201).json({
      success: true,
      message: "Sale completed successfully",
      data: {
        sale,
        paymentSummary: {
          amountPaid: paidAmount,
          remainingAmount: remainingAmount,
          paymentStatus: finalPaymentStatus
        }
      }
    });
  } catch (error) {
    console.error('Sale error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error"
    });
  }
};

// 📥 Get All Sales
const getSales = async (req, res) => {
  try {
    const sales = await Sale.find().sort({ createdAt: -1 });
    
    // Add full URL to receiptImage if it exists
    const salesWithFullUrls = sales.map(sale => {
      const saleObj = sale.toObject();
      if (saleObj.receiptImage && saleObj.receiptImage.trim() !== '') {
        saleObj.receiptImage = `${req.protocol}://${req.get('host')}${saleObj.receiptImage}`;
      }
      return saleObj;
    });
    
    res.status(200).json({ success: true, data: salesWithFullUrls });
  } catch (error) {
    console.error('Error in getSales:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📄 Get Sale by ID
const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Sale ID",
      });
    }

    const sale = await Sale.findById(id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    // Add full URL to receiptImage if it exists
    const saleObj = sale.toObject();
    if (saleObj.receiptImage && saleObj.receiptImage.trim() !== '') {
      saleObj.receiptImage = `${req.protocol}://${req.get('host')}${saleObj.receiptImage}`;
    }

    res.status(200).json({ success: true, data: saleObj });

  } catch (error) {
    console.error('Error in getSaleById:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✏️ Update Sale
const updateSale = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("=== UPDATE SALE REQUEST ===");
    console.log("Request file:", req.file);
    console.log("Request body:", req.body);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Sale ID",
      });
    }

    // Check if sale exists
    const existingSale = await Sale.findById(id);
    if (!existingSale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    // Prepare update data
    const updateData = { ...req.body };

    // Handle receipt image
    if (req.file) {
      console.log("New file uploaded:", req.file.filename);
      
      // Delete old receipt image if exists
      if (existingSale.receiptImage && existingSale.receiptImage.trim() !== '') {
        const oldImagePath = path.join(process.env.UPLOAD_PATH || "./uploads", existingSale.receiptImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      
      // Save new receipt image path
      updateData.receiptImage = `/receipts/${req.file.filename}`;
    } else if (req.body.removeReceipt === 'true') {
      // Remove receipt image
      if (existingSale.receiptImage && existingSale.receiptImage.trim() !== '') {
        const oldImagePath = path.join(process.env.UPLOAD_PATH || "./uploads", existingSale.receiptImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      updateData.receiptImage = "";
    }

    // Calculate final amount
    if (updateData.sellingPrice || updateData.discount) {
      const sellingPriceNum = parseFloat(updateData.sellingPrice) || parseFloat(existingSale.sellingPrice) || 0;
      const discountNum = parseFloat(updateData.discount) || parseFloat(existingSale.discount) || 0;
      updateData.finalAmount = (sellingPriceNum - discountNum).toString();
    }

    // Handle advance payment
    if (updateData.advancePayment !== undefined) {
      updateData.advancePayment = parseFloat(updateData.advancePayment) || 0;
    }

    const sale = await Sale.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    // Add full URL to receiptImage for response
    const saleObj = sale.toObject();
    if (saleObj.receiptImage && saleObj.receiptImage.trim() !== '') {
      saleObj.receiptImage = `${req.protocol}://${req.get('host')}${saleObj.receiptImage}`;
    }

    res.status(200).json({
      success: true,
      message: "Sale updated successfully",
      data: saleObj,
    });
  } catch (error) {
    console.error('Error in updateSale:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🗑 Delete Sale
const deleteSale = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Sale ID",
      });
    }

    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    // Delete receipt image if exists
    if (sale.receiptImage && sale.receiptImage.trim() !== '') {
      const imagePath = path.join(process.env.UPLOAD_PATH || "./uploads", sale.receiptImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Sale.findByIdAndDelete(id);
    res.status(200).json({
      success: true,
      message: "Sale deleted successfully",
    });
  } catch (error) {
    console.error('Error in deleteSale:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🔍 Get all sales by material name (for POP integration)
const getSalesByMaterial = async (req, res) => {
  try {
    const { materialName } = req.params;
    
    const sales = await Sale.find({ materialName }).sort({ createdAt: -1 });
    
    // Calculate total sold weight
    let totalSoldWeight = 0;
    sales.forEach(sale => {
      totalSoldWeight += parseFloat(sale.weight) || 0;
    });
    
    // Add full URL to receiptImage if it exists
    const salesWithFullUrls = sales.map(sale => {
      const saleObj = sale.toObject();
      if (saleObj.receiptImage && saleObj.receiptImage.trim() !== '') {
        saleObj.receiptImage = `${req.protocol}://${req.get('host')}${saleObj.receiptImage}`;
      }
      return saleObj;
    });
    
    res.status(200).json({ 
      success: true, 
      data: salesWithFullUrls,
      totalSoldWeight,
      salesCount: sales.length
    });
  } catch (error) {
    console.error('Error in getSalesByMaterial:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 📊 Get total sold weight by material
const getTotalSoldWeightByMaterial = async (req, res) => {
  try {
    const { materialName } = req.params;
    
    const sales = await Sale.find({ materialName });
    
    let totalSoldWeight = 0;
    sales.forEach(sale => {
      totalSoldWeight += parseFloat(sale.weight) || 0;
    });
    
    res.status(200).json({
      success: true,
      data: {
        totalSoldWeight,
        salesCount: sales.length
      }
    });
  } catch (error) {
    console.error('Error in getTotalSoldWeightByMaterial:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 📈 Get sales statistics
const getSalesStatistics = async (req, res) => {
  try {
    const totalSales = await Sale.countDocuments();
    const totalWeight = await Sale.aggregate([
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
    
    const totalAdvancePayment = await Sale.aggregate([
      {
        $group: {
          _id: null,
          totalAdvance: { $sum: "$advancePayment" }
        }
      }
    ]);
    
    const totalRevenue = await Sale.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { 
            $sum: { 
              $convert: { input: "$finalAmount", to: "double", onError: 0 } 
            }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalSales,
        totalWeight: totalWeight[0]?.totalWeight || 0,
        totalAdvancePayment: totalAdvancePayment[0]?.totalAdvance || 0,
        totalRevenue: totalRevenue[0]?.totalRevenue || 0,
      }
    });
  } catch (error) {
    console.error('Error in getSalesStatistics:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

module.exports = {
  addSale,
  getSales,
  getSaleById,
  updateSale,
  deleteSale,
  getSalesByMaterial,
  getTotalSoldWeightByMaterial,
  getSalesStatistics,
};