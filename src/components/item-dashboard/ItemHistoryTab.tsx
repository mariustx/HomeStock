import { useState } from 'react';
import { ArrowDown, Clock, ShoppingBag, Calendar, Trash2, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import type { RestockEntry, ConsumptionEntry, ConsumptionStats, PriceBasis } from '../../types';
import { formatPriceWithBasis, formatDateOnly } from '../../types';
import { formatConsumptionDuration } from '../../lib/consumption';
import { useConsumptionHistory } from '../../hooks';
import { timestamptzToDateInput, dateInputToTimestamptz } from '../../types';

interface ItemHistoryTabProps {
  inventoryId: string;
  history: RestockEntry[];
  isConsumable: boolean;
  consumptionStats: ConsumptionStats;
}

export function ItemHistoryTab({ inventoryId, history, isConsumable, consumptionStats }: ItemHistoryTabProps) {
  const { history: openings, addOpeningEntry, updateOpeningEntry, deleteOpeningEntry } =
    useConsumptionHistory(inventoryId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [showAddDate, setShowAddDate] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [openingsExpanded, setOpeningsExpanded] = useState(false);

  // Valid price entries sorted newest first for display
  const priceEntries = history
    .filter((h) => h.price !== null && !Number.isNaN(Number(h.price)) && Number(h.price) > 0)
    .map((h) => {
      const priceNum = Number(h.price);
      const basis = (h.price_basis as PriceBasis | undefined) ?? null;
      const d = new Date(h.restocked_at);
      return {
        ...h,
        priceNum,
        priceDisplay: formatPriceWithBasis(priceNum, basis) || `${priceNum.toFixed(2)} RON`,
        dateFormatted: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
        ts: d.getTime(),
      };
    })
    .sort((a, b) => b.ts - a.ts); // newest first

  const minPrice = priceEntries.length > 0 ? Math.min(...priceEntries.map((e) => e.priceNum)) : null;
  const latestId = priceEntries.length > 0 ? priceEntries[0].id : null;

  const handleStartEdit = (id: string, openedAt: string) => {
    setEditingId(id);
    setEditDate(timestamptzToDateInput(openedAt));
  };

  const handleSaveEdit = async (id: string) => {
    if (!editDate) return;
    const iso = dateInputToTimestamptz(editDate);
    if (iso) await updateOpeningEntry(id, iso);
    setEditingId(null);
  };

  const handleAdd = async () => {
    if (!newDate) return;
    const iso = dateInputToTimestamptz(newDate);
    if (iso) await addOpeningEntry(iso);
    setShowAddDate(false);
  };

  return (
    <div className="px-4 pb-4 space-y-4">

      {/* Price / Restock History */}
      <div>
        <h4 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider pt-3 pb-2">
          Price & restock history
        </h4>
        {priceEntries.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 text-center">
            <ShoppingBag className="h-7 w-7 text-neutral-700 mx-auto mb-1.5" />
            <p className="text-sm text-neutral-500">No price records yet</p>
            <p className="text-xs text-neutral-600 mt-0.5">Add a restock or record a price in Edit.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 overflow-hidden">
            <ul className="divide-y divide-neutral-800">
              {priceEntries.map((h) => {
                const isLowest = minPrice !== null && h.priceNum === minPrice;
                const isLatest = h.id === latestId;
                return (
                  <li key={h.id} className="px-3.5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-neutral-200">{h.dateFormatted}</span>
                        {isLowest && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <ArrowDown className="h-2.5 w-2.5" /> Lowest
                          </span>
                        )}
                        {isLatest && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                            <Clock className="h-2.5 w-2.5" /> Latest
                          </span>
                        )}
                      </div>
                      {(h.store || h.notes || (h.quantity && h.quantity > 0)) && (
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500 flex-wrap">
                          {h.quantity > 0 && <span>×{h.quantity}</span>}
                          {h.store && <span>{h.store}</span>}
                          {h.notes && <span className="italic truncate max-w-[120px]">{h.notes}</span>}
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-bold text-white tabular-nums shrink-0">{h.priceDisplay}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Consumption / Opening History — consumables only */}
      {isConsumable && (
        <div>
          <h4 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider pb-2">
            Opening history
          </h4>

          {openings.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 text-center">
              <Calendar className="h-7 w-7 text-neutral-700 mx-auto mb-1.5" />
              <p className="text-sm text-neutral-500">No openings recorded</p>
              <p className="text-xs text-neutral-600 mt-0.5">Use − on the stock to record when you open an item.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 overflow-hidden">
              {/* Collapsed header */}
              <button
                onClick={() => setOpeningsExpanded(!openingsExpanded)}
                className="w-full px-3.5 py-3 flex items-center justify-between text-sm hover:bg-neutral-800/40 transition"
              >
                <span className="flex items-center gap-2 text-neutral-300 font-medium">
                  <Calendar className="h-4 w-4 text-neutral-500" />
                  {openings.length} {openings.length === 1 ? 'opening' : 'openings'}
                  {consumptionStats.averageDays !== null && (
                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                      Avg {formatConsumptionDuration(consumptionStats.averageDays)}
                    </span>
                  )}
                </span>
                {openingsExpanded
                  ? <ChevronUp className="h-4 w-4 text-neutral-500" />
                  : <ChevronDown className="h-4 w-4 text-neutral-500" />
                }
              </button>

              {openingsExpanded && (
                <div className="border-t border-neutral-800/70">
                  <ul className="divide-y divide-neutral-800/60">
                    {[...openings].reverse().map((entry: ConsumptionEntry, idx: number) => {
                      const reversedIdx = openings.length - 1 - idx;
                      const period = consumptionStats.periods[reversedIdx];

                      return (
                        <li key={entry.id} className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                          {editingId === entry.id ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <input
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="input text-xs py-1 px-2 h-8 flex-1"
                              />
                              <button
                                onClick={() => handleSaveEdit(entry.id)}
                                className="h-8 px-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 font-medium text-xs"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="h-8 px-2 bg-neutral-800 text-neutral-400 rounded-lg hover:text-white text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Calendar className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                                <span className="text-sm text-neutral-200">{formatDateOnly(entry.opened_at)}</span>
                                {idx === 0 && (
                                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 rounded uppercase">
                                    Current
                                  </span>
                                )}
                                {period && (
                                  <span className="text-xs text-neutral-500">lasted {formatConsumptionDuration(period.days)}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => handleStartEdit(entry.id, entry.opened_at)}
                                  className="h-7 px-2 text-neutral-500 hover:text-white rounded-lg text-xs transition"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteOpeningEntry(entry.id)}
                                  className="h-7 w-7 grid place-items-center text-neutral-600 hover:text-red-400 rounded-lg transition"
                                  aria-label="Delete opening"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {/* Add historical date */}
                  <div className="px-3.5 py-2.5 border-t border-neutral-800/60">
                    {showAddDate ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          value={newDate}
                          onChange={(e) => setNewDate(e.target.value)}
                          className="input text-xs py-1 px-2 h-8 flex-1"
                        />
                        <button
                          onClick={handleAdd}
                          className="h-8 px-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 font-medium text-xs"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setShowAddDate(false)}
                          className="h-8 px-2 bg-neutral-800 text-neutral-400 rounded-lg hover:text-white text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAddDate(true)}
                        className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add past opening date
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
