import { useEffect, useState } from 'react';
import type { ShoppingItem, ShoppingItemInput } from './types';

interface ShoppingItemModalProps {
  open: boolean;
  itemToEdit?: ShoppingItem | null;
  onClose: () => void;
  onSave: (input: ShoppingItemInput) => Promise<void>;
}

interface ShoppingFormState {
  product: string;
  brand: string;
  variant: string;
  notes: string;
}

const EMPTY: ShoppingFormState = {
  product: '',
  brand: '',
  variant: '',
  notes: '',
};

export function ShoppingItemModal({ open, itemToEdit, onClose, onSave }: ShoppingItemModalProps) {
  const [form, setForm] = useState<ShoppingFormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isEdit = !!itemToEdit;

  useEffect(() => {
    if (open) {
      if (itemToEdit) {
        setForm({
          product: itemToEdit.product,
          brand: itemToEdit.brand ?? '',
          variant: itemToEdit.variant ?? '',
          notes: itemToEdit.notes ?? '',
        });
      } else {
        setForm(EMPTY);
      }
      setErr(null);
      setSubmitting(false);
    }
  }, [open, itemToEdit]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product.trim()) {
      setErr('Product name is required.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save item.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-[fadeIn_120ms_ease-out]">
      <div className="w-full sm:max-w-md bg-neutral-900 border border-neutral-800 rounded-t-3xl sm:rounded-3xl p-5 pb-8 shadow-2xl animate-[slideUp_200ms_ease-out]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? 'Edit Shopping Item' : 'Add Shopping Item'}
          </h2>
          <button
            onClick={onClose}
            className="h-9 w-9 grid place-items-center rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 active:scale-95 transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Product" required>
            <input
              autoFocus
              value={form.product}
              onChange={(e) => setForm({ ...form, product: e.target.value })}
              placeholder="e.g. HDMI cable, Birthday gift"
              className="input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Brand">
              <input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="optional"
                className="input"
              />
            </Field>
            <Field label="Variant">
              <input
                value={form.variant}
                onChange={(e) => setForm({ ...form, variant: e.target.value })}
                placeholder="optional"
                className="input"
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="optional"
              rows={2}
              className="input py-2.5 resize-none"
            />
          </Field>

          {err && <p className="text-sm text-red-400">{err}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full mt-2 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add to shopping list'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-neutral-400 mb-1">
        {label}
        {required && <span className="text-emerald-400"> *</span>}
      </span>
      {children}
    </label>
  );
}
