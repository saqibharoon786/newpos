const Purchase = require('../models/pop.model');
const Sale = require('../models/pos.model');
const Vendor = require('../models/vendor.model');
const Customer = require('../models/customer.model');

function num(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function sumPopPurchases(purchases) {
  let totalBills = 0;
  let totalPaid = 0;
  let totalRemaining = 0;
  let advanceOnBills = 0;
  for (const p of purchases) {
    totalBills += num(p.price);
    totalPaid += num(p.amountPaid) || num(p.totalPaid);
    totalRemaining += num(p.remainingAmount);
    advanceOnBills += num(p.advancePayment);
  }
  return {
    purchaseCount: purchases.length,
    totalBills: Math.round(totalBills * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalRemaining: Math.round(totalRemaining * 100) / 100,
    advanceOnBills: Math.round(advanceOnBills * 100) / 100,
  };
}

function sumSales(sales) {
  let totalSales = 0;
  let totalPaid = 0;
  let totalRemaining = 0;
  let advanceOnSales = 0;
  for (const s of sales) {
    const bill = num(s.finalAmount) || num(s.sellingPrice);
    totalSales += bill;
    totalPaid += num(s.amountPaid);
    totalRemaining += num(s.remainingAmount);
    advanceOnSales += num(s.advancePayment);
  }
  return {
    saleCount: sales.length,
    totalSales: Math.round(totalSales * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalRemaining: Math.round(totalRemaining * 100) / 100,
    advanceOnSales: Math.round(advanceOnSales * 100) / 100,
  };
}

async function findPurchasesForVendor(vendor) {
  if (!vendor) return [];
  const byId = vendor._id
    ? await Purchase.find({ vendorId: vendor._id }).sort({ createdAt: -1 }).lean()
    : [];
  if (byId.length > 0) return byId;
  return Purchase.find({ vendor: vendor.name }).sort({ createdAt: -1 }).lean();
}

async function getGlobalPartyTotals() {
  const [purchases, sales, vendors, customers] = await Promise.all([
    Purchase.find().select('price amountPaid remainingAmount advancePayment vendorId vendor').lean(),
    Sale.find().select('finalAmount sellingPrice amountPaid remainingAmount advancePayment customerId').lean(),
    Vendor.find().select('advanceBalance payableBalance').lean(),
    Customer.find().select('financeAdvanceBalance amount amountPaid').lean(),
  ]);

  const pop = sumPopPurchases(purchases);
  const pos = sumSales(sales);

  let vendorAdvanceBalance = 0;
  let vendorPayableBalance = 0;
  for (const v of vendors) {
    vendorAdvanceBalance += num(v.advanceBalance);
    vendorPayableBalance += num(v.payableBalance);
  }

  let financeAdvanceBalance = 0;
  let profileDue = 0;
  for (const c of customers) {
    financeAdvanceBalance += num(c.financeAdvanceBalance);
    profileDue += Math.max(0, num(c.amount) - num(c.amountPaid));
  }

  return {
    pop,
    pos,
    vendorAdvanceBalance: Math.round(vendorAdvanceBalance * 100) / 100,
    vendorPayableBalance: Math.round(vendorPayableBalance * 100) / 100,
    vendorNetPayable: Math.round((vendorPayableBalance - vendorAdvanceBalance) * 100) / 100,
    financeAdvanceBalance: Math.round(financeAdvanceBalance * 100) / 100,
    profileBalanceDue: Math.round(profileDue * 100) / 100,
    customerTotalDue: Math.round((pos.totalRemaining + profileDue) * 100) / 100,
    customerTotalAdvance:
      Math.round((financeAdvanceBalance + pos.advanceOnSales) * 100) / 100,
  };
}

async function getVendorLinkedProfile(vendorId) {
  const vendor = await Vendor.findById(vendorId).lean();
  if (!vendor) return null;

  const purchases = await findPurchasesForVendor(vendor);
  const pop = sumPopPurchases(purchases);

  const ledger = (vendor.ledger || [])
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((e) => ({
      date: e.date,
      type: e.type,
      description: e.description || '',
      debit: num(e.debit),
      credit: num(e.credit),
      balance: num(e.balance),
      method: e.paymentMethod || '',
      reference: e.reference || '',
    }));

  return {
    vendor: {
      _id: vendor._id,
      name: vendor.name,
      advanceBalance: num(vendor.advanceBalance),
      payableBalance: num(vendor.payableBalance),
      netPayable: Math.round((num(vendor.payableBalance) - num(vendor.advanceBalance)) * 100) / 100,
    },
    pop,
    openBills: purchases
      .filter((p) => num(p.remainingAmount) > 0)
      .map((p) => ({
        _id: p._id,
        invoiceNo: p.invoiceNo || p.receiptNo,
        materialName: p.materialName,
        price: num(p.price),
        amountPaid: num(p.amountPaid),
        remainingAmount: num(p.remainingAmount),
        advancePayment: num(p.advancePayment),
        purchaseDate: p.purchaseDate,
      })),
    ledger,
  };
}

async function getCustomerLinkedProfile(customerId) {
  let customer = await Customer.findById(customerId).lean();
  if (!customer) {
    customer = await Customer.findOne({ customerId: String(customerId) }).lean();
  }
  if (!customer) return null;

  const sales = await Sale.find({ customerId: customer._id })
    .sort({ createdAt: -1 })
    .lean();
  const pos = sumSales(sales);

  const profileDue = Math.max(0, num(customer.amount) - num(customer.amountPaid));

  const financeHistory = (customer.advanceLedger || [])
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((e) => ({
      date: e.date,
      type: 'finance_advance',
      amount: num(e.amount),
      method: e.method,
      description: e.description || '',
      reference: e.reference || '',
      source: 'finance',
    }));

  const saleRows = sales
    .filter((s) => num(s.advancePayment) > 0 || num(s.remainingAmount) > 0)
    .map((s) => ({
      _id: s._id,
      invoiceNo: s.invoiceNo,
      date: s.purchaseDate || s.createdAt,
      finalAmount: num(s.finalAmount) || num(s.sellingPrice),
      amountPaid: num(s.amountPaid),
      remainingAmount: num(s.remainingAmount),
      advancePayment: num(s.advancePayment),
      source: 'pos',
    }));

  return {
    customer: {
      _id: customer._id,
      customerName: customer.customerName,
      financeAdvanceBalance: num(customer.financeAdvanceBalance),
      profileBalanceDue: Math.round(profileDue * 100) / 100,
      totalAdvanceCredit: Math.round(
        (num(customer.financeAdvanceBalance) + pos.advanceOnSales) * 100
      ) / 100,
      totalBalanceDue: Math.round((pos.totalRemaining + profileDue) * 100) / 100,
    },
    pos,
    financeHistory,
    saleRows,
    history: [...financeHistory, ...saleRows].sort(
      (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
    ),
  };
}

module.exports = {
  getGlobalPartyTotals,
  getVendorLinkedProfile,
  getCustomerLinkedProfile,
  findPurchasesForVendor,
  sumPopPurchases,
  sumSales,
};
