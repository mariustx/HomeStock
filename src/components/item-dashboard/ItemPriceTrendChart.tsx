import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Dot,
} from 'recharts';
import { ArrowDown, Clock, TrendingUp, Info, Tag, Store } from 'lucide-react';
import type { RestockEntry, PriceBasis, InventoryItem } from '../../types';
import { formatPriceWithBasis, pluralize } from '../../types';

interface ChartPoint {
  id: string;
  chartDate: string;
  dateFormatted: string;
  ts: number;
  price: number;
  qty: number;
  store: string | null;
  priceDisplay: string;
  notes: string | null;
  isLowest: boolean;
  isLatest: boolean;
}

interface ItemPriceTabProps {
  item: InventoryItem;
  history: RestockEntry[];
}

export function ItemPriceTrendChart({ history, item }: { history: RestockEntry[]; item?: InventoryItem }) {
  const { validEntries, priceStats, chartData } = useMemo(() => {
    const valid = history
      .filter((h) => h.price !== null && !Number.isNaN(Number(h.price)) && Number(h.price) > 0)
      .map((h) => {
        const priceNum = Number(h.price);
        const basis = (h.price_basis as PriceBasis | undefined) ?? null;
        const d = new Date(h.restocked_at);
        return {
          id: h.id,
          chartDate: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }),
          dateFormatted: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
          ts: d.getTime(),
          price: priceNum,
          qty: h.quantity,
          store: h.store,
          notes: h.notes,
          priceDisplay: formatPriceWithBasis(priceNum, basis) || `${priceNum.toFixed(2)} RON`,
          isLowest: false,
          isLatest: false,
        };
      })
      .sort((a, b) => a.ts - b.ts);

    if (valid.length === 0) {
      return { validEntries: [], priceStats: null, chartData: [] };
    }

    const prices = valid.map((e) => e.price);
    const minPrice = Math.min(...prices);
    const avgPrice = prices.reduce((s, p) => s + p, 0) / prices.length;
    const latestId = valid[valid.length - 1].id;

    const withFlags: ChartPoint[] = valid.map((e) => ({
      ...e,
      isLowest: e.price === minPrice,
      isLatest: e.id === latestId,
    }));

    const lowestEntry = withFlags.find((e) => e.price === minPrice) || withFlags[0];
    const latestEntry = withFlags[withFlags.length - 1];

    return {
      validEntries: withFlags,
      priceStats: {
        minPrice,
        avgPrice,
        count: valid.length,
        lowestEntry,
        latestEntry,
      },
      chartData: withFlags,
    };
  }, [history]);

  if (validEntries.length === 0) {
    return (
      <div className="px-4 pb-6">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 flex flex-col items-center text-center gap-2.5">
          <div className="h-10 w-10 rounded-2xl bg-neutral-800 flex items-center justify-center text-neutral-500">
            <TrendingUp className="h-5 w-5" />
          </div>
          <h4 className="text-sm font-semibold text-neutral-200">No price history yet</h4>
          <p className="text-xs text-neutral-400 max-w-xs">
            Log prices when restocking or edit this product to record previous purchase prices.
          </p>
        </div>
      </div>
    );
  }

  const yMin = Math.max(0, Math.min(...chartData.map((d) => d.price)) - 1);
  const yMax = Math.max(...chartData.map((d) => d.price)) + 1;
  const avg = priceStats!.avgPrice;

  // Newest first for log list
  const logEntries = [...validEntries].reverse();

  return (
    <div className="px-4 pb-6 space-y-4">
      {/* Price basis note if available */}
      {item?.price_basis && (
        <div className="rounded-xl bg-neutral-900/40 border border-neutral-800/80 px-3.5 py-2 flex items-center gap-2 text-xs text-neutral-400">
          <Info className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
          <span>Price basis: <strong className="text-neutral-200 font-semibold">Per {item.price_basis}</strong></span>
        </div>
      )}

      {/* Chart Section */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-neutral-200">Price Trend</h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {priceStats!.count} {pluralize('record', priceStats!.count)} logged
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            <span>Trend</span>
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400 ml-2" />
            <span>Avg</span>
          </div>
        </div>

        {/* Chart */}
        <div className="h-52 -ml-2 pr-2 pb-2 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="priceAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="90%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="priceLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
              </defs>

              <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />

              <XAxis
                dataKey="chartDate"
                tick={{ fill: '#737373', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#262626' }}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: '#737373', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v) => `${v}`}
                domain={[yMin, yMax]}
              />

              <ReferenceLine
                y={avg}
                stroke="#f59e0b"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{ value: `Avg (${avg.toFixed(1)})`, position: 'insideTopRight', fill: '#f59e0b', fontSize: 10 }}
              />

              <Tooltip
                contentStyle={{
                  background: '#171717',
                  border: '1px solid #404040',
                  borderRadius: 12,
                  fontSize: 12,
                  color: '#fafafa',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
                }}
                labelStyle={{ color: '#a3a3a3', fontSize: 11, marginBottom: 4 }}
                formatter={((value: unknown, _name: unknown, props: { payload?: ChartPoint }) => {
                  const p = props?.payload;
                  const numVal = typeof value === 'number' ? value : Number(value);
                  const lines: string[] = [p?.priceDisplay ?? `${numVal.toFixed(2)} RON`];
                  if (p?.qty && p.qty > 0) lines.push(`Quantity: ${p.qty} ${pluralize('unit', p.qty)}`);
                  if (p?.store) lines.push(`Store: ${p.store}`);
                  if (p?.notes) lines.push(`Note: ${p.notes}`);
                  return lines;
                }) as React.ComponentProps<typeof Tooltip>['formatter']}
              />

              <Area
                type="monotone"
                dataKey="price"
                stroke="url(#priceLineGrad)"
                strokeWidth={2.5}
                fill="url(#priceAreaGradient)"
                dot={(props: { cx?: number; cy?: number; payload?: ChartPoint }) => {
                  const { cx, cy, payload } = props;
                  if (cx === undefined || cy === undefined || !payload) return <></>;
                  if (payload.isLatest) {
                    return <Dot cx={cx} cy={cy} r={5} fill="#38bdf8" stroke="#0a0a0a" strokeWidth={2} />;
                  }
                  if (payload.isLowest) {
                    return <Dot cx={cx} cy={cy} r={5} fill="#10b981" stroke="#0a0a0a" strokeWidth={2} />;
                  }
                  return <Dot cx={cx} cy={cy} r={3} fill="#10b981" stroke="#0a0a0a" strokeWidth={1.5} />;
                }}
                activeDot={{ r: 6, fill: '#34d399', stroke: '#0a0a0a', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recorded Price History Log */}
      <div>
        <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
          Price Records ({logEntries.length})
        </h4>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 overflow-hidden">
          <ul className="divide-y divide-neutral-800/80">
            {logEntries.map((entry) => {
              return (
                <li key={entry.id} className="p-3.5 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-neutral-200">
                        {entry.dateFormatted}
                      </span>
                      {entry.isLowest && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <ArrowDown className="h-2.5 w-2.5" /> Lowest
                        </span>
                      )}
                      {entry.isLatest && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                          <Clock className="h-2.5 w-2.5" /> Latest
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-neutral-400 flex-wrap">
                      {entry.store && (
                        <span className="flex items-center gap-1">
                          <Store className="h-3 w-3 text-neutral-500" />
                          {entry.store}
                        </span>
                      )}
                      {entry.qty > 0 && (
                        <span>
                          {entry.store ? '· ' : ''}Qty: {entry.qty}
                        </span>
                      )}
                      {entry.notes && (
                        <span className="italic text-neutral-500 truncate max-w-[150px]">
                          "{entry.notes}"
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-sm font-bold text-white tabular-nums shrink-0 pt-0.5">
                    {entry.priceDisplay}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

