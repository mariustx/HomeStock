import { Pencil, X, Package, Zap } from 'lucide-react';
import type { InventoryItem } from '../../types';

interface ItemDashboardHeaderProps {
  item: InventoryItem;
  onEdit: () => void;
  onClose: () => void;
}

export function ItemDashboardHeader({ item, onEdit, onClose }: ItemDashboardHeaderProps) {
  const isConsumable = item.consumable !== false;
  const isOut = isConsumable && item.count === 0;
  const isLow = isConsumable && !isOut && item.min_stock > 0 && item.count <= item.min_stock;

  const subtitleParts: string[] = [];
  if (item.brand) subtitleParts.push(item.brand);
  if (item.variant) subtitleParts.push(item.variant);
  if (item.specification) subtitleParts.push(item.specification);
  const subtitle = subtitleParts.join(' · ');

  return (
    <div className="shrink-0 px-4 pt-4 pb-3 border-b border-neutral-800/60">
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div className={`mt-0.5 h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${
          isConsumable
            ? 'bg-emerald-600/15 border border-emerald-600/30'
            : 'bg-neutral-800 border border-neutral-700'
        }`}>
          {isConsumable
            ? <Zap className="h-4 w-4 text-emerald-400" />
            : <Package className="h-4 w-4 text-neutral-400" />
          }
        </div>

        {/* Product identity */}
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-white leading-tight truncate">{item.product}</h2>
          {subtitle ? (
            <p className="text-[13px] text-neutral-400 leading-snug mt-0.5 truncate">{subtitle}</p>
          ) : (
            <p className="text-[13px] text-neutral-600 leading-snug mt-0.5">No brand</p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {/* Type badge */}
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
              isConsumable
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
            }`}>
              {isConsumable ? 'Consumable' : 'Durable'}
            </span>
            {/* Stock status badge */}
            {isOut && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-800/50">
                Out of stock
              </span>
            )}
            {isLow && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/50">
                Low stock
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="h-9 px-3 flex items-center gap-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-medium active:scale-95 transition"
            aria-label="Edit item"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            onClick={onClose}
            className="h-9 w-9 grid place-items-center rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 active:scale-95 transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
