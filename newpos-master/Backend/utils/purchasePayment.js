/**
 * Purchase payment fields:
 * - advancePayment: prior advance paid to vendor (not cash at this invoice)
 * - amountPaid: cash/extra payment at purchase time only
 * - totalPaid: authoritative cumulative total (set on record-payment)
 */
function computePurchasePayment(purchase) {
  const priceNum = parseFloat(purchase.price) || 0;
  const advancePaymentNum = Number(purchase.advancePayment) || 0;
  const amountPaidNum = Number(purchase.amountPaid) || 0;

  let totalPaid;
  const storedTotal = Number(purchase.totalPaid);
  const hasExplicitTotal =
    purchase.totalPaid !== undefined &&
    purchase.totalPaid !== null &&
    purchase.totalPaid !== '' &&
    !Number.isNaN(storedTotal);

  if (hasExplicitTotal) {
    totalPaid = storedTotal;
  } else {
    totalPaid = advancePaymentNum + amountPaidNum;
  }

  let paidAmount = 'none';
  let remainingAmount = priceNum;

  if (totalPaid <= 0) {
    paidAmount = 'none';
    remainingAmount = priceNum;
  } else if (totalPaid >= priceNum) {
    paidAmount = 'paid';
    remainingAmount = 0;
  } else {
    paidAmount = 'partial';
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
    amountPaidAtPurchase: payment.amountPaid,
  };
}

/** Reject overpayment: advance + amountPaid (or totalPaid) must not exceed price */
function validatePurchasePaymentLimits(purchase) {
  const priceNum = parseFloat(purchase.price) || 0;
  if (priceNum <= 0) {
    return { ok: false, message: "Purchase price must be greater than zero" };
  }

  const advancePaymentNum = Number(purchase.advancePayment) || 0;
  const amountPaidNum = Number(purchase.amountPaid) || 0;

  if (advancePaymentNum < 0 || amountPaidNum < 0) {
    return { ok: false, message: "Payment amounts cannot be negative" };
  }

  const payment = computePurchasePayment(purchase);

  if (payment.totalPaid > priceNum) {
    return {
      ok: false,
      message: `Total payment (Rs. ${payment.totalPaid.toLocaleString()}) cannot exceed purchase price (Rs. ${priceNum.toLocaleString()})`,
    };
  }

  return { ok: true, payment };
}

module.exports = {
  computePurchasePayment,
  withComputedPayment,
  validatePurchasePaymentLimits,
};
