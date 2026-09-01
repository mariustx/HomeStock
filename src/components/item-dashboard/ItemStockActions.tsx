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
    <section className="mx-4 mb-2">
      <div className={`rounded-2xl border p-4 space-y-4 ${
        isOut
          ? 'border-red-900/60 bg-red-950/20'
          : isLow
            ? 'border-amber-900/50 bg-amber-950/15'
            : 'border-neutral-800 bg-neutral-900/60'
      }`}>
        {/* Section title */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            Current Stock
          </span>
          {isLow && !isOut && (
            <span className="text-[11px] font-medium text-amber-400">
              Low (min: {item.min_stock})
            </span>
          )}
          {isOut && (
            <span className="text-[11px] font-medium text-red-400">
              Empty
            </span>
          )}
        </div>

        {/* Centered Stepper: − 4 pieces + */}
        <div className="flex items-center justify-between gap-3 px-2">
          <button
            onClick={() => handleAdjust(-1)}
            disabled={busy || adjusting || item.count === 0}
            className="h-12 w-12 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center active:scale-90 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-sm border border-neutral-700/60 shrink-0"
            aria-label={`Decrease ${item.product}`}
          >
            <Minus className="h-5 w-5" />
          </button>

          <div className="flex-1 text-center min-w-0 py-0.5">
            <div className={`text-3xl sm:text-4xl font-black tabular-nums tracking-tight leading-none ${
              isOut ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-white'
            }`}>
              {item.count}
            </div>
            <div className="text-xs font-medium text-neutral-400 mt-1 truncate">
              {pluralize(item.unit, item.count)}
            </div>
          </div>

          <button
            onClick={() => handleAdjust(1)}
            disabled={busy || adjusting}
            className="h-12 w-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center active:scale-90 transition disabled:opacity-40 shadow-sm shadow-emerald-950/50 shrink-0"
            aria-label={`Increase ${item.product}`}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {/* Important Primary Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            onClick={onRestock}
            className="h-11 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold active:scale-[0.98] transition shadow-md shadow-emerald-950/40"
          >
            <PackagePlus className="h-4 w-4 shrink-0" />
            + Restock
          </button>

          <button
            onClick={onToggleShoppingList}
            className={`h-11 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold active:scale-[0.98] transition border ${
              onShoppingList
                ? 'bg-emerald-600/15 border-emerald-600/40 text-emerald-300 hover:bg-emerald-600/25'
                : 'bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-700 hover:text-white'
            }`}
            aria-pressed={onShoppingList}
          >
            {onShoppingList ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <ShoppingCart className="h-4 w-4 shrink-0" />
            )}
            {onShoppingList ? 'On Shopping List' : 'Add to Shopping List'}
          </button>
        </div>
      </div>
    </section>
  );
}

