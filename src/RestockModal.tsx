import { useEffect, useState } from 'react';
import { ShoppingCart, Check } from 'lucide-react';
import { pluralize, restockAddAmount, TRACKING_MODE_LABELS } from './types';
import type { InventoryItem, RestockInput } from './types';
import { PriceInput, DateInput, StoreInput } from './components/PurchaseFields';
import { emptyPurchaseState, parsePurchase, validatePurchase, todayISO, type PurchaseState } from './lib/purchase';

interface RestockModalProps {
  item: InventoryItem;
  onClose: () => void;
  onConfirm: (input: RestockInput) => Promise<void>;
}

export function RestockModal({ item, onClose, onConfirm }: RestockModalProps) {
  const [packages, setPackages] = useState('1');
  const [overrideOn, setOverrideOn] = useState(false);
  const [overrideUnits, setOverrideUnits] = useState('');
  const [notes, setNotes] = useState('');
  const [purchase, setPurchase] = useState<PurchaseState>(emptyPurchaseState(todayISO()));
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const mode = item.tracking_mode ?? 'packages';
  const unitsPerPackage = item.units_per_package ?? 1;
  const pkgCount = Math.max(0, Number(packages) || 0);
  const pkgName = (item.purchase_package?.trim() || 'package').toLowerCase();
  const stockUnit = item.unit;
  const isUnitsMode = mode === 'units';

  const calculated = restockAddAmount(mode, pkgCount, unitsPerPackage);
  const effectiveUnits = overrideOn
    ? Math.max(0, Number(overrideUnits) || 0)
    : calculated;

  useEffect(() => {
    setPackages('1');
    setOverrideOn(false);
    setOverrideUnits('');
    setPurchase(emptyPurchaseState(todayISO()));
    setNotes('');
    setErr(null);
    setSubmitting(false);
  }, [item.id]);

  const setP = (patch: Partial<PurchaseState>) => setPurchase((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideOn) {
      if (pkgCount < 1) {
        setErr('Packages purchased must be at least 1.');
        return;
      }
    } else {
      if (effectiveUnits < 1) {
        setErr('Override quantity must be at least 1.');
        return;
      }
    }
    const pErr = validatePurchase(purchase);
    if (pErr) {
      setErr(pErr);
      return;
    }
    const parsed = parsePurchase(purchase);
    setSubmitting(true);
    setErr(null);
    try {
      await onConfirm({
        packagesPurchased: pkgCount,
        unitsPerPackage,
        trackingMode: mode,
        unitOverride: overrideOn ? effectiveUnits : null,
        price: parsed.price,
        restockedAt: parsed.date,
        store: parsed.store,
        notes: notes || null,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to record restock.');
      setSubmitting(false);
    }
  };

  const previewText = isUnitsMode
    ? `${pkgCount} ${pluralize(pkgName, pkgCount)} × ${unitsPerPackage} ${pluralize(stockUnit, unitsPerPackage)} = +${effectiveUnits} ${pluralize(stockUnit, effectiveUnits)}`
    : `+${effectiveUnits} ${pluralize(pkgName, effectiveUnits)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90dvh] bg-neutral-900 sm:rounded-3xl border-x-0 sm:border border-neutral-800 shadow-2xl animate-[slideUp_200ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pinned header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0 border-b border-neutral-800/60">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-emerald-400" /> Restock
          </h2>
          <button
            onClick={onClose}
            className="h-9 w-9 grid place-items-center rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 active:scale-95 transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-sm text-neutral-400">
              {item.product}
              {item.brand ? ` · ${item.brand}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full">
              {TRACKING_MODE_LABELS[mode]}
            </span>
            <span className="text-xs text-neutral-500">
              {item.count} {pluralize(stockUnit, item.count)} on hand
            </span>
          </div>

          <div className="rounded-2xl bg-neutral-800/50 border border-neutral-800 p-3.5 space-y-3">
            <div>
              <span className="block text-xs font-medium text-neutral-400 mb-1">Packages purchased</span>
              <StepperInput value={packages} onChange={setPackages} min={0} />
            </div>
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>Package</span>
              <span className="text-neutral-300">{item.purchase_package || '—'}</span>
            </div>
            {isUnitsMode && (
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>Units per package</span>
                <span className="text-neutral-300">{unitsPerPackage}</span>
              </div>
            )}

            <div className="rounded-xl bg-neutral-950/60 border border-neutral-800 px-3 py-2.5 flex items-center justify-between gap-2">
              <span className="text-xs text-neutral-500 shrink-0">Preview</span>
              <span className="text-sm font-semibold text-emerald-400 tabular-nums text-right">
                {previewText}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setOverrideOn((v) => !v);
                if (!overrideOn) setOverrideUnits(String(calculated));
              }}
              className="flex items-center gap-2 text-xs text-neutral-400 hover:text-white transition"
            >
              <span
                className={`h-4 w-7 rounded-full transition flex items-center px-0.5 ${
                  overrideOn ? 'bg-emerald-600 justify-end' : 'bg-neutral-700 justify-start'
                }`}
              >
                <span className="h-3 w-3 rounded-full bg-white block" />
              </span>
              {isUnitsMode ? 'Override units (damaged package)' : 'Override quantity'}
            </button>
            {overrideOn && (
              <div>
                <span className="block text-xs font-medium text-neutral-400 mb-1">
                  Actual {isUnitsMode ? 'units' : 'packages'} to add
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={overrideUnits}
                  onChange={(e) => setOverrideUnits(e.target.value)}
                  className="input"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <PriceInput value={purchase.price} onChange={(v) => setP({ price: v })} id="restock-price" />
            <DateInput value={purchase.date} onChange={(v) => setP({ date: v })} id="restock-date" />
          </div>
          <StoreInput value={purchase.store} onChange={(v) => setP({ store: v })} id="restock-store" />

          <label className="block">
            <span className="block text-xs font-medium text-neutral-400 mb-1">
              Notes <span className="text-neutral-600">(optional)</span>
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. on sale, receipt kept"
              rows={2}
              className="input py-2.5 resize-none"
            />
          </label>

          {err && <p className="text-sm text-red-400">{err}</p>}
        </div>

        {/* Pinned footer */}
        <div className="shrink-0 px-5 pt-1 pb-6 border-t border-neutral-800/60">
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="btn-primary w-full disabled:opacity-60"
          >
            {submitting ? (
              'Saving…'
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <Check className="h-4 w-4" /> Confirm restock (+{effectiveUnits}{' '}
                {pluralize(isUnitsMode ? stockUnit : pkgName, effectiveUnits)})
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
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
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(String(Math.max(min, n - 1)))}
        className="w-11 h-11 flex items-center justify-center rounded-xl bg-neutral-800 text-white text-xl font-bold hover:bg-neutral-700 active:scale-95 transition shrink-0"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input text-center flex-1"
      />
      <button
        type="button"
        onClick={() => onChange(String(n + 1))}
        className="w-11 h-11 flex items-center justify-center rounded-xl bg-emerald-600 text-white text-xl font-bold hover:bg-emerald-500 active:scale-95 transition shrink-0"
      >
        +
      </button>
    </div>
  );
}
