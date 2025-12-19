// Currency symbols mapping
export const CURRENCY_SYMBOLS: Record<string, string> = {
  KWD: 'KD',
  USD: '$',
  EUR: '€',
  GBP: '£',
  SAR: 'SR',
  AED: 'AED',
  QAR: 'QR',
  BHD: 'BD',
  OMR: 'OMR',
};

// Get currency symbol from code
export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode] || currencyCode;
}

// Get business currency from localStorage
export function getBusinessCurrency(): string {
  if (typeof window !== 'undefined') {
    try {
      const storedBusiness = localStorage.getItem('setup_business');
      if (storedBusiness) {
        const business = JSON.parse(storedBusiness);
        return business.currency || '';
      }
    } catch {
      // ignore
    }
  }
  return ''; // Currency comes from business settings only
}

// Format currency with proper symbol
export function formatCurrency(amount: number, currencyOverride?: string): string {
  const currency = currencyOverride || getBusinessCurrency();
  const symbol = getCurrencySymbol(currency);
  
  // Handle small amounts with more decimal places
  if (amount > 0 && amount < 0.001) {
    const significantDecimals = Math.max(3, -Math.floor(Math.log10(Math.abs(amount))) + 2);
    return `${symbol} ${amount.toFixed(Math.min(significantDecimals, 6))}`;
  }
  
  // Default to 2-3 decimal places depending on currency
  const decimals = ['KWD', 'BHD', 'OMR'].includes(currency) ? 3 : 2;
  return `${symbol} ${amount.toFixed(decimals)}`;
}

