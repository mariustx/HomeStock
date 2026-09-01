import { ArrowLeft, Pencil } from 'lucide-react';
import type { InventoryItem } from '../../types';
import { TRACKING_MODE_LABELS } from '../../types';

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
    <header className="shrink-0 px-4 py-3 border-b border-neutral-800/80 bg-neutral-950/95 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center gap-3">
        {/* Back navigation */}
        <button
          onClick={onClose}
          className="h-9 w-9 -ml-1 grid place-items-center rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 active:scale-90 transition shrink-0"
          aria-label="Back to inventory"
          title="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Product identity */}
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-white leading-tight truncate">
            {item.product}
          </h1>
          {subtitle && (
            <p className="text-xs text-neutral-400 leading-snug mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>

        {/* Edit Action */}
        <button
          onClick={onEdit}
          className="h-8 px-3 flex items-center gap-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-semibold active:scale-95 transition shrink-0 border border-neutral-700/60"
          aria-label="Edit product"
        >
          <Pencil className="h-3.5 w-3.5 text-neutral-400" />
          Edit
        </button>
      </div>

      {/* Useful Badges Row */}
      <div className="flex items-center gap-1.5 mt-2 pl-8 flex-wrap">
        <span className={`text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-md border ${
          isConsumable
            ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
            : 'bg-neutral-800/70 text-neutral-300 border-neutral-700/60'
        }`}>
          {isConsumable ? 'Consumable' : 'Durable'}
        </span>

        <span className="text-[10px] font-medium tracking-wide px-2 py-0.5 rounded-md bg-neutral-800/60 text-neutral-400 border border-neutral-700/50">
          {TRACKING_MODE_LABELS[item.tracking_mode]}
        </span>

        {isOut && (
          <span className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-md bg-red-950/60 text-red-400 border border-red-800/60">
            Out of stock
          </span>
        )}
        {isLow && (
          <span className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-md bg-amber-950/60 text-amber-400 border border-amber-800/60">
            Low stock
          </span>
        )}
      </div>
    </header>
  );
}

