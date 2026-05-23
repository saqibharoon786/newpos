const fs = require('fs');
const path = require('path');
const Purchase = require('../models/pop.model');
const Sale = require('../models/pos.model');
const Transaction = require('../models/transaction.model');
const Vendor = require('../models/vendor.model');
const { ProductionData, ProcessingMaterial } = require('../models/process.model');

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/** Rebuild vendor payable, advance, and running balances after ledger entries removed */
async function rebuildVendorLedger(vendor) {
  const entries = (vendor.ledger || [])
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  let payable = 0;
  let advance = 0;
  let running = 0;
  const rebuilt = [];

  for (const e of entries) {
    const debit = num(e.debit);
    const credit = num(e.credit);
    if (e.type === 'purchase') {
      payable += debit;
      running += debit;
    } else if (e.type === 'payment' || e.type === 'apply_advance') {
      payable = Math.max(0, payable - credit);
      if (e.type === 'apply_advance') {
        advance = Math.max(0, advance - credit);
      }
      running -= credit;
    } else if (e.type === 'advance') {
      advance += credit;
      running -= credit;
    } else if (e.type === 'adjustment') {
      running += debit - credit;
    }
    rebuilt.push({
      ...e.toObject ? e.toObject() : e,
      balance: Math.round(running * 100) / 100,
    });
  }

  vendor.ledger = rebuilt;
  vendor.payableBalance = Math.round(payable * 100) / 100;
  vendor.advanceBalance = Math.round(advance * 100) / 100;
  await vendor.save();
  return vendor;
}

async function removeVendorLedgerForPurchase(vendorName, purchaseId) {
  const vendor = await Vendor.findOne({ name: String(vendorName).trim() });
  if (!vendor) return { removed: 0 };

  const pid = String(purchaseId);
  const before = vendor.ledger.length;
  vendor.ledger = vendor.ledger.filter(
    (e) => !(e.purchaseId && String(e.purchaseId) === pid)
  );
  const removed = before - vendor.ledger.length;
  if (removed > 0) {
    await rebuildVendorLedger(vendor);
  }
  return { removed, vendor };
}

async function reverseFinanceTransaction({ type, method, amount, description, reference }) {
  const amt = num(amount);
  if (amt <= 0) return null;
  const m = method === 'cash' ? 'drawer' : method;
  if (!['drawer', 'easypaisa', 'jazzcash', 'bank', 'bank_transfer'].includes(m)) return null;
  return Transaction.create({
    type: type === 'withdraw' ? 'deposit' : 'withdraw',
    method: m,
    amount: amt,
    net: amt,
    description,
    reference: reference || `REV-${Date.now()}`,
    status: 'completed',
  });
}

