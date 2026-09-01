import { useState } from 'react';
import { Minus, Plus, ShoppingCart, PackagePlus, Check } from 'lucide-react';
import { pluralize } from '../../types';
import type { InventoryItem } from '../../types';

interface ItemStockActionsProps {
  item: InventoryItem;
  busy: boolean;
  onAdjust: (delta: number) => Promise<void>;
  onRestock: () => void;
  onToggleShoppingList: () => Promise<void>;
}

export function ItemStockActions({
  item,
  busy,
  onAdjust,
  onRestock,
  onToggleShoppingList,
}: ItemStockActionsProps) {
  const [adjusting, setAdjusting] = useState(false);
  const isConsumable = item.consumable !== false;
  const isOut = isConsumable && item.count === 0;
  const isLow = isConsumable && !isOut && item.min_stock > 0 && item.count <= item.min_stock;
  const onShoppingList = item.is_on_manual_list;

  const handleAdjust = async (delta: number) => {
    if (busy || adjusting) return;
    setAdjusting(true);
    try {
      await onAdjust(delta);
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="mx-4 mb-1">
      <div className={`rounded-2xl border px-4 py-3 space-y-3 ${
        isOut
          ? 'border-red-900/60 bg-red-950/20'
          : isLow
            ? 'border-amber-900/50 bg-amber-950/15'
            : 'border-neutral-800 bg-neutral-900/60'
      }`}>
        {/* Stock display + stepper row */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className={`text-3xl font-bold tabular-nums leading-none ${
              isOut ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-white'
            }`}>
              {item.count}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">{pluralize(item.unit, item.count)}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAdjust(-1)}
              disabled={busy || adjusting || item.count === 0}
              className="h-11 w-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white grid place-items-center active:scale-90 transition disabled:opacity-40"
              aria-label={`Decrease ${item.product}`}
            >
              <Minus className="h-5 w-5" />
            </button>
            <button
              onClick={() => handleAdjust(1)}
              disabled={busy || adjusting}
              className="h-11 w-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white grid place-items-center active:scale-90 transition disabled:opacity-40"
              aria-label={`Increase ${item.product}`}
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Action buttons row */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onRestock}
            className="h-10 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium active:scale-[0.97] transition"
          >
            <PackagePlus className="h-4 w-4 shrink-0" />
            Restock
          </button>

          <button
            onClick={onToggleShoppingList}
            className={`h-10 flex items-center justify-center gap-1.5 rounded-xl text-sm font-medium active:scale-[0.97] transition border ${
              onShoppingList
                ? 'bg-emerald-600/15 border-emerald-600/40 text-emerald-300 hover:bg-emerald-600/25'
                : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700 hover:text-white'
            }`}
            aria-pressed={onShoppingList}
          >
            {onShoppingList ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <ShoppingCart className="h-4 w-4 shrink-0" />
            )}
            {onShoppingList ? 'On list' : 'Add to list'}
          </button>
        </div>
      </div>
    </div>
  );
}
