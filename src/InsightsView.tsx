import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Dot } from 'recharts';
import { TrendingUp, LineChart as LineIcon } from 'lucide-react';
import { pluralize, formatPriceWithBasis, type PriceBasis, type InventoryItem, type RestockEntry } from './types';
import { useRestockHistory } from './hooks';

interface InsightsViewProps {
  items: InventoryItem[];
}

interface ChartPoint {
  date: string;
  ts: number;
  price: number;
  qty: number;
  /** Formatted price display, e.g. "3.99 RON/kg" or "3.50 RON" */
  priceDisplay: string;
  /** The price_basis for this specific entry, or null if none recorded */
  priceBasis: PriceBasis | null;
}

export function InsightsView({ items }: InsightsViewProps) {
  const [selectedId, setSelectedId] = useState<string>('');

  const effectiveId = selectedId || items[0]?.id || '';
  const { history, loading } = useRestockHistory(effectiveId || null);

  const selectedItem = items.find((it) => it.id === effectiveId);

  const chartData = useMemo<ChartPoint[]>(
    () =>
      history
        .filter((h) => h.price !== null && !Number.isNaN(Number(h.price)) && Number(h.price) > 0)
        .map((h) => {
          const priceNum = Number(h.price);
          // Use only this entry's own price_basis — never fall back to the product's current basis.
          // A historical entry without a basis remains a plain price.
          const basis = (h.price_basis as PriceBasis | undefined) ?? null;

          return {
            date: new Date(h.restocked_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: '2-digit',
            }),
            ts: new Date(h.restocked_at).getTime(),
            price: priceNum,
            qty: h.quantity,
            priceDisplay: formatPriceWithBasis(priceNum, basis) || `${priceNum.toFixed(2)} RON`,
            priceBasis: basis,
          };
        })
        .sort((a, b) => a.ts - b.ts),
    [history],
  );

  // Basic stats over ALL price entries regardless of basis
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const prices = chartData.map((d) => d.price);
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const latest = prices[prices.length - 1];
    const first = prices[0];
    const change = first > 0 ? ((latest - first) / first) * 100 : 0;
    return { avg, min, max, latest, change };
  }, [chartData]);

  // Per-basis stats: group by basis, only compare entries that share the same basis.
  // Entries without a basis are excluded from per-basis statistics.
  const basisStats = useMemo(() => {
    const groups = new Map<PriceBasis, number[]>();
    for (const point of chartData) {
      if (!point.priceBasis) continue;
      const existing = groups.get(point.priceBasis) ?? [];
      existing.push(point.price);
      groups.set(point.priceBasis, existing);
    }

    const result: Array<{
      basis: PriceBasis;
      avg: number;
      min: number;
      max: number;
      latest: number;
      count: number;
    }> = [];

    for (const [basis, prices] of groups.entries()) {
      if (prices.length === 0) continue;
      const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
      result.push({
        basis,
        avg,
        min: Math.min(...prices),
        max: Math.max(...prices),
        latest: prices[prices.length - 1],
        count: prices.length,
      });
    }
    return result;
  }, [chartData]);

  const latestEntry = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  return (
    <div className="px-4 pb-4 space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">Select item</label>
        <select
          value={effectiveId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="input"
        >
          {items.length === 0 && <option value="">No items yet</option>}
          {items.map((it) => (
            <option key={it.id} value={it.id}>
              {it.product}
              {it.brand ? ` · ${it.brand}` : ''}
              {it.variant ? ` (${it.variant})` : ''}
            </option>
          ))}
        </select>
      </div>

      {!selectedItem ? (
        <div className="flex flex-col items-center justify-center py-24 text-neutral-500 px-6 text-center">
          <LineIcon className="h-12 w-12 mb-3 text-neutral-700" />
          <p className="text-neutral-300 font-medium">No data to show</p>
          <p className="text-sm mt-1">Add items and record restocks to see price trends here.</p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-neutral-500">
          <div className="h-8 w-8 border-2 border-neutral-700 border-t-emerald-400 rounded-full animate-spin mb-3" />
          Loading history…
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-500 px-6 text-center">
          <TrendingUp className="h-10 w-10 mb-3 text-neutral-700" />
          <p className="text-neutral-300 font-medium">No price history yet</p>
          <p className="text-sm mt-1">
            Restock {selectedItem.product} with a price to start tracking trends.
          </p>
        </div>
      ) : (
        <>
          {/* Basic price stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Latest" value={`${stats.latest.toFixed(2)} RON`} />
              <Stat label="Average" value={`${stats.avg.toFixed(2)} RON`} />
              <Stat
                label="Change"
                value={`${stats.change >= 0 ? '+' : ''}${stats.change.toFixed(0)}%`}
                tone={stats.change > 0 ? 'bad' : stats.change < 0 ? 'good' : 'neutral'}
              />
            </div>
          )}

          {/* Latest entry price display */}
          {latestEntry && (
            <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-2xl p-3 flex items-center justify-between">
              <span className="text-xs text-neutral-400">Latest price</span>
              <span className="text-sm font-semibold text-emerald-400 tabular-nums">
                {latestEntry.priceDisplay}
              </span>
            </div>
          )}

          {/* Per-basis comparable statistics — only groups with 2+ entries for meaningful stats */}
          {basisStats.length > 0 && (
            <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 space-y-2">
              <h3 className="text-sm font-medium text-neutral-300">Price per basis</h3>
              <p className="text-xs text-neutral-500">Only entries sharing the same basis are compared.</p>
              {basisStats.map((bs) => (
                <div
                  key={bs.basis}
                  className="rounded-xl bg-neutral-800/40 border border-neutral-800 px-3 py-2.5 flex items-center justify-between gap-2"
                >
                  <span className="text-xs text-neutral-400 shrink-0">RON/{bs.basis}</span>
                  <div className="flex items-center gap-3 text-xs tabular-nums">
                    <span className="text-neutral-500">
                      avg <span className="text-neutral-200">{bs.avg.toFixed(2)}</span>
                    </span>
                    <span className="text-neutral-500">
                      min <span className="text-emerald-400">{bs.min.toFixed(2)}</span>
                    </span>
                    <span className="text-neutral-500">
                      max <span className="text-red-400">{bs.max.toFixed(2)}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 pt-6">
            <h3 className="text-sm font-medium text-neutral-300 mb-1">
              Price paid over time
            </h3>
            <p className="text-xs text-neutral-500 mb-3">
              {selectedItem.product}
              {selectedItem.brand ? ` · ${selectedItem.brand}` : ''}
              {selectedItem.variant ? ` · ${selectedItem.variant}` : ''}
              {selectedItem.specification ? ` · ${selectedItem.specification}` : ''}
            </p>
            <div className="h-64 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="priceLine" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#737373', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#262626' }}
                    minTickGap={20}
                  />
                  <YAxis
                    tick={{ fill: '#737373', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v) => `${v} RON`}
                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#171717',
                      border: '1px solid #404040',
                      borderRadius: 12,
                      fontSize: 12,
                      color: '#fafafa',
                    }}
                    labelStyle={{ color: '#a3a3a3' }}
                    formatter={((value: number, _name: string, props: { payload?: ChartPoint }) => {
                      const p = props?.payload;
                      const lines: string[] = [p?.priceDisplay ?? `${value.toFixed(2)} RON`];
                      const qty = p?.qty ?? 0;
                      if (qty > 0) lines.push(`×${qty} ${pluralize('unit', qty)}`);
                      return lines;
                    }) as unknown as React.ComponentProps<typeof Tooltip>['formatter']}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="url(#priceLine)"
                    strokeWidth={2.5}
                    dot={(props: { cx?: number; cy?: number }) =>
                      props.cx !== undefined && props.cy !== undefined ? (
                        <Dot cx={props.cx} cy={props.cy} r={4} fill="#10b981" stroke="#0a0a0a" strokeWidth={2} />
                      ) : (
                        <></>
                      )
                    }
                    activeDot={{ r: 6, fill: "#34d399", stroke: "#0a0a0a", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4">
            <h3 className="text-sm font-medium text-neutral-300 mb-3">Restock log</h3>
            <ul className="divide-y divide-neutral-800">
              {history
                .slice()
                .reverse()
                .map((h: RestockEntry) => {
                  const priceNum = h.price != null ? Number(h.price) : null;
                  const basis = (h.price_basis as PriceBasis | undefined) ?? null;
                  const display =
                    priceNum != null && !Number.isNaN(priceNum) && priceNum > 0
                      ? formatPriceWithBasis(priceNum, basis) || `${priceNum.toFixed(2)} RON`
                      : '—';
                  return (
                    <li key={h.id} className="py-2.5 flex items-center justify-between text-sm">
                      <span className="text-neutral-400">
                        {new Date(h.restocked_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="flex items-center gap-3">
                        {h.quantity > 0 && (
                          <span className="text-neutral-500">×{h.quantity}</span>
                        )}
                        <span className="text-white font-medium tabular-nums">{display}</span>
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad' | 'neutral';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-400'
      : tone === 'bad'
        ? 'text-red-400'
        : 'text-white';
  return (
    <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500 font-medium">{label}</div>
      <div className={`text-base font-semibold tabular-nums mt-0.5 ${toneClass}`}>{value}</div>
    </div>
  );
}
