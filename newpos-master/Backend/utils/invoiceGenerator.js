const Purchase = require('../models/pop.model');
const Sale = require('../models/pos.model');

async function generatePurchaseInvoiceNo(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const prefix = `PV${month}${year}`;

  const last = await Purchase.findOne({ invoiceNo: new RegExp(`^${prefix}`) })
    .sort({ invoiceNo: -1 })
    .select('invoiceNo')
    .lean();

  let seq = 1;
  if (last?.invoiceNo) {
    const tail = last.invoiceNo.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }

  return `${prefix}${String(seq).padStart(5, '0')}`;
}

async function generateSaleInvoiceNo(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const prefix = `SV${month}${year}`;

  const last = await Sale.findOne({ invoiceNo: new RegExp(`^${prefix}`) })
    .sort({ invoiceNo: -1 })
    .select('invoiceNo')
    .lean();

  let seq = 1;
  if (last?.invoiceNo) {
    const tail = last.invoiceNo.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }

  return `${prefix}${String(seq).padStart(5, '0')}`;
}

module.exports = { generatePurchaseInvoiceNo, generateSaleInvoiceNo };
