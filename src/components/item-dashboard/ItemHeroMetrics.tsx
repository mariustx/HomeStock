import { ArrowDown, Clock, TrendingUp, Calendar, Package, AlertCircle } from 'lucide-react';
import type { InventoryItem } from '../../types';
import { formatPriceWithBasis, pluralize } from '../../types';
import type { ConsumptionStats } from '../../types';
import type { RestockEntry } from '../../types';
import { calculateDaysRemaining } from '../../lib/consumption';

interface PriceStats {
  lowestPrice: number;
  lowestPriceDisplay: string;
  lowestDate: string;
  lowestStore: string | null;
  latestPrice: number;
  latestPriceDisplay: string;
  latestDate: string;
  latestStore: string | null;
  avgPrice: number;
  count: number;
}

interface ItemHeroMetricsProps {
  item: InventoryItem;
  priceStats: PriceStats | null;
  consumptionStats: ConsumptionStats | null;
}

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string | null;
  icon: React.ReactNode;
  tone: 'emerald' | 'sky' | 'amber' | 'red' | 'neutral';
}

function MetricCard({ label, value, sub, icon, tone }: MetricCardProps) {
  const valueClass =
    tone === 'emerald' ? 'text-emerald-400' :
    tone === 'sky' ? 'text-sky-400' :
    tone === 'amber' ? 'text-amber-400' :
    tone === 'red' ? 'text-red-400' :
    'text-white';

  const iconBg =
    tone === 'emerald' ? 'bg-emerald-950/60 text-emerald-400' :
    tone === 'sky' ? 'bg-sky-950/60 text-sky-400' :
    tone === 'amber' ? 'bg-amber-950/60 text-amber-400' :
    tone === 'red' ? 'bg-red-950/60 text-red-400' :
    'bg-neutral-800 text-neutral-400';

  return (
    <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3 flex flex-col min-w-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{label}</span>
        <span className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </span>
      </div>
      <div className={`text-base font-bold tabular-nums truncate ${valueClass}`}>{value}</div>
      {sub && <div className="text-[11px] text-neutral-500 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

export function ItemHeroMetrics({ item, priceStats, consumptionStats }: ItemHeroMetricsProps) {
  const isConsumable = item.consumable !== false;

  // --- Metric 1: Latest Price ---
  const metricLatest: MetricCardProps = priceStats
    ? {
        label: 'Latest price',
        value: priceStats.latestPriceDisplay,
        sub: [priceStats.latestDate, priceStats.latestStore].filter(Boolean).join(' · ') || null,
        icon: <Clock className="h-3.5 w-3.5" />,
        tone: 'sky',
      }
    : {
        label: 'Latest price',
        value: '—',
        sub: 'No price recorded',
        icon: <Clock className="h-3.5 w-3.5" />,
        tone: 'neutral',
      };

  // --- Metric 2: Lowest Price ---
  const metricLowest: MetricCardProps = priceStats
    ? {
        label: 'Lowest price',
        value: priceStats.lowestPriceDisplay,
        sub: [priceStats.lowestDate, priceStats.lowestStore].filter(Boolean).join(' · ') || null,
        icon: <ArrowDown className="h-3.5 w-3.5" />,
        tone: 'emerald',
      }
    : {
        label: 'Lowest price',
        value: '—',
        sub: 'Record a restock to track',
        icon: <ArrowDown className="h-3.5 w-3.5" />,
        tone: 'neutral',
      };

  // --- Metric 3: Avg Price ---
  const metricAvg: MetricCardProps = priceStats
    ? {
        label: 'Avg price',
        value: `${priceStats.avgPrice.toFixed(2)} RON`,
        sub: `${priceStats.count} ${priceStats.count === 1 ? 'record' : 'records'}`,
        icon: <TrendingUp className="h-3.5 w-3.5" />,
        tone: 'amber',
      }
    : {
        label: 'Avg price',
        value: '—',
        sub: 'No price history yet',
        icon: <TrendingUp className="h-3.5 w-3.5" />,
        tone: 'neutral',
      };

  // --- Metric 4: Est. Days Left (consumables) or Last Purchase (non-consumables) ---
  let metricFourth: MetricCardProps;

  if (isConsumable) {
    if (consumptionStats) {
      const daysRemaining = calculateDaysRemaining(item.opened_at, item.count, consumptionStats);

      if (daysRemaining !== null) {
        metricFourth = {
          label: 'Est. days left',
          value: `~${daysRemaining} days`,
          sub: consumptionStats.averageDays !== null
            ? `Avg ${Math.round(consumptionStats.averageDays)}d/unit`
            : null,
          icon: <Calendar className="h-3.5 w-3.5" />,
          tone: daysRemaining <= 7 ? 'red' : daysRemaining <= 14 ? 'amber' : 'emerald',
        };
      } else if (consumptionStats.openingsCount > 0) {
        // Has opening events, but not enough for average yet
        metricFourth = {
          label: 'Est. days left',
          value: 'Not enough data',
          sub: 'Need 2+ openings',
          icon: <AlertCircle className="h-3.5 w-3.5" />,
          tone: 'neutral',
        };
      } else {
        metricFourth = {
          label: 'Est. days left',
          value: '—',
          sub: 'No openings yet',
          icon: <Calendar className="h-3.5 w-3.5" />,
          tone: 'neutral',
        };
      }
    } else {
      metricFourth = {
        label: 'Est. days left',
        value: '—',
        sub: 'No consumption data',
        icon: <Calendar className="h-3.5 w-3.5" />,
        tone: 'neutral',
      };
    }
  } else {
    // Non-consumables: Estimated Days Left does not apply -> show Last Purchase
    metricFourth = priceStats
      ? {
          label: 'Last purchase',
          value: priceStats.latestDate,
          sub: priceStats.latestStore || 'Recorded in restocks',
          icon: <Calendar className="h-3.5 w-3.5" />,
          tone: 'neutral',
        }
      : {
          label: 'Added',
          value: item.created_at
            ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
            : '—',
          sub: 'Date added',
          icon: <Calendar className="h-3.5 w-3.5" />,
          tone: 'neutral',
        };
  }

  return (
    <div className="grid grid-cols-2 gap-2 px-4 py-2">
      <MetricCard {...metricLatest} />
      <MetricCard {...metricLowest} />
      <MetricCard {...metricAvg} />
      <MetricCard {...metricFourth} />
    </div>
  );
}

/**
 * Derive PriceStats from raw restock history entries.
 * Exported so ItemDashboardModal can call it once and pass result down.
 */
export function derivePriceStats(history: RestockEntry[]): PriceStats | null {
  const valid = history
    .filter((h) => h.price !== null && !Number.isNaN(Number(h.price)) && Number(h.price) > 0)
    .map((h) => {
      const priceNum = Number(h.price);
      const basis = h.price_basis ?? null;
      const d = new Date(h.restocked_at);
      return {
        id: h.id,
        price: priceNum,
        priceDisplay: formatPriceWithBasis(priceNum, basis) || `${priceNum.toFixed(2)} RON`,
        date: h.restocked_at,
        dateFormatted: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
        store: h.store,
        qty: h.quantity,
        ts: d.getTime(),
        priceBasis: basis,
        notes: h.notes,
      };
    })
    .sort((a, b) => a.ts - b.ts);

  if (valid.length === 0) return null;

  const prices = valid.map((e) => e.price);
  const minPrice = Math.min(...prices);
  const avgPrice = prices.reduce((s, p) => s + p, 0) / prices.length;
  const latest = valid[valid.length - 1];
  const lowest = valid.find((e) => e.price === minPrice) || valid[0];

  return {
    lowestPrice: minPrice,
    lowestPriceDisplay: lowest.priceDisplay,
    lowestDate: lowest.dateFormatted,
    lowestStore: lowest.store,
    latestPrice: latest.price,
    latestPriceDisplay: latest.priceDisplay,
    latestDate: latest.dateFormatted,
    latestStore: latest.store,
    avgPrice,
    count: valid.length,
  };
}
