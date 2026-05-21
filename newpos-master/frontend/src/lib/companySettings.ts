import api, { API_BASE_URL } from './api';

export interface CompanySettings {
  companyName: string;
  logo?: string | null;
  currencySymbol: string;
  address?: string;
  phone?: string;
  email?: string;
}

const DEFAULT_SETTINGS: CompanySettings = {
  companyName: 'Mara Ha International Plastic',
  currencySymbol: 'Rs.',
  logo: null,
};

let cached: CompanySettings | null = null;

export async function fetchCompanySettings(): Promise<CompanySettings> {
  if (cached) return cached;
  try {
    const res = await api.get('/api/settings');
    if (res.data?.success) {
      cached = res.data.data;
      return cached!;
    }
  } catch {
    /* use default */
  }
  return DEFAULT_SETTINGS;
}

export function getLogoUrl(logo?: string | null): string | null {
  if (!logo) return null;
  if (logo.startsWith('http')) return logo;
  const base = API_BASE_URL || (typeof window !== 'undefined' ? '' : 'http://localhost:5000');
  return `${base}${logo.startsWith('/') ? logo : `/${logo}`}`;
}

export function formatCurrency(amount: number, symbol = 'Rs.'): string {
  return `${symbol} ${amount.toLocaleString('en-PK')}`;
}
