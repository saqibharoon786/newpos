const { default: mongoose } = require("mongoose");
const Sale = require("../models/pos.model");

// ➕ Add Sale
const addSale = async (req, res) => {
  try {
    const {
      materialName,
      supplierName,
      invoiceNo,
      weight,
      unit,
      purchaseDate,
      purchaseTime,
      branch,
      materialColor,
      actualPrice,
      productionCost,
      sellingPrice,
      discount,
      buyerName,
      buyerAddress,
      buyerPhone,
      buyerEmail,
      buyerCnic,
      buyerCompany,
    } = req.body;

    const finalAmount =
      (parseFloat(sellingPrice) || 0) - (parseFloat(discount) || 0);

    const sale = await Sale.create({
      materialName,
      supplierName,
      invoiceNo,
      weight,
      unit,
      purchaseDate,
      purchaseTime,
      branch,
      materialColor,
      actualPrice,
      productionCost,
      sellingPrice,
      discount,
      finalAmount,
      buyerName,
      buyerAddress,
      buyerPhone,
      buyerEmail,
      buyerCnic,
      buyerCompany,
    });

    res.status(201).json({
      success: true,
      message: "Sale added successfully",
      data: sale,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📥 Get All Sales
const getSales = async (req, res) => {
  try {
    const sales = await Sale.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: sales });
  } catch (error) {
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

    res.status(200).json({ success: true, data: sale });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
// ✏️ Update Sale
const updateSale = async (req, res) => {
  try {
    const updatedData = { ...req.body };

    if (updatedData.sellingPrice || updatedData.discount) {
      updatedData.finalAmount =
        (parseFloat(updatedData.sellingPrice) || 0) -
        (parseFloat(updatedData.discount) || 0);
    }

    const sale = await Sale.findByIdAndUpdate(
      req.params.id,
      updatedData,
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Sale updated successfully",
      data: sale,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🗑 Delete Sale
const deleteSale = async (req, res) => {
  try {
    await Sale.findByIdAndDelete(req.params.id);
    res.status(200).json({
      success: true,
      message: "Sale deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  addSale,
  getSales,
  getSaleById,
  updateSale,
  deleteSale,
};
