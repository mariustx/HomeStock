import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Dot } from 'recharts';
import {
  TrendingUp,
  LineChart as LineIcon,
  Search,
  X,
  ArrowDown,
  Clock,
  Calendar,
  Check,
  Package,
} from 'lucide-react';
import { pluralize, formatPriceWithBasis, type PriceBasis, type InventoryItem } from './types';
import { useRestockHistory } from './hooks';

interface InsightsViewProps {
  items: InventoryItem[];
}

interface ChartPoint {
  id: string;
  date: string;
  chartDate: string;
  dateFormatted: string;
  ts: number;
  price: number;
  qty: number;
  store: string | null;
  notes: string | null;
  /** Formatted price display, e.g. "3.99 RON/kg" or "3.50 RON" */
  priceDisplay: string;
  /** The price_basis for this specific entry, or null if none recorded */
  priceBasis: PriceBasis | null;
  isLowest: boolean;
  isLatest: boolean;
}

export function InsightsView({ items }: InsightsViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  // Filter items matching product name or brand (case-insensitive)
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const matchingItems = useMemo(() => {
    if (!trimmedQuery) return items;
    return items.filter((it) => {
      const productMatch = it.product.toLowerCase().includes(trimmedQuery);
      const brandMatch = it.brand ? it.brand.toLowerCase().includes(trimmedQuery) : false;
      return productMatch || brandMatch;
    });
  }, [items, trimmedQuery]);

  // Determine the active item: either by selectedId or fallback to first matching/available item
  const selectedItem = useMemo(() => {
    if (selectedId) {
      const found = items.find((it) => it.id === selectedId);
      if (found) return found;
    }
    return matchingItems[0] || items[0] || null;
  }, [items, selectedId, matchingItems]);

  const effectiveId = selectedItem?.id || '';
  const { history, loading } = useRestockHistory(effectiveId || null);

  // Valid price points sorted chronologically (earliest to latest)
  const validEntries = useMemo(() => {
    return history
      .filter((h) => h.price !== null && !Number.isNaN(Number(h.price)) && Number(h.price) > 0)
      .map((h) => {
        const priceNum = Number(h.price);
        const basis = (h.price_basis as PriceBasis | undefined) ?? null;
        const d = new Date(h.restocked_at);
        return {
          id: h.id,
          date: h.restocked_at,
          chartDate: d.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: '2-digit',
          }),
          dateFormatted: d.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          ts: d.getTime(),
          price: priceNum,
          qty: h.quantity,
          store: h.store,
          notes: h.notes,
          priceDisplay: formatPriceWithBasis(priceNum, basis) || `${priceNum.toFixed(2)} RON`,
          priceBasis: basis,
        };
      })
      .sort((a, b) => a.ts - b.ts);
  }, [history]);

  // Price statistics: Lowest, Latest, Average, and Lowest Date
  const priceStats = useMemo(() => {
    if (validEntries.length === 0) return null;

    const prices = validEntries.map((e) => e.price);
    const minPrice = Math.min(...prices);
    const avgPrice = prices.reduce((s, p) => s + p, 0) / prices.length;

    // Latest entry is the last item in chronological order
    const latestEntry = validEntries[validEntries.length - 1];

    // Lowest entry (first chronological occurrence of lowest price)
    const lowestEntry = validEntries.find((e) => e.price === minPrice) || validEntries[0];

    return {
      lowestPrice: minPrice,
      lowestPriceDisplay: lowestEntry.priceDisplay,
      lowestDate: lowestEntry.dateFormatted,
      latestPrice: latestEntry.price,
      latestPriceDisplay: latestEntry.priceDisplay,
      avgPrice,
      avgPriceDisplay: `${avgPrice.toFixed(2)} RON`,
      count: validEntries.length,
    };
  }, [validEntries]);

  // Chronological history with lowest and latest flags
  const chronologicalHistory = useMemo<ChartPoint[]>(() => {
    if (validEntries.length === 0) return [];
    const minPrice = Math.min(...validEntries.map((e) => e.price));
    const latestId = validEntries[validEntries.length - 1]?.id;

    return validEntries.map((e) => ({
      ...e,
      isLowest: e.price === minPrice,
      isLatest: e.id === latestId,
    }));
  }, [validEntries]);

  const handleSelectItem = (id: string) => {
    setSelectedId(id);
    setIsDropdownOpen(false);
  };

  return (
    <div className="px-4 pb-6 space-y-4">
      {/* Searchable Item Selector */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3.5 shadow-sm space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Search & Select Item
        </label>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            placeholder="Search product or brand…"
            className="input pl-9 pr-9 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-6 w-6 grid place-items-center text-neutral-500 hover:text-white rounded-md transition"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Search Results / Matching Items List */}
        {items.length === 0 ? (
          <p className="text-xs text-neutral-500 py-1">No items in inventory yet.</p>
        ) : trimmedQuery ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
              <span>
                {matchingItems.length}{' '}
                {matchingItems.length === 1 ? 'matching item' : 'matching items'}
              </span>
            </div>
            {matchingItems.length === 0 ? (
              <div className="text-center py-6 bg-neutral-950/40 rounded-xl border border-neutral-800/80 px-4">
                <Package className="h-6 w-6 mx-auto mb-2 text-neutral-600" />
                <p className="text-sm text-neutral-400">
                  No items match &ldquo;{searchQuery}&rdquo;
                </p>
                <p className="text-xs text-neutral-600 mt-0.5">Try searching by product name or brand</p>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar">
                {matchingItems.map((it) => {
                  const isSelected = it.id === effectiveId;
                  return (
                    <button
                      key={it.id}
                      onClick={() => handleSelectItem(it.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                          : 'bg-neutral-800/50 hover:bg-neutral-800 border-neutral-700/60 text-neutral-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate flex items-center gap-1.5">
                          <span className={isSelected ? 'text-emerald-300 font-semibold' : 'text-white'}>
                            {it.product}
                          </span>
                          {it.brand && (
                            <span className="text-xs text-neutral-400 truncate">· {it.brand}</span>
                          )}
                        </div>
                        {(it.variant || it.specification) && (
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-neutral-400 truncate">
                            {it.variant && (
                              <span className="px-1.5 py-0.2 rounded bg-neutral-700/50 text-[11px] text-neutral-300">
                                {it.variant}
                              </span>
                            )}
                            {it.specification && (
                              <span className="px-1.5 py-0.2 rounded bg-neutral-700/50 text-[11px] text-neutral-300">
                                {it.specification}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* When no search query is active: Show current item & dropdown toggle */
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400">Selected Item:</span>
              {items.length > 1 && (
                <button
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  {isDropdownOpen ? 'Hide item list' : `Browse all (${items.length})`}
                </button>
              )}
            </div>

            {selectedItem && (
              <div className="p-3 bg-neutral-800/60 border border-neutral-700/70 rounded-xl flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-white truncate flex items-center gap-2">
                    <span>{selectedItem.product}</span>
                    {selectedItem.brand && (
                      <span className="text-xs text-neutral-400 font-normal">· {selectedItem.brand}</span>
                    )}
                  </div>
                  {(selectedItem.variant || selectedItem.specification) && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-neutral-400">
                      {selectedItem.variant && (
                        <span className="px-1.5 py-0.5 rounded bg-neutral-700/70 text-[11px] text-neutral-200">
                          {selectedItem.variant}
                        </span>
                      )}
                      {selectedItem.specification && (
                        <span className="px-1.5 py-0.5 rounded bg-neutral-700/70 text-[11px] text-neutral-200">
                          {selectedItem.specification}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                  Active
                </span>
              </div>
            )}

            {isDropdownOpen && items.length > 1 && (
              <div className="max-h-56 overflow-y-auto space-y-1.5 pt-1 border-t border-neutral-800">
                {items.map((it) => {
                  const isSelected = it.id === effectiveId;
                  return (
                    <button
                      key={it.id}
                      onClick={() => handleSelectItem(it.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                          : 'bg-neutral-800/40 hover:bg-neutral-800 border-neutral-700/40 text-neutral-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate flex items-center gap-1.5">
                          <span className={isSelected ? 'text-emerald-300 font-semibold' : 'text-white'}>
                            {it.product}
                          </span>
                          {it.brand && (
                            <span className="text-xs text-neutral-400 truncate">· {it.brand}</span>
                          )}
                        </div>
                        {(it.variant || it.specification) && (
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-neutral-400 truncate">
                            {it.variant && (
                              <span className="px-1.5 py-0.2 rounded bg-neutral-700/50 text-[11px] text-neutral-300">
                                {it.variant}
                              </span>
                            )}
                            {it.specification && (
                              <span className="px-1.5 py-0.2 rounded bg-neutral-700/50 text-[11px] text-neutral-300">
                                {it.specification}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {!selectedItem ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-500 px-6 text-center">
          <LineIcon className="h-12 w-12 mb-3 text-neutral-700" />
          <p className="text-neutral-300 font-medium">No item selected</p>
          <p className="text-sm mt-1">Select an item above to view its price statistics and history.</p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
          <div className="h-8 w-8 border-2 border-neutral-700 border-t-emerald-400 rounded-full animate-spin mb-3" />
          Loading price history…
        </div>
      ) : validEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-neutral-500 px-6 text-center bg-neutral-900/40 border border-neutral-800 rounded-2xl">
          <TrendingUp className="h-10 w-10 mb-3 text-neutral-700" />
          <p className="text-neutral-300 font-medium">No price history yet</p>
          <p className="text-sm mt-1 max-w-sm text-neutral-400">
            Record a restock or purchase price for{' '}
            <strong className="text-white">{selectedItem.product}</strong> to view price insights.
          </p>
        </div>
      ) : (
        <>
          {/* Price Statistics Summary Cards */}
          {priceStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <StatCard
                label="Lowest Price"
                value={priceStats.lowestPriceDisplay}
                icon={<ArrowDown className="h-4 w-4 text-emerald-400" />}
                tone="good"
              />
              <StatCard
                label="Lowest Date"
                value={priceStats.lowestDate}
                icon={<Calendar className="h-4 w-4 text-neutral-400" />}
                tone="neutral"
              />
              <StatCard
                label="Latest Price"
                value={priceStats.latestPriceDisplay}
                icon={<Clock className="h-4 w-4 text-sky-400" />}
                tone="sky"
              />
              <StatCard
                label="Average Price"
                value={priceStats.avgPriceDisplay}
                icon={<TrendingUp className="h-4 w-4 text-amber-400" />}
                tone="neutral"
              />
            </div>
          )}

          {/* Interactive Price Paid Over Time Chart */}
          <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 pt-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-medium text-neutral-300">Price Trend</h3>
              <span className="text-xs text-neutral-500">
                {priceStats?.count} {pluralize('entry', priceStats?.count ?? 0)}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mb-3">
              {selectedItem.product}
              {selectedItem.brand ? ` · ${selectedItem.brand}` : ''}
              {selectedItem.variant ? ` (${selectedItem.variant})` : ''}
              {selectedItem.specification ? ` · ${selectedItem.specification}` : ''}
            </p>
            <div className="h-60 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chronologicalHistory} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="priceLine" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="chartDate"
                    tick={{ fill: '#737373', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#262626' }}
                    minTickGap={20}
                  />
                  <YAxis
                    tick={{ fill: '#737373', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
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
                      if (p?.store) lines.push(`Store: ${p.store}`);
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
                    activeDot={{ r: 6, fill: '#34d399', stroke: '#0a0a0a', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chronological Price History List */}
          <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-neutral-300">Price History</h3>
              <span className="text-xs text-neutral-500">Chronological (earliest first)</span>
            </div>
            <ul className="divide-y divide-neutral-800">
              {chronologicalHistory.map((h) => {
                return (
                  <li
                    key={h.id}
                    className="py-3 flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-neutral-200 font-medium">
                          {h.dateFormatted}
                        </span>

                        {/* Lowest price badge */}
                        {h.isLowest && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <ArrowDown className="h-3 w-3" /> Lowest
                          </span>
                        )}

                        {/* Latest price badge */}
                        {h.isLatest && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                            <Clock className="h-3 w-3" /> Latest
                          </span>
                        )}
                      </div>

                      {(h.store || h.notes || h.qty > 0) && (
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
                          {h.qty > 0 && <span>Qty: ×{h.qty}</span>}
                          {h.store && <span>· {h.store}</span>}
                          {h.notes && <span>· {h.notes}</span>}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-white font-semibold tabular-nums text-sm">
                        {h.priceDisplay}
                      </span>
                    </div>
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

function StatCard({
  label,
  value,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: 'good' | 'bad' | 'sky' | 'neutral';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-400'
      : tone === 'bad'
        ? 'text-red-400'
        : tone === 'sky'
          ? 'text-sky-400'
          : 'text-white';

  return (
    <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3 flex flex-col justify-between">
      <div className="flex items-center justify-between text-neutral-500 mb-1">
        <span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span>
        {icon}
      </div>
      <div className={`text-sm sm:text-base font-bold tabular-nums truncate ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}
