const Transaction = require('../models/transaction.model');
const Vendor = require('../models/vendor.model');
const Customer = require('../models/customer.model');
const { rebuildVendorLedger } = require('./purchaseCascadeDelete');

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Delete a Finance-recorded vendor/customer advance and reverse balances.
 */
async function deletePartyAdvanceTransaction(transactionId) {
  const transaction = await Transaction.findById(transactionId);
  if (!transaction) {
    return { ok: false, status: 404, message: 'Transaction not found' };
  }

  if (transaction.category !== 'advance' || !transaction.partyType) {
    return {
      ok: false,
      status: 400,
      message: 'Sirf vendor/customer advance entries delete ho sakti hain',
    };
  }

  const amt = num(transaction.amount);
  if (amt <= 0) {
    return { ok: false, status: 400, message: 'Invalid transaction amount' };
  }

  const tid = String(transaction._id);

  if (transaction.partyType === 'vendor') {
    const vendor = await Vendor.findById(transaction.partyId);
    if (!vendor) {
      return { ok: false, status: 404, message: 'Vendor not found' };
    }

    const entry = (vendor.ledger || []).find(
      (e) => e.transactionId && String(e.transactionId) === tid && e.type === 'advance'
    );
    if (!entry) {
      return {
        ok: false,
        status: 404,
        message: 'Vendor ledger entry not found for this advance',
      };
    }

    if (num(vendor.advanceBalance) < amt - 0.01) {
      return {
        ok: false,
        status: 400,
        message:
          'Ye advance POP bills par use ho chuki hai — pehle kam karen ya POP adjust karen, phir delete karen',
      };
    }

    vendor.ledger = vendor.ledger.filter(
      (e) => !(e.transactionId && String(e.transactionId) === tid && e.type === 'advance')
    );
    await rebuildVendorLedger(vendor);
  } else if (transaction.partyType === 'customer') {
    let customer = await Customer.findById(transaction.partyId);
    if (!customer) {
      customer = await Customer.findOne({ customerId: String(transaction.partyId) });
    }
    if (!customer) {
      return { ok: false, status: 404, message: 'Customer not found' };
    }

    const entry = (customer.advanceLedger || []).find(
      (e) => e.transactionId && String(e.transactionId) === tid
    );
    if (!entry) {
      return {
        ok: false,
        status: 404,
        message: 'Customer advance ledger entry not found',
      };
    }

    if (num(customer.financeAdvanceBalance) < amt - 0.01) {
      return {
        ok: false,
        status: 400,
        message:
          'Ye advance POS sales par use ho chuki hai — pehle sale adjust karen, phir delete karen',
      };
    }

    customer.advanceLedger = customer.advanceLedger.filter(
      (e) => !(e.transactionId && String(e.transactionId) === tid)
    );
    customer.financeAdvanceBalance = Math.max(0, num(customer.financeAdvanceBalance) - amt);
    await customer.save();
  } else {
    return { ok: false, status: 400, message: 'Unknown party type' };
  }

  await Transaction.findByIdAndDelete(transactionId);

  return {
    ok: true,
    message: 'Advance entry delete ho gayi — balances adjust ho gaye',
    amount: amt,
    partyType: transaction.partyType,
    partyName: transaction.partyName,
  };
}

module.exports = { deletePartyAdvanceTransaction };
