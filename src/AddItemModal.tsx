import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, AlertTriangle, Trash2 } from 'lucide-react';
import type { InventoryItem, ProductInput, TrackingMode, PriceBasis } from './types';
import {
  timestamptzToDateInput,
  dateInputToTimestamptz,
  STOCK_UNIT_SUGGESTIONS,
  PACKAGE_SUGGESTIONS,
  SPECIFICATION_SUGGESTIONS,
  PRICE_BASIS_OPTIONS,
  formatPriceWithBasis,
} from './types';
import { PriceInput, DateInput, StoreInput } from './components/PurchaseFields';
import { ConsumptionHistoryEditor } from './components/ConsumptionHistoryEditor';
import { StickyFormActions } from './components/item-dashboard/StickyFormActions';
import {
  emptyPurchaseState,
  parsePurchase,
  validatePurchase,
  todayISO,
  isPurchaseEmpty,
  type PurchaseState,
} from './lib/purchase';
import { fetchStoreSuggestions } from './lib/priceHistory';

interface AddItemModalProps {
  open: boolean;
  itemToEdit?: InventoryItem | null;
  existingItems?: InventoryItem[];
  onClose: () => void;
  onSave: (input: ProductInput) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

interface ProductFormState {
  product: string;
  brand: string;
  variant: string;
  specification: string;
  unit: string;
  tracking_mode: TrackingMode;
  purchase_package: string;
  units_per_package: string;
  min_stock: string;
  count: string;
  notes: string;
  openedAt: string;
  restock_enabled: boolean;
  consumable: boolean;
  price_basis: PriceBasis | '';
  purchase: PurchaseState;
}

const DEFAULTS: ProductFormState = {
  product: '',
  brand: '',
  variant: '',
  specification: '',
  unit: 'Piece',
  tracking_mode: 'packages',
  purchase_package: '',
  units_per_package: '1',
  min_stock: '0',
  count: '0',
  notes: '',
  openedAt: '',
  restock_enabled: true,
  consumable: true,
  price_basis: '',
  purchase: { price: '', date: todayISO(), store: '' },
};

function inputClass(invalid: boolean): string {
  return invalid
    ? 'input border-red-500 focus:ring-red-500/40 focus:border-red-500'
    : 'input';
}

function formsEqual(a: ProductFormState, b: ProductFormState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function AddItemModal({ open, itemToEdit, existingItems = [], onClose, onSave, onDelete }: AddItemModalProps) {
  const [form, setForm] = useState<ProductFormState>(DEFAULTS);
  const [initialForm, setInitialForm] = useState<ProductFormState>(DEFAULTS);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [storeSuggestions, setStoreSuggestions] = useState<string[]>([]);
  const isEdit = !!itemToEdit;
  const originalProductRef = useRef<string>('');
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  const productNames = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const it of existingItems) {
      const key = it.product.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        names.push(it.product);
      }
    }
    return names;
  }, [existingItems]);

  const filteredProducts = useMemo(() => {
    if (!suggestionsVisible) return [];
    const query = form.product.trim().toLowerCase();
    if (!query) return [];
    return productNames
      .filter((n) => n.toLowerCase().includes(query))
      .sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(query);
        const bStarts = b.toLowerCase().startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      });
  }, [suggestionsVisible, form.product, productNames]);

  const findLastUsed = (name: string): InventoryItem | null => {
    const key = name.trim().toLowerCase();
    if (!key) return null;
    const matches = existingItems
      .filter((it) => it.product.toLowerCase() === key)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return matches[0] ?? null;
  };

  useEffect(() => {
    if (open) {
      let initial: ProductFormState;
      if (itemToEdit) {
        initial = {
          product: itemToEdit.product,
          brand: itemToEdit.brand ?? '',
          variant: itemToEdit.variant ?? '',
          specification: itemToEdit.specification ?? '',
          unit: itemToEdit.unit || 'Piece',
          tracking_mode: itemToEdit.tracking_mode ?? 'packages',
          purchase_package: itemToEdit.purchase_package ?? '',
          units_per_package: String(itemToEdit.units_per_package ?? 1),
          min_stock: String(itemToEdit.min_stock ?? 0),
          count: String(itemToEdit.count),
          notes: itemToEdit.notes ?? '',
          openedAt: timestamptzToDateInput(itemToEdit.opened_at),
          restock_enabled: itemToEdit.restock_enabled !== false,
          consumable: itemToEdit.consumable !== false,
          price_basis: (itemToEdit.price_basis as PriceBasis | undefined) ?? '',
          purchase: { price: '', date: todayISO(), store: '' },
        };
      } else {
        initial = { ...DEFAULTS, purchase: emptyPurchaseState(todayISO()) };
      }
      setForm(initial);
      setInitialForm(initial);
      originalProductRef.current = itemToEdit?.product ?? '';
      setErr(null);
      setSubmitting(false);
      setShowMore(false);
      setTouched({});
      setSuggestionsVisible(false);
      setShowDiscardConfirm(false);
      setShowDeleteConfirm(false);
      fetchStoreSuggestions().then(setStoreSuggestions).catch(() => {});
    }
  }, [open, itemToEdit]);

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [open]);

  const setP = (patch: Partial<PurchaseState>) =>
    setForm((prev) => ({ ...prev, purchase: { ...prev.purchase, ...patch } }));

  const applyProductChange = (value: string) => {
    setForm((prev) => {
      const next = { ...prev, product: value };
      if (!isEdit) {
        const match = findLastUsed(value);
        if (match) {
          next.brand = match.brand ?? '';
          next.variant = match.variant ?? '';
          next.specification = match.specification ?? '';
          next.unit = match.unit || 'Piece';
          next.tracking_mode = match.tracking_mode ?? 'packages';
          next.purchase_package = match.purchase_package ?? '';
          next.units_per_package = String(match.units_per_package ?? 1);
          next.consumable = match.consumable !== false;
          if (match.price_basis) {
            next.price_basis = match.price_basis;
          }
        }
      }
      return next;
    });
  };

  const onProductInputChange = (value: string) => {
    applyProductChange(value);
    if (value.trim().length === 0) {
      setSuggestionsVisible(false);
    } else if (isEdit && value === originalProductRef.current) {
      setSuggestionsVisible(false);
    } else {
      setSuggestionsVisible(true);
    }
  };

  const onProductSuggestionSelect = (name: string) => {
    applyProductChange(name);
    setSuggestionsVisible(false);
  };

  const markTouched = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));

  const scrollFocusedIntoView = (e: React.FocusEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }
  };

  const productValid = form.product.trim().length > 0;
  const unitValid = !form.consumable || form.unit.trim().length > 0;
  const purchaseErr = validatePurchase(form.purchase);
  const formValid = productValid && unitValid && !purchaseErr;

  const productInvalid = touched.product && !productValid;
  const unitInvalid = touched.unit && form.consumable && !unitValid;

  const isDirty = !formsEqual(form, initialForm);

  const configuredCount = (() => {
    let n = 0;
    if (form.consumable) {
      if (form.tracking_mode !== 'packages') n++;
      if (form.count !== '0') n++;
      if (form.min_stock !== '0') n++;
      if (form.variant.trim() !== '') n++;
      if (form.specification.trim() !== '') n++;
      if (form.unit.trim().toLowerCase() !== 'piece') n++;
      if (form.purchase_package.trim() !== '') n++;
      if (form.units_per_package !== '1') n++;
      if (form.notes.trim() !== '') n++;
      if (!isPurchaseEmpty(form.purchase)) n++;
      if (form.openedAt.trim() !== '') n++;
      if (!form.restock_enabled) n++;
      if (form.price_basis !== '') n++;
    } else {
      if (form.count !== '0') n++;
      if (form.variant.trim() !== '') n++;
      if (form.specification.trim() !== '') n++;
      if (form.notes.trim() !== '') n++;
      if (!isPurchaseEmpty(form.purchase)) n++;
      if (form.price_basis !== '') n++;
    }
    return n;
  })();

  const parsedPrice = form.purchase.price.trim() ? parseFloat(form.purchase.price) : null;
  const pricePreview =
    parsedPrice != null && !Number.isNaN(parsedPrice) && parsedPrice > 0
      ? formatPriceWithBasis(parsedPrice, form.price_basis || null)
      : null;

  const attemptClose = () => {
    if (submitting) return;
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid) {
      setTouched({ product: true, unit: true });
      if (!unitValid && form.consumable) setShowMore(true);
      return;
    }

    const count = parseInt(form.count, 10);
    const minStock = form.consumable ? parseInt(form.min_stock, 10) : 0;
    const unitsPerPackage = form.consumable ? parseInt(form.units_per_package, 10) : 1;

    if (
      Number.isNaN(count) || count < 0 ||
      (form.consumable && (Number.isNaN(minStock) || minStock < 0 || Number.isNaN(unitsPerPackage) || unitsPerPackage < 1))
    ) {
      setErr('Please check the numeric values in More options.');
      setShowMore(true);
      return;
    }
    const parsed = parsePurchase(form.purchase);

    setSubmitting(true);
    setErr(null);
    try {
      await onSave({
        product: form.product,
        brand: form.brand || null,
        variant: form.variant || null,
        specification: form.specification || null,
        unit: form.unit.trim() || 'Piece',
        tracking_mode: form.tracking_mode,
        purchase_package: form.purchase_package || null,
        units_per_package: unitsPerPackage,
        count,
        min_stock: minStock,
        notes: form.notes || null,
        openedAt: form.consumable ? dateInputToTimestamptz(form.openedAt) : null,
        restock_enabled: form.consumable ? form.restock_enabled : false,
        consumable: form.consumable,
        price_basis: form.price_basis || null,
        price: parsed.price,
        purchaseDate: parsed.date,
        store: parsed.store,
      });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save item.');
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToEdit || !onDelete) return;
    setSubmitting(true);
    setErr(null);
    try {
      await onDelete(itemToEdit.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete product.');
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-[fadeIn_120ms_ease-out]"
        onClick={attemptClose}
      >
        <div
          className="w-full sm:max-w-md flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-neutral-900 border-x-0 sm:border border-neutral-800 shadow-2xl animate-[slideUp_200ms_ease-out]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Pinned header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0 border-b border-neutral-800/60">
            <h2 className="text-lg font-semibold text-white">{isEdit ? 'Edit product' : 'New product'}</h2>
            <button
              onClick={attemptClose}
              className="h-9 w-9 grid place-items-center rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 active:scale-95 transition"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <datalist id="stock-unit-suggestions">
            {STOCK_UNIT_SUGGESTIONS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <datalist id="package-suggestions">
            {PACKAGE_SUGGESTIONS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <datalist id="spec-suggestions">
            {SPECIFICATION_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            {/* Scrollable form body */}
            <div
              ref={scrollBodyRef}
              onFocusCapture={scrollFocusedIntoView}
              className="flex-1 overflow-y-auto overscroll-contain px-5 py-3 space-y-3"
            >
              {/* Product field with autocomplete */}
              <div className="block">
                <span className="block text-xs font-medium text-neutral-400 mb-1">
                  Product<span className="text-emerald-400"> *</span>
                </span>
                <div className="relative">
                  <input
                    autoFocus
                    value={form.product}
                    onChange={(e) => onProductInputChange(e.target.value)}
                    onBlur={() => markTouched('product')}
                    placeholder="e.g. Facial cleanser, Sony headphones"
                    enterKeyHint="next"
                    autoCapitalize="words"
                    autoComplete="off"
                    className={inputClass(productInvalid)}
                  />
                  {suggestionsVisible && filteredProducts.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-[210px] overflow-y-auto overscroll-contain bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl animate-[fadeIn_100ms_ease-out]">
                      {filteredProducts.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => onProductSuggestionSelect(name)}
                          className="w-full text-left px-3.5 py-2.5 text-sm text-white hover:bg-neutral-700 active:bg-neutral-600 transition text-ellipsis whitespace-nowrap overflow-hidden"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {productInvalid && <p className="text-xs text-red-400 mt-1">Product name is required</p>}
              </div>

              {/* Brand */}
              <Field label="Brand">
                <input
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder="e.g. Garnier, Sony"
                  enterKeyHint="done"
                  autoCapitalize="words"
                  autoComplete="off"
                  className="input"
                />
              </Field>

              {/* Consumable Toggle */}
              <div className="block">
                <span className="block text-xs font-medium text-neutral-400 mb-1">
                  Product type
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, consumable: true }))}
                    className={`rounded-xl border p-2.5 text-left transition active:scale-[0.97] ${
                      form.consumable
                        ? 'border-emerald-500 bg-emerald-600/15'
                        : 'border-neutral-700 bg-neutral-800/50 hover:border-neutral-600'
                    }`}
                  >
                    <div className={`text-sm font-medium ${form.consumable ? 'text-emerald-300' : 'text-white'}`}>
                      Consumable
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      Gets used up (shampoo, food, etc.)
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, consumable: false }))}
                    className={`rounded-xl border p-2.5 text-left transition active:scale-[0.97] ${
                      !form.consumable
                        ? 'border-emerald-500 bg-emerald-600/15'
                        : 'border-neutral-700 bg-neutral-800/50 hover:border-neutral-600'
                    }`}
                  >
                    <div className={`text-sm font-medium ${!form.consumable ? 'text-emerald-300' : 'text-white'}`}>
                      Non-consumable
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      Durable (TV, headphones, tools)
                    </div>
                  </button>
                </div>
              </div>

              {/* Price — visible field */}
              <PriceInput
                value={form.purchase.price}
                onChange={(v) => setP({ price: v })}
                id="product-price"
              />
              {pricePreview ? (
                <div className="flex items-center gap-1.5 -mt-1 text-xs text-emerald-400">
                  <span className="text-neutral-500">Price:</span>
                  <span className="font-semibold tabular-nums bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                    {pricePreview}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-neutral-500 -mt-2">
                  Record a price you spotted, even if you haven't bought it yet.
                </p>
              )}

              {/* More options toggle */}
              <button
                type="button"
                onClick={() => setShowMore(!showMore)}
                className="w-full flex items-center justify-between py-2 px-1 text-sm text-neutral-400 hover:text-white transition"
              >
                <span className="flex items-center gap-2">
                  More options
                  {configuredCount > 0 && (
                    <span className="text-xs text-emerald-400">
                      {configuredCount} setting{configuredCount > 1 ? 's' : ''} configured
                    </span>
                  )}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showMore ? 'rotate-180' : ''}`} />
              </button>

              {/* More options content */}
              {showMore && (
                <div className="space-y-3 animate-[fadeIn_150ms_ease-out]">
                  {/* Stock fields */}
                  {form.consumable ? (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Current stock">
                        <StepperInput
                          value={form.count}
                          onChange={(v) => setForm({ ...form, count: v })}
                          min={0}
                        />
                      </Field>
                      <Field label="Minimum stock">
                        <StepperInput
                          value={form.min_stock}
                          onChange={(v) => setForm({ ...form, min_stock: v })}
                          min={0}
                        />
                      </Field>
                    </div>
                  ) : (
                    <Field label="Current quantity" hint="(number you own)">
                      <StepperInput
                        value={form.count}
                        onChange={(v) => setForm({ ...form, count: v })}
                        min={0}
                      />
                    </Field>
                  )}

                  {/* Purchase date + Store (shared with restock) */}
                  <DateInput
                    value={form.purchase.date}
                    onChange={(v) => setP({ date: v })}
                    id="product-date"
                    label="Date"
                  />
                  <StoreInput
                    value={form.purchase.store}
                    onChange={(v) => setP({ store: v })}
                    id="product-store"
                    suggestions={storeSuggestions}
                  />

                  {/* Price basis */}
                  <div className="rounded-2xl bg-neutral-800/40 border border-neutral-800 p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wide">
                        Price basis <span className="text-neutral-500 font-normal lowercase">(optional)</span>
                      </span>
                      {pricePreview && (
                        <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full tabular-nums">
                          {pricePreview}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500 -mt-1">
                      Select what unit the entered price is per. Stock is still tracked by whole packages/units.
                    </p>
                    <Field label="Price basis">
                      <select
                        value={form.price_basis}
                        onChange={(e) => setForm({ ...form, price_basis: e.target.value as PriceBasis | '' })}
                        className="input"
                      >
                        <option value="">None</option>
                        {PRICE_BASIS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="Variant">
                    <input
                      value={form.variant}
                      onChange={(e) => setForm({ ...form, variant: e.target.value })}
                      placeholder="e.g. Sensitive, Black, 65-inch"
                      enterKeyHint="next"
                      autoCapitalize="words"
                      className="input"
                    />
                  </Field>

                  <Field label="Specification" hint="Descriptive only">
                    <input
                      value={form.specification}
                      onChange={(e) => setForm({ ...form, specification: e.target.value })}
                      placeholder="e.g. 400 mL, 1 L, AA, 3-ply, 4K OLED"
                      list="spec-suggestions"
                      enterKeyHint="next"
                      className="input"
                    />
                  </Field>

                  {/* Consumable-only tracking configuration */}
                  {form.consumable && (
                    <>
                      <Field label="Stock tracking" required>
                        <div className="grid grid-cols-2 gap-2">
                          <ModeOption
                            active={form.tracking_mode === 'packages'}
                            onClick={() => setForm({ ...form, tracking_mode: 'packages' })}
                            title="Unopened packages"
                            desc="Count whole packages"
                          />
                          <ModeOption
                            active={form.tracking_mode === 'units'}
                            onClick={() => setForm({ ...form, tracking_mode: 'units' })}
                            title="Individual units"
                            desc="Count each unit"
                          />
                        </div>
                      </Field>

                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Stock unit" required error={unitInvalid ? 'Stock unit is required' : undefined}>
                          <input
                            value={form.unit}
                            onChange={(e) => setForm({ ...form, unit: e.target.value })}
                            onBlur={() => markTouched('unit')}
                            placeholder="e.g. bottle, roll"
                            list="stock-unit-suggestions"
                            enterKeyHint="next"
                            autoCapitalize="words"
                            className={inputClass(unitInvalid)}
                          />
                        </Field>
                        <Field label="Purchase package">
                          <input
                            value={form.purchase_package}
                            onChange={(e) => setForm({ ...form, purchase_package: e.target.value })}
                            placeholder="e.g. Pack, Box"
                            list="package-suggestions"
                            enterKeyHint="done"
                            autoCapitalize="words"
                            className="input"
                          />
                        </Field>
                      </div>

                      <Field label="Units per package">
                        <StepperInput
                          value={form.units_per_package}
                          onChange={(v) => setForm({ ...form, units_per_package: v })}
                          min={1}
                        />
                      </Field>
                    </>
                  )}

                  <Field label="Notes">
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Anything worth remembering…"
                      rows={2}
                      className="input py-2.5 resize-none"
                    />
                  </Field>

                  {/* Consumable-only Opened On and History */}
                  {form.consumable && (
                    <>
                      <Field label="Opened on" hint="Date you first used the current item">
                        <div className="relative">
                          <input
                            type="date"
                            value={form.openedAt}
                            onChange={(e) => setForm({ ...form, openedAt: e.target.value })}
                            className="input pr-9"
                          />
                          {form.openedAt && (
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, openedAt: '' })}
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center text-neutral-500 hover:text-white rounded-lg transition"
                              aria-label="Clear opened date"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </Field>

                      {/* Consumption Statistics & History (if editing existing item) */}
                      {isEdit && itemToEdit && (
                        <ConsumptionHistoryEditor inventoryId={itemToEdit.id} />
                      )}

                      {/* Restock automatically */}
                      <div className="rounded-xl border border-neutral-800 bg-neutral-800/40 p-3.5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-white">Restock automatically</div>
                          <div className="text-xs text-neutral-500 mt-0.5">
                            Add to shopping list when stock is low
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={form.restock_enabled}
                          onClick={() => setForm((prev) => ({ ...prev, restock_enabled: !prev.restock_enabled }))}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            form.restock_enabled ? 'bg-emerald-600' : 'bg-neutral-700'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                              form.restock_enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Error and sticky footer moved to StickyFormActions below */}
            </div>

            <StickyFormActions
              error={err}
              primary={
                <button
                  type="submit"
                  disabled={!formValid || submitting}
                  className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
                </button>
              }
              secondary={
                isEdit && onDelete ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={submitting}
                    className="w-full h-11 px-4 rounded-xl bg-neutral-800/80 hover:bg-red-950/50 text-neutral-400 hover:text-red-400 border border-neutral-700/60 hover:border-red-800/60 font-medium text-sm active:scale-[0.98] transition flex items-center justify-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete product
                  </button>
                ) : undefined
              }
            />
          </form>
        </div>
      </div>

      {/* Unsaved changes confirmation */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-[fadeIn_120ms_ease-out]">
          <div className="w-full max-w-xs bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-amber-500/15 border border-amber-500/30 grid place-items-center mb-3">
                <AlertTriangle className="h-6 w-6 text-amber-400" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">Discard changes?</h3>
              <p className="text-sm text-neutral-400 mb-5">
                You have unsaved changes that will be lost.
              </p>
              <div className="w-full space-y-2">
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="btn-primary w-full"
                >
                  Continue editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    onClose();
                  }}
                  className="w-full h-11 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-red-400 font-medium text-sm active:scale-[0.98] transition"
                >
                  Discard changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && itemToEdit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-[fadeIn_120ms_ease-out]">
          <div className="w-full max-w-xs bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-red-500/15 border border-red-500/30 grid place-items-center mb-3">
                <Trash2 className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">Delete product?</h3>
              <p className="text-sm text-neutral-400 mb-5">
                This removes <span className="text-white">{itemToEdit.brand ?? itemToEdit.product}</span> and its restock &amp; consumption history. This cannot be undone.
              </p>
              <div className="w-full space-y-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={submitting}
                  className="btn-primary w-full"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={submitting}
                  className="w-full h-11 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm active:scale-[0.98] transition"
                >
                  {submitting ? 'Deleting…' : 'Delete product'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ModeOption({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-2.5 text-left transition active:scale-[0.97] ${
        active
          ? 'border-emerald-500 bg-emerald-600/15'
          : 'border-neutral-700 bg-neutral-800/50 hover:border-neutral-600'
      }`}
    >
      <div className={`text-sm font-medium ${active ? 'text-emerald-300' : 'text-white'}`}>{title}</div>
      <div className="text-xs text-neutral-500 mt-0.5">{desc}</div>
    </button>
  );
}

function StepperInput({
  value,
  onChange,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  min: number;
}) {
  const n = Number(value) || 0;
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(String(Math.max(min, n - 1)))}
        className="w-10 h-10 flex items-center justify-center rounded-xl bg-neutral-800 text-white text-xl font-bold hover:bg-neutral-700 active:scale-95 transition shrink-0"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input text-center flex-1 min-w-0"
      />
      <button
        type="button"
        onClick={() => onChange(String(n + 1))}
        className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-600 text-white text-xl font-bold hover:bg-emerald-500 active:scale-95 transition shrink-0"
      >
        +
      </button>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline gap-1.5">
        <span className="block text-xs font-medium text-neutral-400 mb-1">
          {label}
          {required && <span className="text-emerald-400"> *</span>}
        </span>
        {hint && !error && <span className="text-[10px] text-neutral-600 mb-1">{hint}</span>}
      </span>
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </label>
  );
}