async function reversePopPaymentTransactions(purchase) {
  const invoiceNo = purchase.invoiceNo || purchase.receiptNo || '';
  const reversals = [];
  const seen = new Set();

  const txs = invoiceNo
    ? await Transaction.find({
        reference: invoiceNo,
        status: 'completed',
      }).lean()
    : [];

  for (const tx of txs) {
    const key = `${tx.type}|${tx.method}|${tx.amount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const rev = await reverseFinanceTransaction({
      type: tx.type,
      method: tx.method,
      amount: tx.amount,
      description: `Reversal: ${tx.description || 'POP'} (record deleted)`,
      reference: `REV-${tx.reference || invoiceNo}`,
    });
    if (rev) reversals.push(rev);
  }

  const paid = num(purchase.amountPaid) || num(purchase.totalPaid);
  if (reversals.length === 0 && paid > 0) {
    const method = purchase.paymentMethod || 'drawer';
    const rev = await reverseFinanceTransaction({
      type: 'withdraw',
      method,
      amount: paid,
      description: `Reversal: POP payment deleted ${invoiceNo}`,
      reference: `REV-POP-${invoiceNo}`,
    });
    if (rev) reversals.push(rev);
  }

  return reversals;
}

async function reverseSaleFinance(sale) {
  const paid = num(sale.amountPaid);
  if (paid <= 0) return null;
  const method = sale.paymentMethod === 'cash' ? 'drawer' : sale.paymentMethod || 'drawer';
  return reverseFinanceTransaction({
    type: 'deposit',
    method,
    amount: paid,
    description: `Reversal: POS ${sale.invoiceNo || sale._id} (POP delete cascade)`,
    reference: `REV-SALE-${sale.invoiceNo || sale._id}`,
  });
}

/** Restore production stock when removing a sale (purchase stock skipped if purchase is being deleted) */
async function restoreSaleProductionStock(sale) {
  const weight = num(sale.weight);
  if (!sale.productionId || weight <= 0) return;

  const prod = await ProductionData.findById(sale.productionId);
  if (!prod) return;

  const total = num(prod.totalWeight);
  const avail = prod.availableWeight != null ? num(prod.availableWeight) : total;
  prod.availableWeight = Math.min(total, avail + weight);
  await prod.save();
}

async function deleteSaleRecord(sale) {
  if (sale.receiptImage && String(sale.receiptImage).trim()) {
    const rel = sale.receiptImage.replace(/^\/+/, '');
    const imagePath = path.join(process.env.UPLOAD_PATH || path.join(__dirname, '../uploads'), rel);
    try {
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    } catch (_) {
      /* ignore */
    }
  }
  await Sale.findByIdAndDelete(sale._id);
}

/**
 * Delete POP and cascade: linked sales, productions, process queue, vendor ledger, finance.
 */
async function cascadeDeletePurchase(purchaseId) {
  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) {
    return { ok: false, status: 404, message: 'Purchase not found' };
  }

  const summary = {
    purchaseId: String(purchase._id),
    invoiceNo: purchase.invoiceNo || purchase.receiptNo,
    salesDeleted: 0,
    productionsDeleted: 0,
    processingRowsDeleted: 0,
    vendorLedgerEntriesRemoved: 0,
    financeReversals: 0,
  };

  const productions = await ProductionData.find({ purchaseId: purchase._id }).lean();
  const productionIds = productions.map((p) => p._id);

  const linkedSales = await Sale.find({
    $or: [{ purchaseId: purchase._id }, { productionId: { $in: productionIds } }],
  }).lean();

  for (const sale of linkedSales) {
    await restoreSaleProductionStock(sale);
    const rev = await reverseSaleFinance(sale);
    if (rev) summary.financeReversals += 1;
    await deleteSaleRecord(sale);
    summary.salesDeleted += 1;
  }

  const prodDel = await ProductionData.deleteMany({ purchaseId: purchase._id });
  summary.productionsDeleted = prodDel.deletedCount || 0;

  const procDel = await ProcessingMaterial.deleteMany({ purchaseId: purchase._id });
  summary.processingRowsDeleted = procDel.deletedCount || 0;

  if (purchase.vendor) {
    const { removed } = await removeVendorLedgerForPurchase(purchase.vendor, purchase._id);
    summary.vendorLedgerEntriesRemoved = removed;
  }

  const popReversals = await reversePopPaymentTransactions(purchase);
  summary.financeReversals += popReversals.length;

  if (purchase.vehicleImage && String(purchase.vehicleImage).trim()) {
    const rel = purchase.vehicleImage.replace(/^\/+/, '');
    const imagePath = path.join(process.env.UPLOAD_PATH || path.join(__dirname, '../uploads'), rel);
    try {
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    } catch (_) {
      /* ignore */
    }
  }

  await Purchase.findByIdAndDelete(purchase._id);

  return {
    ok: true,
    message: `POP ${summary.invoiceNo || summary.purchaseId} deleted — linked records adjusted`,
    summary,
    purchase: {
      invoiceNo: summary.invoiceNo,
      vendor: purchase.vendor,
      price: purchase.price,
    },
  };
}

module.exports = {
  cascadeDeletePurchase,
  rebuildVendorLedger,
  removeVendorLedgerForPurchase,
};
