export function getPurchasePrice(purchase: { price?: number | string }) {
  return typeof purchase.price === 'number'
    ? purchase.price
    : parseFloat(String(purchase.price || 0)) || 0;
}

/** amountPaid = payment at purchase only; totalPaid = authoritative cumulative */
export function getPurchaseTotalPaid(purchase: {
  price?: number | string;
  advancePayment?: number;
  amountPaid?: number;
  totalPaid?: number;
}) {
  const storedTotal = Number(purchase.totalPaid);
  if (
    purchase.totalPaid != null &&
    purchase.totalPaid !== '' &&
    !Number.isNaN(storedTotal)
  ) {
    return storedTotal;
  }
  const advance = Number(purchase.advancePayment) || 0;
  const paid = Number(purchase.amountPaid) || 0;
  return advance + paid;
}

export function getPurchaseRemainingAmount(purchase: {
  price?: number | string;
  advancePayment?: number;
  amountPaid?: number;
  totalPaid?: number;
}) {
  return Math.max(0, getPurchasePrice(purchase) - getPurchaseTotalPaid(purchase));
}

export function getPurchasePaidStatus(
  purchase: { price?: number | string; advancePayment?: number; amountPaid?: number; totalPaid?: number }
): 'none' | 'partial' | 'paid' {
  const price = getPurchasePrice(purchase);
  const totalPaid = getPurchaseTotalPaid(purchase);
  if (totalPaid <= 0) return 'none';
  if (totalPaid >= price) return 'paid';
  return 'partial';
}
