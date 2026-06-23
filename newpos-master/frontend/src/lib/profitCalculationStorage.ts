export const SALE_PRICE_STORAGE_KEY = 'profit-calculation-sale-prices';

export function loadStoredSalePrices(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SALE_PRICE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function appendSalePricesToParams(params: URLSearchParams) {
  const salePrices = loadStoredSalePrices();
  if (Object.keys(salePrices).length > 0) {
    params.set('salePrices', JSON.stringify(salePrices));
  }
}
