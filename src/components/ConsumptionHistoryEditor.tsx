import { useState } from 'react';
import { Clock, Calendar, Trash2, Plus, ChevronDown, ChevronUp, History, Sparkles } from 'lucide-react';
import { useConsumptionHistory } from '../hooks';
import { formatConsumptionDuration } from '../lib/consumption';
import { timestamptzToDateInput, dateInputToTimestamptz, formatDateOnly } from '../types';

interface ConsumptionHistoryEditorProps {
  inventoryId: string;
}

export function ConsumptionHistoryEditor({ inventoryId }: ConsumptionHistoryEditorProps) {
  const { history, stats, loading, addOpeningEntry, updateOpeningEntry, deleteOpeningEntry } =
    useConsumptionHistory(inventoryId);

  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [showAddDate, setShowAddDate] = useState(false);
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().split('T')[0]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-neutral-800/40 border border-neutral-800 p-3.5 text-xs text-neutral-500 flex items-center gap-2">
        <span className="h-3 w-3 rounded-full border-2 border-neutral-600 border-t-emerald-400 animate-spin" />
        Loading consumption history…
      </div>
    );
  }

  const handleStartEdit = (id: string, openedAt: string) => {
    setEditingId(id);
    setEditDate(timestamptzToDateInput(openedAt));
  };

  const handleSaveEdit = async (id: string) => {
    if (!editDate) return;
    const iso = dateInputToTimestamptz(editDate);
    if (iso) {
      await updateOpeningEntry(id, iso);
    }
    setEditingId(null);
  };

  const handleAdd = async () => {
    if (!newDate) return;
    const iso = dateInputToTimestamptz(newDate);
    if (iso) {
      await addOpeningEntry(iso);
    }
    setShowAddDate(false);
  };

  const handleDelete = async (id: string) => {
    await deleteOpeningEntry(id);
  };

  return (
    <div className="rounded-2xl bg-neutral-800/40 border border-neutral-800 p-3.5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <History className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold text-neutral-200 uppercase tracking-wide">
            Consumption Statistics
          </span>
        </div>
        {stats.periodsCount > 0 && stats.averageDays !== null && (
          <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-0.5 rounded-full tabular-nums">
            Avg {formatConsumptionDuration(stats.averageDays)}
          </span>
        )}
      </div>

      {/* Summary Cards */}
      {stats.periodsCount >= 1 ? (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-xl p-2 text-center">
            <span className="block text-[10px] text-neutral-500 uppercase tracking-wider font-medium">
              Average
            </span>
            <span className="text-sm font-bold text-emerald-400 tabular-nums">
              {formatConsumptionDuration(stats.averageDays)}
            </span>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-xl p-2 text-center">
            <span className="block text-[10px] text-neutral-500 uppercase tracking-wider font-medium">
              Last period
            </span>
            <span className="text-sm font-bold text-sky-400 tabular-nums">
              {formatConsumptionDuration(stats.lastDays)}
            </span>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-xl p-2 text-center">
            <span className="block text-[10px] text-neutral-500 uppercase tracking-wider font-medium">
              Periods
            </span>
            <span className="text-sm font-bold text-neutral-200 tabular-nums">
              {stats.periodsCount} {stats.periodsCount === 1 ? 'period' : 'periods'}
            </span>
          </div>
        </div>
      ) : stats.openingsCount === 1 ? (
        <div className="rounded-xl bg-neutral-900/60 border border-neutral-800/80 p-2.5 flex items-start gap-2 text-xs text-neutral-400">
          <Sparkles className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            1 opening recorded ({formatDateOnly(history[0]?.opened_at)}). Average duration will appear after opening the next item.
          </span>
        </div>
      ) : (
        <p className="text-xs text-neutral-500">
          No opening events recorded yet. Opening an item by decreasing stock with &minus; will begin tracking.
        </p>
      )}

      {/* History log toggle */}
      {history.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between text-xs text-neutral-400 hover:text-white py-1 transition"
          >
            <span>
              {expanded ? 'Hide' : 'View & edit'} opening history ({history.length}{' '}
              {history.length === 1 ? 'opening' : 'openings'})
            </span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {expanded && (
            <div className="mt-2 space-y-2 pt-2 border-t border-neutral-800/80">
              <ul className="divide-y divide-neutral-800/70 text-xs">
                {history.map((entry, idx) => {
                  const isLast = idx === history.length - 1;
                  const period = stats.periods[idx]; // duration to next opening

                  return (
                    <li key={entry.id} className="py-2 flex items-center justify-between gap-2">
                      {editingId === entry.id ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="input text-xs py-1 px-2 h-7"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(entry.id)}
                            className="h-7 px-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 font-medium text-xs"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="h-7 px-2 bg-neutral-800 text-neutral-400 rounded-lg hover:text-white text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <Calendar className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                            <span className="font-medium text-neutral-200">
                              {formatDateOnly(entry.opened_at)}
                            </span>
                            {isLast && (
                              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded">
                                Current
                              </span>
                            )}
                            {period && (
                              <span className="text-[11px] text-neutral-500 flex items-center gap-0.5">
                                <Clock className="h-3 w-3 text-neutral-600" />
                                lasted {formatConsumptionDuration(period.days)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(entry.id, entry.opened_at)}
                              className="h-6 px-1.5 text-neutral-400 hover:text-white rounded transition text-[11px]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(entry.id)}
                              className="h-6 w-6 grid place-items-center text-neutral-500 hover:text-red-400 rounded transition"
                              title="Delete opening record"
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
              {showAddDate ? (
                <div className="pt-2 flex items-center gap-1.5 border-t border-neutral-800">
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="input text-xs py-1 px-2 h-7 flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAdd}
                    className="h-7 px-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 font-medium text-xs"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddDate(false)}
                    className="h-7 px-2 bg-neutral-800 text-neutral-400 rounded-lg hover:text-white text-xs"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddDate(true)}
                  className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  <Plus className="h-3 w-3" /> Add past opening date
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
