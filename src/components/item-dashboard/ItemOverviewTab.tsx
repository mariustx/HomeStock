import { Package, Layers, Clock, Calendar, RefreshCw, FileText, Info } from 'lucide-react';
import type { InventoryItem } from '../../types';
import type { ConsumptionStats } from '../../types';
import { TRACKING_MODE_LABELS, formatDateOnly } from '../../types';
import { formatConsumptionDuration } from '../../lib/consumption';

interface ItemOverviewTabProps {
  item: InventoryItem;
  consumptionStats: ConsumptionStats | null;
}

function DetailRow({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-neutral-800/60 last:border-0">
      <span className="h-7 w-7 rounded-lg bg-neutral-800/80 flex items-center justify-center shrink-0 mt-0.5 text-neutral-400">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">{label}</div>
        <div className="text-sm font-medium text-neutral-100 mt-0.5 break-words">{value}</div>
        {sub && <div className="text-xs text-neutral-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="pt-3 pb-1.5">
      <h3 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">{title}</h3>
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

  // Package size resolution
  let packageSizeDisplay: string | null = null;
  if (item.package_size) {
    packageSizeDisplay = item.package_size;
  } else if (item.purchase_package) {
    packageSizeDisplay = item.purchase_package;
    if (item.units_per_package > 1) {
      packageSizeDisplay += ` (${item.units_per_package} ${item.unit}s each)`;
    }
  } else if (item.units_per_package > 1) {
    packageSizeDisplay = `${item.units_per_package} ${item.unit}s per package`;
  }

  return (
    <div className="px-4 pb-6 space-y-2">

      {/* Tracking & Packaging */}
      <section>
        <SectionHeader title="Tracking & packaging" />
        <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 px-4">
          <DetailRow
            icon={<Package className="h-3.5 w-3.5" />}
            label="Tracking mode"
            value={TRACKING_MODE_LABELS[item.tracking_mode]}
          />

          {packageSizeDisplay && (
            <DetailRow
              icon={<Layers className="h-3.5 w-3.5" />}
              label="Package size"
              value={packageSizeDisplay}
            />
          )}

          {item.unit && !packageSizeDisplay && (
            <DetailRow
              icon={<Layers className="h-3.5 w-3.5" />}
              label="Stock unit"
              value={item.unit}
            />
          )}

          {item.price_basis && (
            <DetailRow
              icon={<Info className="h-3.5 w-3.5" />}
              label="Price basis"
              value={`Per ${item.price_basis}`}
            />
          )}

          {isConsumable && (
            <DetailRow
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              label="Auto-restock"
              value={
                item.restock_enabled !== false
                  ? <span className="text-emerald-400">Enabled</span>
                  : <span className="text-neutral-400">Disabled</span>
              }
              sub={item.restock_enabled !== false ? 'Adds to shopping list when stock reaches minimum' : undefined}
            />
          )}

          {item.min_stock > 0 && isConsumable && (
            <DetailRow
              icon={<Info className="h-3.5 w-3.5" />}
              label="Minimum stock threshold"
              value={`${item.min_stock} ${item.unit}${item.min_stock !== 1 ? 's' : ''}`}
              sub="Triggers low stock alert at or below this count"
            />
          )}
        </div>
      </section>

      {/* Consumption & Usage — consumables only */}
      {isConsumable && (
        <section>
          <SectionHeader title="Consumption & usage" />
          <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 px-4">
            <DetailRow
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Opened"
              value={
                openedDateFormatted ? (
                  <span>
                    {openedDateFormatted}
                    {daysSinceOpen !== null && (
                      <span className="text-neutral-400 font-normal ml-1.5">
                        ({daysSinceOpen === 0 ? 'today' : `${daysSinceOpen}d ago`})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-neutral-500 font-normal">Not opened yet</span>
                )
              }
            />

            {hasConsumptionData && consumptionStats!.periodsCount >= 1 ? (
              <>
                <DetailRow
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Average duration"
                  value={formatConsumptionDuration(consumptionStats!.averageDays)}
                  sub={`Derived from ${consumptionStats!.periodsCount} completed ${consumptionStats!.periodsCount === 1 ? 'period' : 'periods'}`}
                />
                {consumptionStats!.lastDays !== null && (
                  <DetailRow
                    icon={<Clock className="h-3.5 w-3.5" />}
                    label="Last duration"
                    value={formatConsumptionDuration(consumptionStats!.lastDays)}
                  />
                )}
              </>
            ) : (
              <DetailRow
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Average duration"
                value={
                  <span className="text-neutral-500 font-normal">
                    {consumptionStats && consumptionStats.openingsCount === 1
                      ? 'Need one more opening event to calculate duration'
                      : 'No consumption history recorded yet'}
                  </span>
                }
              />
            )}
          </div>
        </section>
      )}

      {/* Notes */}
      {hasNotes && (
        <section>
          <SectionHeader title="Notes" />
          <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 px-4">
            <DetailRow
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Notes"
              value={item.notes!}
            />
          </div>
        </section>
      )}
    </div>
  );
}

