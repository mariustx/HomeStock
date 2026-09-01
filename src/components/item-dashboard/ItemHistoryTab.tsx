import { useState, useMemo } from 'react';
import {
  PackagePlus, Calendar, Trash2, Plus, Edit2, Check,
  Clock, Store, Tag, Sparkles
} from 'lucide-react';
import type {
  RestockEntry, ConsumptionEntry, ConsumptionStats,
  PriceBasis, InventoryItem
} from '../../types';
import {
  formatPriceWithBasis, formatDateOnly, pluralize,
  timestamptzToDateInput, dateInputToTimestamptz
} from '../../types';
import { formatConsumptionDuration } from '../../lib/consumption';
import { useConsumptionHistory } from '../../hooks';

interface ItemHistoryTabProps {
  item?: InventoryItem;
  inventoryId: string;
  history: RestockEntry[];
  isConsumable: boolean;
  consumptionStats: ConsumptionStats | null;
}

type TimelineEvent =
  | {
      id: string;
      type: 'restock';
      timestamp: number;
      dateFormatted: string;
      quantity: number;
      priceDisplay: string | null;
      store: string | null;
      notes: string | null;
    }
  | {
      id: string;
      type: 'opening';
      timestamp: number;
      dateFormatted: string;
      rawEntry: ConsumptionEntry;
      isCurrent: boolean;
      periodDays: number | null;
    }
  | {
      id: string;
      type: 'created';
      timestamp: number;
      dateFormatted: string;
    };

