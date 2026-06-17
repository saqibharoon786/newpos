const Transaction = require('../models/transaction.model');
const Employee = require('../models/employee.model');

const ADVANCE_METHODS = ['drawer', 'easypaisa', 'jazzcash', 'bank'];

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function isValidAdvanceMethod(method) {
  return ADVANCE_METHODS.includes(String(method || '').toLowerCase());
}

function getMethodLabel(method) {
  const labels = {
    drawer: 'Cash Drawer',
    easypaisa: 'Easypaisa',
    jazzcash: 'JazzCash',
    bank: 'Bank Account',
  };
  return labels[method] || method;
}

/** Recompute outstanding advance from finance ledger */
function syncEmployeeAdvanceBalance(employee) {
  let balance = 0;
  for (const e of employee.financeLedger || []) {
    if (e.type === 'advance') {
      balance += num(e.amount);
    } else if (e.type === 'repayment') {
      balance -= num(e.amount);
    } else if (e.type === 'salary_payment') {
      balance -= num(e.advanceDeducted);
    }
  }
  employee.advancePayment = round2(Math.max(0, balance));
}

async function findEmployeeByAnyId(employeeId) {
  if (!employeeId) return null;
  if (String(employeeId).match(/^[0-9a-fA-F]{24}$/)) {
    const byId = await Employee.findById(employeeId);
    if (byId) return byId;
  }
  return Employee.findOne({ employeeId: String(employeeId) });
}

