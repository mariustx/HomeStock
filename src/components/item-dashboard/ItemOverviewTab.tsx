import { Package, Layers, Clock, Calendar, RefreshCw, FileText, Info } from 'lucide-react';
import type { InventoryItem } from '../../types';
import type { ConsumptionStats } from '../../types';
import { TRACKING_MODE_LABELS, formatDateOnly } from '../../types';
import { formatConsumptionDuration } from '../../lib/consumption';

interface ItemOverviewTabProps {
  item: InventoryItem;
  consumptionStats: ConsumptionStats | null;
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-neutral-800/70 last:border-0">
      <span className="h-7 w-7 rounded-lg bg-neutral-800/60 flex items-center justify-center shrink-0 mt-0.5 text-neutral-400">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">{label}</div>
        <div className="text-sm text-neutral-100 mt-0.5 break-words">{value}</div>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="pt-3 pb-1">
      <h4 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">{title}</h4>
    </div>
  );
}

export function ItemOverviewTab({ item, consumptionStats }: ItemOverviewTabProps) {
  const isConsumable = item.consumable !== false;

  const openedDateFormatted = formatDateOnly(item.opened_at);
  const daysSinceOpen = item.opened_at
    ? Math.round((Date.now() - new Date(item.opened_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const hasConsumptionData = consumptionStats && consumptionStats.openingsCount > 0;
  const hasNotes = Boolean(item.notes?.trim());

  return (
    <div className="px-4 pb-4 space-y-0">

      {/* Tracking & Packaging */}
      <SectionHeader title="Tracking & packaging" />
      <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 px-3.5 divide-y-0">
        <DetailRow
          icon={<Package className="h-3.5 w-3.5" />}
          label="Tracking mode"
          value={TRACKING_MODE_LABELS[item.tracking_mode]}
        />
        {item.unit && (
          <DetailRow
            icon={<Layers className="h-3.5 w-3.5" />}
            label="Stock unit"
            value={item.unit}
          />
        )}
        {isConsumable && item.purchase_package && (
          <DetailRow
            icon={<Package className="h-3.5 w-3.5" />}
            label="Purchase package"
            value={`${item.purchase_package}${item.units_per_package > 1 ? ` (${item.units_per_package} ${item.unit}s each)` : ''}`}
          />
        )}
        {item.price_basis && (
          <DetailRow
            icon={<Info className="h-3.5 w-3.5" />}
            label="Price basis"
            value={`per ${item.price_basis}`}
          />
        )}
        {isConsumable && (
          <DetailRow
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            label="Auto-restock"
            value={
              item.restock_enabled !== false
                ? <span className="text-emerald-400">Enabled — adds to shopping list when low</span>
                : <span className="text-neutral-500">Disabled</span>
            }
          />
        )}
        {item.min_stock > 0 && isConsumable && (
          <DetailRow
            icon={<Info className="h-3.5 w-3.5" />}
            label="Minimum stock"
            value={`${item.min_stock} ${item.unit}${item.min_stock !== 1 ? 's' : ''} — alert at or below`}
          />
        )}
      </div>

      {/* Consumption — consumables only */}
      {isConsumable && (
        <>
          <SectionHeader title="Consumption" />
          <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 px-3.5 divide-y-0">
            {openedDateFormatted ? (
              <DetailRow
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Currently open since"
                value={
                  <span>
                    {openedDateFormatted}
                    {daysSinceOpen !== null && (
                      <span className="text-neutral-500 ml-1">({daysSinceOpen === 0 ? 'today' : `${daysSinceOpen} day${daysSinceOpen !== 1 ? 's' : ''} ago`})</span>
                    )}
                  </span>
                }
              />
            ) : (
              <DetailRow
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Currently open since"
                value={<span className="text-neutral-500">Not opened yet</span>}
              />
            )}

            {hasConsumptionData && consumptionStats!.periodsCount >= 1 ? (
              <>
                <DetailRow
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Avg pack duration"
                  value={
                    <span>
                      {formatConsumptionDuration(consumptionStats!.averageDays)}
                      <span className="text-neutral-500 ml-1">
                        (from {consumptionStats!.periodsCount} {consumptionStats!.periodsCount === 1 ? 'period' : 'periods'})
                      </span>
                    </span>
                  }
                />
                {consumptionStats!.lastDays !== null && (
                  <DetailRow
                    icon={<Clock className="h-3.5 w-3.5" />}
                    label="Last pack lasted"
                    value={formatConsumptionDuration(consumptionStats!.lastDays)}
                  />
                )}
              </>
            ) : (
              <DetailRow
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Usage duration"
                value={
                  <span className="text-neutral-500">
                    {consumptionStats && consumptionStats.openingsCount === 1
                      ? 'Need one more opening to calculate average'
                      : 'No data — use − to record openings'
                    }
                  </span>
                }
              />
            )}
          </div>
        </>
      )}

      {/* Notes */}
      {hasNotes && (
        <>
          <SectionHeader title="Notes" />
          <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 px-3.5">
            <DetailRow
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Your notes"
              value={item.notes!}
            />
          </div>
        </>
      )}
    </div>
  );
}
