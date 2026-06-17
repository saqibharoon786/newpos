const Transaction = require('../models/transaction.model');
const Vendor = require('../models/vendor.model');
const Customer = require('../models/customer.model');
const { rebuildVendorLedger } = require('./purchaseCascadeDelete');
const {
  syncEmployeeAdvanceBalance,
  findEmployeeByAnyId,
} = require('./employeeFinance.service');

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function isPartyAdvanceTransaction(transaction) {
  if (!transaction?.partyType) return false;
  if (transaction.category === 'advance') return true;
  if (transaction.category === 'salary') return true;
  const desc = String(transaction.description || '').toLowerCase();
  return desc.includes('advance');
}

function syncCustomerFinanceAdvance(customer) {
  const sum = (customer.advanceLedger || []).reduce((s, e) => s + num(e.amount), 0);
  customer.financeAdvanceBalance = Math.round(sum * 100) / 100;
}

async function findCustomerByAnyId(customerId) {
  if (!customerId) return null;
  let customer = await Customer.findById(customerId);
  if (customer) return customer;
  customer = await Customer.findOne({ customerId: String(customerId) });
  return customer;
}

async function findCustomerForTransaction(transaction) {
  if (transaction.partyId) {
    const c = await Customer.findById(transaction.partyId);
    if (c) return c;
  }
  if (transaction.partyName) {
    const name = String(transaction.partyName).trim();
    const c = await Customer.findOne({
      customerName: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });
    if (c) return c;
  }
  return null;
}

/**
 * Delete a Finance-recorded vendor/customer advance and reverse balances.
 */
async function deletePartyAdvanceTransaction(transactionId) {
  const transaction = await Transaction.findById(transactionId);
  if (!transaction) {
    return { ok: false, status: 404, message: 'Transaction not found' };
  }

  if (!isPartyAdvanceTransaction(transaction)) {
    return {
      ok: false,
      status: 400,
      message: 'Sirf vendor/customer/employee advance ya salary entries delete ho sakti hain',
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
    if (transaction.type !== 'deposit') {
      return { ok: false, status: 400, message: 'Invalid customer advance transaction type' };
    }

    const customer = await findCustomerForTransaction(transaction);
    if (!customer) {
      return { ok: false, status: 404, message: 'Customer not found' };
    }

    customer.advanceLedger = (customer.advanceLedger || []).filter(
      (e) => !(e.transactionId && String(e.transactionId) === tid)
    );
    syncCustomerFinanceAdvance(customer);
    await customer.save();
  } else if (transaction.partyType === 'employee') {
    const employee = await findEmployeeByAnyId(transaction.partyId);
    if (!employee) {
      return { ok: false, status: 404, message: 'Employee not found' };
    }

    const tid = String(transaction._id);
    const entry = (employee.financeLedger || []).find(
      (e) => e.transactionId && String(e.transactionId) === tid
    );

    if (!entry) {
      return {
        ok: false,
        status: 404,
        message: 'Employee finance ledger entry not found',
      };
    }

    if (entry.type === 'advance') {
      const usedInSalary = (employee.financeLedger || []).some(
        (e) => e.type === 'salary_payment' && num(e.advanceDeducted) > 0 && new Date(e.date) > new Date(entry.date)
      );
      if (usedInSalary) {
        return {
          ok: false,
          status: 400,
          message:
            'Ye advance salary mein adjust ho chuka hai — pehle salary entry delete karen ya adjust karen',
        };
      }
    }

    employee.financeLedger = (employee.financeLedger || []).filter(
      (e) => !(e.transactionId && String(e.transactionId) === tid)
    );
    syncEmployeeAdvanceBalance(employee);
    await employee.save();
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

/** Delete customer finance advance by advanceLedger sub-document _id */
async function deleteCustomerAdvanceEntry(customerId, entryId) {
  const customer = await findCustomerByAnyId(customerId);
  if (!customer) {
    return { ok: false, status: 404, message: 'Customer not found' };
  }

  const entry = customer.advanceLedger.id(entryId);
  if (!entry) {
    return { ok: false, status: 404, message: 'Advance entry not found' };
  }

  if (entry.transactionId) {
    return deletePartyAdvanceTransaction(String(entry.transactionId));
  }

  if (entry.reference) {
    const tx = await Transaction.findOne({
      reference: entry.reference,
      partyType: 'customer',
      type: 'deposit',
    });
    if (tx) {
      return deletePartyAdvanceTransaction(String(tx._id));
    }
  }

  const amt = num(entry.amount);
  customer.advanceLedger.pull(entryId);
  syncCustomerFinanceAdvance(customer);
  await customer.save();

  return {
    ok: true,
    message: 'Customer advance entry delete ho gayi (ledger only)',
    amount: amt,
    partyType: 'customer',
    partyName: customer.customerName,
  };
}

module.exports = {
  deletePartyAdvanceTransaction,
  deleteCustomerAdvanceEntry,
};