export function ItemHistoryTab({
  item,
  inventoryId,
  history,
  isConsumable,
  consumptionStats,
}: ItemHistoryTabProps) {
  const {
    history: openings,
    addOpeningEntry,
    updateOpeningEntry,
    deleteOpeningEntry,
  } = useConsumptionHistory(inventoryId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [showAddDate, setShowAddDate] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

  // Build merged chronological timeline
  const timeline = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [];

    // 1. Restock events
    history.forEach((h) => {
      const d = new Date(h.restocked_at);
      const ts = d.getTime();
      if (!Number.isNaN(ts)) {
        const priceNum = h.price !== null && !Number.isNaN(Number(h.price)) && Number(h.price) > 0
          ? Number(h.price)
          : null;
        const basis = (h.price_basis as PriceBasis | undefined) ?? null;
        const priceDisplay = priceNum !== null
          ? formatPriceWithBasis(priceNum, basis) || `${priceNum.toFixed(2)} RON`
          : null;

        events.push({
          id: `restock-${h.id}`,
          type: 'restock',
          timestamp: ts,
          dateFormatted: d.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          quantity: h.quantity,
          priceDisplay,
          store: h.store,
          notes: h.notes,
        });
      }
    });

    // 2. Opening events
    if (isConsumable && openings.length > 0) {
      const sortedOpenings = [...openings].sort(
        (a, b) => new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime()
      );

      sortedOpenings.forEach((entry, idx) => {
        const d = new Date(entry.opened_at);
        const ts = d.getTime();
        if (!Number.isNaN(ts)) {
          const isCurrent = idx === sortedOpenings.length - 1;
          const period = consumptionStats?.periods?.[idx];

          events.push({
            id: entry.id,
            type: 'opening',
            timestamp: ts,
            dateFormatted: formatDateOnly(entry.opened_at) || d.toLocaleDateString(),
            rawEntry: entry,
            isCurrent,
            periodDays: period?.days ?? null,
          });
        }
      });
    }

    // 3. Product creation event
    if (item?.created_at) {
      const d = new Date(item.created_at);
      const ts = d.getTime();
      if (!Number.isNaN(ts)) {
        events.push({
          id: `created-${item.id}`,
          type: 'created',
          timestamp: ts,
          dateFormatted: d.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
        });
      }
    }

    // Sort newest first
    return events.sort((a, b) => b.timestamp - a.timestamp);
  }, [history, openings, isConsumable, consumptionStats, item]);

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

  const unit = item?.unit || 'unit';

  return (
    <div className="px-4 pb-6 space-y-4">
      {/* Action Header for History */}
      <div className="flex items-center justify-between pt-2">
        <h3 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
          Event Timeline ({timeline.length})
        </h3>

        {isConsumable && (
          <div>
            {!showAddDate ? (
              <button
                onClick={() => setShowAddDate(true)}
                className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition py-1 px-2 rounded-lg hover:bg-neutral-900 border border-emerald-500/20"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Log opening</span>
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* Add Past Opening Form */}
      {showAddDate && (
        <div className="rounded-2xl border border-emerald-800/60 bg-emerald-950/20 p-3.5 space-y-2.5">
          <div className="text-xs font-semibold text-emerald-300">
            Log Past Opening Date
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="input text-xs py-1.5 px-2.5 h-9 flex-1 bg-neutral-900 border-neutral-700 text-white rounded-xl"
            />
            <button
              onClick={handleAdd}
              className="h-9 px-3.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 font-semibold text-xs transition"
            >
              Add
            </button>
            <button
              onClick={() => setShowAddDate(false)}
              className="h-9 px-3 bg-neutral-800 text-neutral-300 rounded-xl hover:text-white text-xs transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Timeline List */}
      {timeline.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 text-center space-y-2">
          <Clock className="h-7 w-7 text-neutral-600 mx-auto" />
          <p className="text-sm font-medium text-neutral-300">No event history yet</p>
          <p className="text-xs text-neutral-400 max-w-xs mx-auto">
            Restock items or adjust stock to automatically record timeline events.
          </p>
        </div>
      ) : (
        <div className="relative pl-5 border-l-2 border-neutral-800 space-y-4 ml-3 my-2">
          {timeline.map((event) => {
            if (event.type === 'restock') {
              return (
                <div key={event.id} className="relative group">
                  {/* Timeline Dot */}
                  <span className="absolute -left-[27px] top-1.5 h-5 w-5 rounded-full bg-emerald-950 border-2 border-emerald-500 flex items-center justify-center text-emerald-400">
                    <PackagePlus className="h-2.5 w-2.5" />
                  </span>

                  {/* Card Content */}
                  <div className="rounded-2xl border border-neutral-800/90 bg-neutral-900/70 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                          Restocked
                        </span>
                        {event.quantity > 0 && (
                          <span className="text-xs font-semibold text-white bg-neutral-800 px-2 py-0.5 rounded-md">
                            +{event.quantity} {pluralize(unit, event.quantity)}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-neutral-400 font-medium">
                        {event.dateFormatted}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5 text-xs">
                      <div className="flex items-center gap-2 text-neutral-400 flex-wrap">
                        {event.store && (
                          <span className="flex items-center gap-1">
                            <Store className="h-3 w-3 text-neutral-400" />
                            {event.store}
                          </span>
                        )}
                        {event.notes && (
                          <span className="italic text-neutral-400 truncate max-w-[160px]">
                            "{event.notes}"
                          </span>
                        )}
                      </div>

                      {event.priceDisplay && (
                        <span className="font-bold text-white tabular-nums">
                          {event.priceDisplay}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            if (event.type === 'opening') {
              const isEditing = editingId === event.id;

              return (
                <div key={event.id} className="relative group">
                  {/* Timeline Dot */}
                  <span className="absolute -left-[27px] top-1.5 h-5 w-5 rounded-full bg-sky-950 border-2 border-sky-500 flex items-center justify-center text-sky-400">
                    <Calendar className="h-2.5 w-2.5" />
                  </span>

                  {/* Card Content */}
                  <div className="rounded-2xl border border-neutral-800/90 bg-neutral-900/70 p-3.5 space-y-1.5">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="input text-xs py-1 px-2.5 h-8 flex-1 bg-neutral-950 border-neutral-700 text-white rounded-lg"
                        />
                        <button
                          onClick={() => handleSaveEdit(event.id)}
                          className="h-8 px-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 font-semibold text-xs"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="h-8 px-2.5 bg-neutral-800 text-neutral-400 rounded-lg hover:text-white text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-sky-400 uppercase tracking-wide">
                              Package Opened
                            </span>
                            {event.isCurrent && (
                              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-700/60 px-1.5 py-0.5 rounded uppercase">
                                Current
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-neutral-400 font-medium">
                            {event.dateFormatted}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-0.5 text-xs text-neutral-400">
                          <div>
                            {event.periodDays !== null ? (
                              <span>Lasted {formatConsumptionDuration(event.periodDays)}</span>
                            ) : (
                              <span>Open event recorded</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleStartEdit(event.id, event.rawEntry.opened_at)}
                              className="px-2 py-0.5 text-neutral-400 hover:text-white rounded text-xs transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteOpeningEntry(event.id)}
                              className="p-1 text-neutral-500 hover:text-red-400 rounded transition"
                              aria-label="Delete opening event"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            }

            if (event.type === 'created') {
              return (
                <div key={event.id} className="relative group">
                  {/* Timeline Dot */}
                  <span className="absolute -left-[27px] top-1.5 h-5 w-5 rounded-full bg-neutral-900 border-2 border-neutral-600 flex items-center justify-center text-neutral-400">
                    <Sparkles className="h-2.5 w-2.5" />
                  </span>

                  {/* Card Content */}
                  <div className="rounded-2xl border border-neutral-800/60 bg-neutral-900/40 p-3 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold text-neutral-300">
                        Added to HomeStock
                      </span>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Product record created
                      </p>
                    </div>
                    <span className="text-xs text-neutral-400 font-medium">
                      {event.dateFormatted}
                    </span>
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      )}
    </div>
  );
}

