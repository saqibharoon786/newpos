const multer = require('multer');
const Asset = require('../models/assets.model');
const Transaction = require('../models/transaction.model');
const Employee = require('../models/employee.model');

// @desc    Create a new asset
// @route   POST /api/assets
// @access  Private
// In your assets.controller.js, update the createAsset function:


exports.createAsset = async (req, res) => {
  try {
    // ✅ IMPORTANT: Log everything to debug
    console.log('📥 REQUEST BODY (FormData fields):', req.body);
    console.log('📥 REQUEST FILE (Multer):', req.file);
    console.log('📥 ALL REQUEST FIELDS:', Object.keys(req.body));
    
    // ✅ Extract FormData fields
    const {
      assetName,
      category,
      quantity,
      sizeModel,
      condition,
      description,
      department,
      assignedTo,
      purchasePrice,
      amountPaid,
      purchaseFrom,
      invoiceNo,
      purchaseDate,  // ✅ Changed from 'date' to 'purchaseDate' to match frontend
      purchaseTime,
      paymentMethod,
      accountType,
      employeeId,
      employeeName,
    } = req.body;

    console.log('📝 Parsed FormData fields:', {
      assetName,
      category,
      quantity,
      purchaseDate,  // This should show the date from frontend
      purchaseTime   // This should show the time from frontend
    });

    // Basic validation
    if (!assetName || !category || !condition || !department) {
      return res.status(400).json({
        success: false,
        error: 'Required fields: assetName, category, condition, department'
      });
    }

    // ✅ Parse date - IMPORTANT FIX
    let parsedPurchaseDate = new Date();
    if (purchaseDate) {
      console.log('📅 Raw purchaseDate from frontend:', purchaseDate);
      
      // Try to parse different date formats
      try {
        // Format 1: YYYY-MM-DD (ISO format from frontend)
        if (purchaseDate.includes('-')) {
          const [year, month, day] = purchaseDate.split('-').map(Number);
          parsedPurchaseDate = new Date(year, month - 1, day);
        }
        // Format 2: DD/MM/YYYY
        else if (purchaseDate.includes('/')) {
          const [day, month, year] = purchaseDate.split('/').map(Number);
          parsedPurchaseDate = new Date(year, month - 1, day);
        }
        // Format 3: Already a Date object or timestamp
        else {
          parsedPurchaseDate = new Date(purchaseDate);
        }
        
        // Check if date is valid
        if (isNaN(parsedPurchaseDate.getTime())) {
          console.log('⚠️ Invalid date, using current date');
          parsedPurchaseDate = new Date();
        }
        
        console.log('📅 Parsed purchaseDate:', parsedPurchaseDate.toISOString());
      } catch (error) {
        console.log('⚠️ Date parsing error, using current date:', error);
        parsedPurchaseDate = new Date();
      }
    }

    // Parse purchasePrice
    let parsedPurchasePrice = null;
    if (purchasePrice && purchasePrice !== "" && purchasePrice !== null) {
      try {
        const cleanPrice = String(purchasePrice).replace(/,/g, '').trim();
        if (cleanPrice && !isNaN(cleanPrice)) {
          parsedPurchasePrice = parseFloat(cleanPrice);
        }
      } catch (e) {
        console.log('Warning: Could not parse purchasePrice:', purchasePrice);
      }
    }

    // Parse amountPaid
    let parsedAmountPaid = null;
    if (amountPaid !== undefined && amountPaid !== "" && amountPaid !== null) {
      try {
        const cleanPaid = String(amountPaid).replace(/,/g, '').trim();
        if (cleanPaid && !isNaN(cleanPaid)) {
          parsedAmountPaid = parseFloat(cleanPaid);
        }
      } catch (e) {
        console.log('Warning: Could not parse amountPaid:', amountPaid);
      }
    }
    // Default amountPaid to purchasePrice if not provided
    if (parsedAmountPaid === null && parsedPurchasePrice !== null) {
      parsedAmountPaid = parsedPurchasePrice;
    }

    // Handle receipt image
    let receiptImagePath = null;
    if (req.file) {
      // Save relative path for frontend access
      receiptImagePath = `/uploads/general/${req.file.filename}`;
      console.log('📸 Receipt image saved at:', receiptImagePath);
    }

    const finalInvoiceNo = invoiceNo ? String(invoiceNo).trim() : `AST-${Date.now()}`;

    // ✅ Prepare asset data
    const assetData = {
      assetName: String(assetName).trim(),
      category: String(category).trim(),
      quantity: parseInt(quantity) || 1,
      sizeModel: sizeModel ? String(sizeModel).trim() : null,
      condition: String(condition).trim(),
      description: description ? String(description).trim() : null,
      department: String(department).trim(),
      assignedTo: assignedTo ? String(assignedTo).trim() : null,
      purchasePrice: parsedPurchasePrice,
      amountPaid: parsedAmountPaid,
      purchaseFrom: purchaseFrom ? String(purchaseFrom).trim() : null,
      invoiceNo: finalInvoiceNo,
      purchaseDate: parsedPurchaseDate,  // ✅ Use the parsed date
      purchaseTime: purchaseTime || null,
      receiptImage: receiptImagePath,
      status: 'Active',
      paymentMethod: paymentMethod || 'drawer',
      accountType: accountType || 'fixed_asset',
    };

    if (accountType === 'advance_to_employee' && employeeId) {
      const emp = await Employee.findById(employeeId);
      assetData.employeeAdvances = [{
        employeeId,
        employeeName: employeeName || emp?.name || 'Employee',
        amount: parsedPurchasePrice || 0,
        notes: description || 'Advance',
      }];
      if (emp && parsedPurchasePrice) {
        emp.advancePayment = (emp.advancePayment || 0) + parsedPurchasePrice;
        await emp.save();
      }
    }

    console.log('📤 Final asset data to save:', {
      ...assetData,
      purchaseDate: assetData.purchaseDate.toISOString()
    });

    const rawMethod = (paymentMethod || 'cash').toLowerCase();
    const method = rawMethod === 'cash' ? 'drawer' : rawMethod;
    const supportedMethods = ['drawer', 'bank', 'easypaisa', 'jazzcash', 'bank_transfer', 'cheque', 'online'];

    if (parsedAmountPaid > 0 && supportedMethods.includes(method)) {
      const balances = await Transaction.getBalances();
      const balanceKey = ['bank_transfer', 'cheque', 'online'].includes(method) ? 'bank' : method;

      if ((balances[balanceKey] || 0) < parsedAmountPaid) {
        return res.status(400).json({
          success: false,
          error: `Insufficient ${balanceKey} balance`,
        });
      }
      await Transaction.create({
        type: 'withdraw',
        method,
        amount: parsedAmountPaid,
        net: parsedAmountPaid,
        date: parsedPurchaseDate,
        description: `Asset: ${assetName}`,
        reference: finalInvoiceNo,
        status: 'completed',
      });
    }

    const asset = await Asset.create(assetData);

    console.log('✅ Asset created successfully:', {
      id: asset._id,
      assetName: asset.assetName,
      purchaseDate: asset.purchaseDate,
      purchaseTime: asset.purchaseTime
    });

    res.status(201).json({
      success: true,
      data: asset,
      message: 'Asset created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating asset:', error);
    console.error('❌ Error stack:', error.stack);

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'File too large. Maximum size is 5MB' });
      }
      return res.status(400).json({ success: false, error: `File upload error: ${error.message}` });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ success: false, error: messages.join(', ') });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Server error: ' + error.message 
    });
  }
};
// @desc    Get all assets
// @route   GET /api/assets
// @access  Private
exports.getAllAssets = async (req, res) => {
  try {
    const assets = await Asset.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: assets.length,
      data: assets
    });
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// SIMPLIFIED VERSION - Remove all complex features for now
// @desc    Get all assets simple
// @route   GET /api/assets/get-all
// @access  Private
exports.getAllAssetsSimple = async (req, res) => {
  try {
    const assets = await Asset.find()
      .select('-__v')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: assets
    });
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get single asset by ID
// @route   GET /api/assets/:id
// @access  Private
exports.getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }

    res.status(200).json({
      success: true,
      data: asset
    });
  } catch (error) {
    console.error('Error fetching asset:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Update asset
// @route   PUT /api/assets/:id
// @access  Private
exports.updateAsset = async (req, res) => {
  try {
    console.log('📥 Update request for ID:', req.params.id);
    console.log('📥 Update data:', req.body);

    let asset = await Asset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }

    const oldPrice = Number(asset.purchasePrice) || 0;
    const oldAmountPaid = Number(asset.amountPaid) || 0;
    const oldMethodRaw = (asset.paymentMethod || 'cash').toLowerCase();
    const oldMethod = oldMethodRaw === 'cash' ? 'drawer' : oldMethodRaw;
    const oldInvoiceNo = asset.invoiceNo;

    // Prepare update data
    const updateData = { ...req.body };

    // Handle purchasePrice conversion if present
    if (updateData.purchasePrice !== undefined) {
      if (updateData.purchasePrice && updateData.purchasePrice !== "" && updateData.purchasePrice !== null) {
        try {
          const cleanPrice = String(updateData.purchasePrice).replace(/,/g, '').trim();
          if (cleanPrice && !isNaN(cleanPrice)) {
            updateData.purchasePrice = parseFloat(cleanPrice);
          } else {
            updateData.purchasePrice = null;
          }
        } catch (e) {
          updateData.purchasePrice = null;
        }
      } else {
        updateData.purchasePrice = null;
      }
    }

    // Handle amountPaid conversion if present
    if (updateData.amountPaid !== undefined) {
      if (updateData.amountPaid && updateData.amountPaid !== "" && updateData.amountPaid !== null) {
        try {
          const cleanPaid = String(updateData.amountPaid).replace(/,/g, '').trim();
          if (cleanPaid && !isNaN(cleanPaid)) {
            updateData.amountPaid = parseFloat(cleanPaid);
          } else {
            updateData.amountPaid = 0;
          }
        } catch (e) {
          updateData.amountPaid = 0;
        }
      } else {
        updateData.amountPaid = 0;
      }
    }

    // Handle quantity conversion
    if (updateData.quantity !== undefined) {
      updateData.quantity = parseInt(updateData.quantity) || 1;
    }

    // Handle receiptImage (ensure it's properly set or removed)
    if (updateData.receiptImage !== undefined) {
      updateData.receiptImage = updateData.receiptImage || null;
    }

    // Parse purchaseDate if present
    let parsedPurchaseDate = asset.purchaseDate;
    if (updateData.purchaseDate !== undefined) {
      if (updateData.purchaseDate) {
        try {
          if (updateData.purchaseDate.includes('-')) {
            const [year, month, day] = updateData.purchaseDate.split('-').map(Number);
            parsedPurchaseDate = new Date(year, month - 1, day);
          } else if (updateData.purchaseDate.includes('/')) {
            const [day, month, year] = updateData.purchaseDate.split('/').map(Number);
            parsedPurchaseDate = new Date(year, month - 1, day);
          } else {
            parsedPurchaseDate = new Date(updateData.purchaseDate);
          }
          if (isNaN(parsedPurchaseDate.getTime())) {
            parsedPurchaseDate = new Date();
          }
          updateData.purchaseDate = parsedPurchaseDate;
        } catch (error) {
          console.log('⚠️ Date parsing error, using old date:', error);
        }
      } else {
        updateData.purchaseDate = null;
      }
    }

    const newPrice = updateData.purchasePrice !== undefined ? (Number(updateData.purchasePrice) || 0) : oldPrice;
    const newAmountPaid = updateData.amountPaid !== undefined ? (Number(updateData.amountPaid) || 0) : oldAmountPaid;
    const newMethodRaw = (updateData.paymentMethod !== undefined ? updateData.paymentMethod : (asset.paymentMethod || 'cash')).toLowerCase();
    const newMethod = newMethodRaw === 'cash' ? 'drawer' : newMethodRaw;
    const newInvoiceNo = updateData.invoiceNo !== undefined ? String(updateData.invoiceNo).trim() : oldInvoiceNo;
    const newAssetName = updateData.assetName !== undefined ? String(updateData.assetName).trim() : asset.assetName;

    const finalInvoiceNo = newInvoiceNo || oldInvoiceNo || `AST-${Date.now()}`;
    updateData.invoiceNo = finalInvoiceNo;

    const supportedMethods = ['drawer', 'bank', 'easypaisa', 'jazzcash', 'bank_transfer', 'cheque', 'online'];

    if (newAmountPaid > 0 && supportedMethods.includes(newMethod)) {
      const balances = await Transaction.getBalances();
      const balanceKey = ['bank_transfer', 'cheque', 'online'].includes(newMethod) ? 'bank' : newMethod;
      const oldBalanceKey = ['bank_transfer', 'cheque', 'online'].includes(oldMethod) ? 'bank' : oldMethod;

      const currentAvailable = balances[balanceKey] || 0;
      const effectiveAvailable = currentAvailable + (oldBalanceKey === balanceKey ? oldAmountPaid : 0);

      if (effectiveAvailable < newAmountPaid) {
        return res.status(400).json({
          success: false,
          error: `Insufficient ${balanceKey} balance`,
        });
      }

      let tx = null;
      if (oldInvoiceNo) {
        tx = await Transaction.findOne({ reference: oldInvoiceNo });
      }

      if (tx) {
        tx.amount = newAmountPaid;
        tx.net = newAmountPaid;
        tx.method = newMethod;
        tx.reference = finalInvoiceNo;
        tx.description = `Asset: ${newAssetName}`;
        tx.date = parsedPurchaseDate || new Date();
        await tx.save();
      } else {
        await Transaction.create({
          type: 'withdraw',
          method: newMethod,
          amount: newAmountPaid,
          net: newAmountPaid,
          date: parsedPurchaseDate || new Date(),
          description: `Asset: ${newAssetName}`,
          reference: finalInvoiceNo,
          status: 'completed',
        });
      }
    } else {
      // If new amountPaid is 0/null or payment method is not supported, delete old transaction if it existed
      if (oldInvoiceNo) {
        await Transaction.deleteMany({ reference: oldInvoiceNo });
      }
    }

    console.log('📤 Final update data:', updateData);

    asset = await Asset.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: asset,
      message: 'Asset updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating asset:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        error: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Delete asset
// @route   DELETE /api/assets/:id
// @access  Private
exports.deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }

    if (asset.invoiceNo) {
      await Transaction.deleteMany({ reference: asset.invoiceNo });
    }

    await asset.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
      message: 'Asset deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting asset:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get asset statistics
// @route   GET /api/assets/stats
// @access  Private
exports.getAssetStats = async (req, res) => {
  try {
    const stats = await Asset.aggregate([
      {
        $group: {
          _id: null,
          totalAssets: { $sum: 1 },
          totalValue: { $sum: { $ifNull: ['$purchasePrice', 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          totalAssets: 1,
          totalValue: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || { totalAssets: 0, totalValue: 0 }
      }
    });
  } catch (error) {
    console.error('Error fetching asset stats:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Record a payment for an asset
// @route   POST /api/assets/:id/payments
// @access  Private
exports.recordAssetPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, notes, date } = req.body;
    const amt = parseFloat(amount);
    
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ success: false, error: 'Valid payment amount is required' });
    }

    const asset = await Asset.findById(id);
    if (!asset) {
      return res.status(404).json({ success: false, error: 'Asset not found' });
    }

    const price = asset.purchasePrice || 0;
    const currentTotalPaid = asset.amountPaid || 0;
    const remaining = Math.max(0, price - currentTotalPaid);

    if (amt > remaining) {
      return res.status(400).json({ 
        success: false, 
        error: `Payment amount exceeds remaining balance of Rs. ${remaining.toLocaleString()}` 
      });
    }

    const rawMethod = (paymentMethod || 'cash').toLowerCase();
    const method = rawMethod === 'cash' ? 'drawer' : rawMethod;
    const supportedMethods = ['drawer', 'bank', 'easypaisa', 'jazzcash', 'bank_transfer', 'cheque', 'online'];

    if (supportedMethods.includes(method)) {
      const balances = await Transaction.getBalances();
      const balanceKey = ['bank_transfer', 'cheque', 'online'].includes(method) ? 'bank' : method;
      
      if ((balances[balanceKey] || 0) < amt) {
        return res.status(400).json({ 
          success: false, 
          error: `Insufficient balance in ${balanceKey}. Available: Rs. ${(balances[balanceKey] || 0).toLocaleString()}` 
        });
      }

      await Transaction.create({
        type: 'withdraw',
        method,
        amount: amt,
        net: amt,
        date: date ? new Date(date) : new Date(),
        description: `Payment for Asset: ${asset.assetName}`,
        reference: asset.invoiceNo || `AST-${Date.now()}`,
        status: 'completed',
      });
    }

    asset.amountPaid = currentTotalPaid + amt;
    await asset.save();

    res.status(200).json({
      success: true,
      data: asset,
      message: `Payment of Rs. ${amt.toLocaleString()} recorded successfully!`
    });
  } catch (error) {
    console.error('Error recording asset payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};