async function getEmployeeLinkedProfile(employeeId, query = {}) {
  const employee = await findEmployeeByAnyId(employeeId);
  if (!employee) return null;

  const startDate = query.startDate ? new Date(query.startDate) : null;
  const endDate = query.endDate ? new Date(query.endDate) : null;
  if (endDate) {
    endDate.setHours(23, 59, 59, 999);
  }

  let ledgerRaw = (employee.financeLedger || []).slice();
  if (startDate || endDate) {
    ledgerRaw = ledgerRaw.filter((e) => {
      const d = new Date(e.date);
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
  }

  const ledger = ledgerRaw
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((e) => ({
      _id: e._id,
      date: e.date,
      type: e.type,
      amount: num(e.amount),
      method: e.method || '',
      description: e.description || '',
      reference: e.reference || '',
      transactionId: e.transactionId ? String(e.transactionId) : undefined,
      grossSalary: num(e.grossSalary),
      advanceDeducted: num(e.advanceDeducted),
      netPaid: num(e.netPaid),
      canDelete: !!e.transactionId && e.type !== 'salary_payment',
      source: 'finance',
    }));

  const salaryNum = num(employee.salary);
  const advanceBal = num(employee.advancePayment);
  const monthlyDed = num(employee.monthlyAdvanceDeduction);
  const recoveryMode = employee.advanceRecoveryMode || 'salary_deduct';
  const plannedDeduct =
    recoveryMode === 'salary_deduct'
      ? round2(Math.min(monthlyDed > 0 ? monthlyDed : advanceBal, advanceBal, salaryNum))
      : 0;

  return {
    employee: {
      _id: employee._id,
      employeeId: employee.employeeId,
      name: employee.name,
      salary: salaryNum,
      advanceBalance: advanceBal,
      netSalaryAfterAdvance: round2(Math.max(0, salaryNum - plannedDeduct)),
      advanceRecoveryMode: recoveryMode,
      monthlyAdvanceDeduction: monthlyDed,
      plannedMonthlyDeduction: plannedDeduct,
    },
    ledger,
    history: ledger,
  };
}

/** Resolve how much advance to deduct on salary payment */
function resolveSalaryAdvanceDeduction(employee, gross, options = {}) {
  const outstanding = num(employee.advancePayment);
  const { advanceToDeduct, deductFromSalary } = options;

  if (deductFromSalary === false || deductFromSalary === 'false') {
    return 0;
  }

  if (advanceToDeduct !== undefined && advanceToDeduct !== null && advanceToDeduct !== '') {
    return round2(Math.min(num(advanceToDeduct), outstanding, gross));
  }

  const mode = employee.advanceRecoveryMode || 'salary_deduct';
  if (mode === 'self_pay') {
    return 0;
  }

  const monthly = num(employee.monthlyAdvanceDeduction);
  const toDeduct = monthly > 0 ? monthly : outstanding;
  return round2(Math.min(toDeduct, outstanding, gross));
}

async function updateEmployeeAdvanceSettings({ employeeId, advanceRecoveryMode, monthlyAdvanceDeduction }) {
  if (!employeeId) {
    return { ok: false, status: 400, message: 'Employee select karen' };
  }

  const employee = await findEmployeeByAnyId(employeeId);
  if (!employee) {
    return { ok: false, status: 404, message: 'Employee not found' };
  }

  if (advanceRecoveryMode !== undefined) {
    const mode = String(advanceRecoveryMode);
    if (!['self_pay', 'salary_deduct'].includes(mode)) {
      return { ok: false, status: 400, message: 'Mode: self_pay ya salary_deduct' };
    }
    employee.advanceRecoveryMode = mode;
  }

  if (monthlyAdvanceDeduction !== undefined && monthlyAdvanceDeduction !== null && monthlyAdvanceDeduction !== '') {
    const monthly = num(monthlyAdvanceDeduction);
    if (monthly < 0) {
      return { ok: false, status: 400, message: 'Monthly deduction valid amount honi chahiye' };
    }
    employee.monthlyAdvanceDeduction = monthly;
  }

  await employee.save();
  const linked = await getEmployeeLinkedProfile(employee._id);

  const modeLabel =
    employee.advanceRecoveryMode === 'self_pay'
      ? 'Khud wapas dena (self pay)'
      : 'Salary se katwana (monthly)';

  return {
    ok: true,
    message: `${employee.name}: ${modeLabel}${employee.monthlyAdvanceDeduction > 0 ? ` — Rs. ${employee.monthlyAdvanceDeduction.toLocaleString('en-PK')}/month` : ''}`,
    employee: linked?.employee,
  };
}

/** Give advance to employee — withdraw from selected account */
async function recordEmployeeAdvance({ employeeId, method, amount, description, reference }) {
  const amt = num(amount);
  if (!employeeId) {
    return { ok: false, status: 400, message: 'Employee select karen' };
  }
  if (!isValidAdvanceMethod(method)) {
    return {
      ok: false,
      status: 400,
      message: 'Payment method: drawer, easypaisa, jazzcash ya bank',
    };
  }
  if (amt <= 0) {
    return { ok: false, status: 400, message: 'Valid amount required' };
  }

  const employee = await findEmployeeByAnyId(employeeId);
  if (!employee) {
    return { ok: false, status: 404, message: 'Employee not found' };
  }

  const balances = await Transaction.getBalances();
  const bucket = method === 'bank' ? 'bank' : method;
  if ((balances[bucket] || 0) < amt) {
    return {
      ok: false,
      status: 400,
      message: `Insufficient balance in ${getMethodLabel(method)}`,
    };
  }

  const ref = reference || `EADV-${Date.now()}`;
  const desc = description?.trim() || `Advance to employee: ${employee.name}`;

  const transaction = await Transaction.create({
    type: 'withdraw',
    method,
    amount: amt,
    net: amt,
    description: desc,
    reference: ref,
    status: 'completed',
    partyType: 'employee',
    partyId: employee._id,
    partyName: employee.name,
    category: 'advance',
  });

  employee.financeLedger = employee.financeLedger || [];
  employee.financeLedger.push({
    date: new Date(),
    type: 'advance',
    amount: amt,
    method,
    description: desc,
    reference: ref,
    transactionId: transaction._id,
  });
  syncEmployeeAdvanceBalance(employee);
  await employee.save();

  return {
    ok: true,
    message: `${employee.name} ko Rs. ${amt.toLocaleString('en-PK')} advance diya (${getMethodLabel(method)})`,
    transaction,
    employee: {
      _id: employee._id,
      name: employee.name,
      advanceBalance: employee.advancePayment,
      salary: num(employee.salary),
    },
  };
}

/** Employee repays advance — deposit to selected account */
async function recordEmployeeRepayment({ employeeId, method, amount, description, reference }) {
  const amt = num(amount);
  if (!employeeId) {
    return { ok: false, status: 400, message: 'Employee select karen' };
  }
  if (!isValidAdvanceMethod(method)) {
    return {
      ok: false,
      status: 400,
      message: 'Payment method: drawer, easypaisa, jazzcash ya bank',
    };
  }
  if (amt <= 0) {
    return { ok: false, status: 400, message: 'Valid amount required' };
  }

  const employee = await findEmployeeByAnyId(employeeId);
  if (!employee) {
    return { ok: false, status: 404, message: 'Employee not found' };
  }

  const outstanding = num(employee.advancePayment);
  if (amt > outstanding + 0.01) {
    return {
      ok: false,
      status: 400,
      message: `Outstanding advance Rs. ${outstanding.toLocaleString('en-PK')} se zyada repay nahi kar sakte`,
    };
  }

  const ref = reference || `EREP-${Date.now()}`;
  const desc =
    description?.trim() ||
    `Employee self repayment (khud wapas): ${employee.name}`;

  const transaction = await Transaction.create({
    type: 'deposit',
    method,
    amount: amt,
    net: amt,
    description: desc,
    reference: ref,
    status: 'completed',
    partyType: 'employee',
    partyId: employee._id,
    partyName: employee.name,
    category: 'advance',
  });

  employee.financeLedger = employee.financeLedger || [];
  employee.financeLedger.push({
    date: new Date(),
    type: 'repayment',
    amount: amt,
    method,
    description: desc,
    reference: ref,
    transactionId: transaction._id,
  });
  syncEmployeeAdvanceBalance(employee);
  await employee.save();

  return {
    ok: true,
    message: `${employee.name} se Rs. ${amt.toLocaleString('en-PK')} advance wapas receive hua (${getMethodLabel(method)})`,
    transaction,
    employee: {
      _id: employee._id,
      name: employee.name,
      advanceBalance: employee.advancePayment,
    },
  };
}

/** Pay salary with automatic advance adjustment */
async function recordEmployeeSalary({
  employeeId,
  method,
  grossSalary,
  advanceToDeduct,
  deductFromSalary,
  description,
  reference,
  periodLabel,
}) {
  if (!employeeId) {
    return { ok: false, status: 400, message: 'Employee select karen' };
  }
  if (!isValidAdvanceMethod(method)) {
    return {
      ok: false,
      status: 400,
      message: 'Payment method: drawer, easypaisa, jazzcash ya bank',
    };
  }

  const employee = await findEmployeeByAnyId(employeeId);
  if (!employee) {
    return { ok: false, status: 404, message: 'Employee not found' };
  }

  const gross = grossSalary !== undefined && grossSalary !== null && grossSalary !== ''
    ? num(grossSalary)
    : num(employee.salary);

  if (gross <= 0) {
    return { ok: false, status: 400, message: 'Valid salary amount required' };
  }

  const outstanding = num(employee.advancePayment);
  const advanceDeducted = resolveSalaryAdvanceDeduction(employee, gross, {
    advanceToDeduct,
    deductFromSalary,
  });

  const netPaid = round2(gross - advanceDeducted);

  if (netPaid > 0) {
    const balances = await Transaction.getBalances();
    const bucket = method === 'bank' ? 'bank' : method;
    if ((balances[bucket] || 0) < netPaid) {
      return {
        ok: false,
        status: 400,
        message: `Insufficient balance in ${getMethodLabel(method)} for net salary Rs. ${netPaid.toLocaleString('en-PK')}`,
      };
    }
  }

  const period = periodLabel?.trim() || new Date().toLocaleString('en-PK', { month: 'long', year: 'numeric' });
  const ref = reference || `SAL-${Date.now()}`;
  const desc =
    description?.trim() ||
    `Salary ${period}: ${employee.name}` +
      (advanceDeducted > 0
        ? ` (Gross Rs. ${gross.toLocaleString('en-PK')}, Advance adjust Rs. ${advanceDeducted.toLocaleString('en-PK')}, Net Rs. ${netPaid.toLocaleString('en-PK')})`
        : '');

  let transaction = null;
  if (netPaid > 0) {
    transaction = await Transaction.create({
      type: 'withdraw',
      method,
      amount: netPaid,
      net: netPaid,
      description: desc,
      reference: ref,
      status: 'completed',
      partyType: 'employee',
      partyId: employee._id,
      partyName: employee.name,
      category: 'salary',
    });
  }

  employee.financeLedger = employee.financeLedger || [];
  employee.financeLedger.push({
    date: new Date(),
    type: 'salary_payment',
    amount: gross,
    method,
    description: desc,
    reference: ref,
    transactionId: transaction?._id,
    grossSalary: gross,
    advanceDeducted,
    netPaid,
  });
  syncEmployeeAdvanceBalance(employee);
  await employee.save();

  return {
    ok: true,
    message:
      advanceDeducted > 0
        ? `${employee.name} ki salary: Gross Rs. ${gross.toLocaleString('en-PK')}, Advance adjust Rs. ${advanceDeducted.toLocaleString('en-PK')}, Net pay Rs. ${netPaid.toLocaleString('en-PK')}`
        : `${employee.name} ko Rs. ${netPaid.toLocaleString('en-PK')} salary di (${getMethodLabel(method)})`,
    transaction,
    salary: {
      grossSalary: gross,
      advanceDeducted,
      netPaid,
      period,
    },
    employee: {
      _id: employee._id,
      name: employee.name,
      advanceBalance: employee.advancePayment,
      salary: num(employee.salary),
    },
  };
}

module.exports = {
  ADVANCE_METHODS,
  isValidAdvanceMethod,
  syncEmployeeAdvanceBalance,
  findEmployeeByAnyId,
  getEmployeeLinkedProfile,
  updateEmployeeAdvanceSettings,
  resolveSalaryAdvanceDeduction,
  recordEmployeeAdvance,
  recordEmployeeRepayment,
  recordEmployeeSalary,
};
