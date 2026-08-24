import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Dot } from 'recharts';
import { TrendingUp, LineChart as LineIcon } from 'lucide-react';
import { pluralize, comparablePrice, formatComparable, type InventoryItem, type RestockEntry } from './types';
import { useRestockHistory } from './hooks';

interface InsightsViewProps {
  items: InventoryItem[];
}

interface ChartPoint {
  date: string;
  ts: number;
  price: number;
  qty: number;
  comparable: string | null;
}

export function InsightsView({ items }: InsightsViewProps) {
  const [selectedId, setSelectedId] = useState<string>('');

  const effectiveId = selectedId || items[0]?.id || '';
  const { history, loading } = useRestockHistory(effectiveId || null);

  const selectedItem = items.find((it) => it.id === effectiveId);
  const itemSpec = selectedItem?.specification ?? null;

  const chartData = useMemo<ChartPoint[]>(
    () =>
      history
        .filter((h) => h.price !== null)
        .map((h) => {
          const cp = comparablePrice(Number(h.price), itemSpec);
          return {
            date: new Date(h.restocked_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: '2-digit',
            }),
            ts: new Date(h.restocked_at).getTime(),
            price: Number(h.price),
            qty: h.quantity,
            comparable: cp ? formatComparable(cp.price, cp.unitLabel) : null,
          };
        })
        .sort((a, b) => a.ts - b.ts),
    [history, itemSpec],
  );

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

  const latestComparable = useMemo(() => {
    if (stats && itemSpec) {
      const cp = comparablePrice(stats.latest, itemSpec);
      return cp ? formatComparable(cp.price, cp.unitLabel) : null;
    }
    return null;
  }, [stats, itemSpec]);

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

          {latestComparable && (
            <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-2xl p-3 flex items-center justify-between">
              <span className="text-xs text-neutral-400">
                Comparable price{itemSpec ? ` (${itemSpec})` : ''}
              </span>
              <span className="text-sm font-semibold text-emerald-400 tabular-nums">{latestComparable}</span>
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
                      const qty = p?.qty ?? 1;
                      const lines = [`${value.toFixed(2)} RON`, `×${qty} ${pluralize('unit', qty)}`];
                      if (p?.comparable) lines.push(p.comparable);
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
                .map((h: RestockEntry) => (
                  <li key={h.id} className="py-2.5 flex items-center justify-between text-sm">
                    <span className="text-neutral-400">
                      {new Date(h.restocked_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-neutral-500">×{h.quantity}</span>
                      <span className="text-white font-medium tabular-nums">
                        {h.price !== null ? `${Number(h.price).toFixed(2)} RON` : '—'}
                      </span>
                    </span>
                  </li>
                ))}
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
