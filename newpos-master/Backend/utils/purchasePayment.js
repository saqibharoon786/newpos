/**
 * Compute purchase payment totals.
 * amountPaid = extra payment at purchase (not including advance).
 * totalPaid = source of truth when set (e.g. after Record Payment).
 */
function computePurchasePayment(purchase) {
  const priceNum = parseFloat(purchase.price) || 0;
  const advancePaymentNum = Number(purchase.advancePayment) || 0;
  const amountPaidNum = Number(purchase.amountPaid) || 0;

  let totalPaid;
  const hasExplicitTotal =
    purchase.totalPaid !== undefined &&
    purchase.totalPaid !== null &&
    purchase.totalPaid !== "";

  const storedTotal = hasExplicitTotal ? Number(purchase.totalPaid) || 0 : 0;

  if (hasExplicitTotal && storedTotal > 0) {
    totalPaid = storedTotal;
  } else if (amountPaidNum > advancePaymentNum) {
    // Legacy: amountPaid stored as cumulative total
    totalPaid = amountPaidNum;
  } else if (
    advancePaymentNum > 0 &&
    amountPaidNum === advancePaymentNum &&
    amountPaidNum > 0 &&
    amountPaidNum < priceNum
  ) {
    // Legacy duplicate on create (advance copied into amountPaid)
    totalPaid = advancePaymentNum;
  } else {
    totalPaid = advancePaymentNum + amountPaidNum;
  }

  let paidAmount = "none";
  let remainingAmount = priceNum;

  if (totalPaid <= 0) {
    paidAmount = "none";
    remainingAmount = priceNum;
  } else if (totalPaid >= priceNum) {
    paidAmount = "paid";
    remainingAmount = 0;
  } else {
    paidAmount = "partial";
    remainingAmount = priceNum - totalPaid;
  }

  return {
    advancePayment: advancePaymentNum,
    amountPaid: amountPaidNum,
    totalPaid,
    paidAmount,
    remainingAmount: Math.max(0, remainingAmount),
  };
}

function withComputedPayment(purchase) {
  const payment = computePurchasePayment(purchase);
  return {
    ...purchase,
    totalPaid: payment.totalPaid,
    paidAmount: payment.paidAmount,
    remainingAmount: payment.remainingAmount,
    amountPaidDisplay: payment.totalPaid,
  };
}

module.exports = { computePurchasePayment, withComputedPayment };
