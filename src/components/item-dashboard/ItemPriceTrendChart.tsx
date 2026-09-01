import { useMemo } from 'react';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Dot,
} from 'recharts';
import { ArrowDown, Clock, TrendingUp } from 'lucide-react';
import type { RestockEntry, PriceBasis } from '../../types';
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
  isLowest: boolean;
  isLatest: boolean;
}

interface ItemPriceTrendChartProps {
  history: RestockEntry[];
}

export function ItemPriceTrendChart({ history }: ItemPriceTrendChartProps) {
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

    return {
      validEntries: withFlags,
      priceStats: {
        minPrice,
        avgPrice,
        count: valid.length,
      },
      chartData: withFlags,
    };
  }, [history]);

  if (validEntries.length === 0) {
    return (
      <div className="mx-4 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 flex flex-col items-center text-center gap-2">
        <TrendingUp className="h-8 w-8 text-neutral-700" />
        <p className="text-sm font-medium text-neutral-400">No price history yet</p>
        <p className="text-xs text-neutral-600">Record a restock or use Edit to log a price.</p>
      </div>
    );
  }

  if (validEntries.length === 1) {
    const pt = validEntries[0];
    return (
      <div className="mx-4 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-0.5">Only price recorded</div>
          <div className="text-xl font-bold text-white tabular-nums">{pt.priceDisplay}</div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {pt.dateFormatted}{pt.store ? ` · ${pt.store}` : ''}
          </div>
        </div>
        <p className="text-xs text-neutral-600 text-right max-w-[110px]">Record another restock to see the trend</p>
      </div>
    );
  }

  const yMin = Math.max(0, Math.min(...chartData.map((d) => d.price)) - 1);
  const yMax = Math.max(...chartData.map((d) => d.price)) + 1;
  const avg = priceStats!.avgPrice;

  return (
    <div className="mx-4 rounded-2xl border border-neutral-800 bg-neutral-900/60 overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-200">Price trend</h3>
        <span className="text-[11px] text-neutral-500">{priceStats!.count} {pluralize('record', priceStats!.count)}</span>
      </div>

      {/* Benchmarks row */}
      <div className="px-4 pb-3 flex gap-4">
        <div className="flex items-center gap-1">
          <ArrowDown className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11px] text-neutral-400">Lowest</span>
          <span className="text-[11px] font-semibold text-emerald-400 tabular-nums">
            {formatPriceWithBasis(priceStats!.minPrice, null) || `${priceStats!.minPrice.toFixed(2)} RON`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] text-neutral-400">Avg</span>
          <span className="text-[11px] font-semibold text-amber-400 tabular-nums">
            {avg.toFixed(2)} RON
          </span>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <Clock className="h-3.5 w-3.5 text-sky-400 shrink-0" />
          <span className="text-[11px] text-neutral-400">Latest</span>
          <span className="text-[11px] font-semibold text-sky-400 tabular-nums">
            {validEntries[validEntries.length - 1].priceDisplay}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-48 -ml-2 pr-2 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="priceAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="85%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />

            <XAxis
              dataKey="chartDate"
              tick={{ fill: '#525252', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#262626' }}
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: '#525252', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v) => `${v}`}
              domain={[yMin, yMax]}
            />

            {/* Average price reference line */}
            <ReferenceLine
              y={avg}
              stroke="#f59e0b"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{ value: 'Avg', position: 'insideTopRight', fill: '#f59e0b', fontSize: 10 }}
            />

            <Tooltip
              contentStyle={{
                background: '#171717',
                border: '1px solid #404040',
                borderRadius: 10,
                fontSize: 12,
                color: '#fafafa',
              }}
              labelStyle={{ color: '#737373', fontSize: 11 }}
              formatter={((value: unknown, _name: unknown, props: { payload?: ChartPoint }) => {
                const p = props?.payload;
                const numVal = typeof value === 'number' ? value : Number(value);
                const lines: string[] = [p?.priceDisplay ?? `${numVal.toFixed(2)} RON`];
                if (p?.qty && p.qty > 0) lines.push(`\u00d7${p.qty} ${pluralize('unit', p.qty)}`);
                if (p?.store) lines.push(`${p.store}`);
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

            {/* Invisible line for the stroke gradient definition */}
            <defs>
              <linearGradient id="priceLineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
