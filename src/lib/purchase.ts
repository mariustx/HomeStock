/**
 * Shared purchase-information fields (Price, Purchase Date, Store)
 * used by both the Add/Edit Product form and the Restock dialog.
 */

export interface PurchaseState {
  price: string;
  date: string;
  store: string;
}

export interface PurchaseParsed {
  price: number | null;
  date: string;
  store: string | null;
}

export function emptyPurchaseState(today: string): PurchaseState {
  return { price: '', date: today, store: '' };
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function isPurchaseEmpty(s: PurchaseState): boolean {
  return s.price.trim() === '' && s.store.trim() === '';
}

export function parsePurchase(s: PurchaseState): PurchaseParsed {
  const price = s.price.trim() === '' ? null : parseFloat(s.price);
  return {
    price: price !== null && !Number.isNaN(price) ? price : null,
    date: s.date,
    store: s.store.trim() || null,
  };
}

export function validatePurchase(s: PurchaseState): string | null {
  if (s.price.trim() !== '') {
    const p = parseFloat(s.price);
    if (Number.isNaN(p) || p < 0) return 'Price must be a positive number or blank.';
  }
  if (!s.date) return 'Please select a purchase date.';
  return null;
}
