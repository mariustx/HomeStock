import type { PurchaseState } from '../lib/purchase';

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="block">
      {label && (
        <span className="flex items-baseline gap-1.5">
          <span className="block text-xs font-medium text-neutral-400 mb-1">{label}</span>
          {hint && !error && <span className="text-[10px] text-neutral-600 mb-1">{hint}</span>}
        </span>
      )}
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </label>
  );
}

export function PriceInput({
  value,
  onChange,
  currency = 'RON',
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  currency?: string;
  id?: string;
}) {
  return (
    <Field label={`Price`} hint={`(${currency})`}>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="optional"
          className="input pr-14"
        />
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-neutral-500 pointer-events-none">
          {currency}
        </span>
      </div>
    </Field>
  );
}

export function DateInput({
  value,
  onChange,
  label = 'Date',
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  id?: string;
}) {
  return (
    <Field label={label}>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      />
    </Field>
  );
}

export function StoreInput({
  value,
  onChange,
  id,
  suggestions = [],
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  suggestions?: string[];
}) {
  const listId = id ? `${id}-list` : undefined;
  return (
    <Field label="Store" hint="(optional)">
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Lidl, Local store"
        list={listId}
        autoCapitalize="words"
        autoComplete="off"
        className="input"
      />
      {listId && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </Field>
  );
}

export { Field };
export type { PurchaseState };
