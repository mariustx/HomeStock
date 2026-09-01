import { useEffect, useMemo, useState } from 'react';
import type { InventoryItem, RestockInput } from '../../types';
import { useRestockHistory, useConsumptionHistory } from '../../hooks';
import { useInventory } from '../../hooks';
import { ItemDashboardHeader } from './ItemDashboardHeader';
import { ItemHeroMetrics, derivePriceStats } from './ItemHeroMetrics';
import { ItemStockActions } from './ItemStockActions';
import { ItemPriceTrendChart } from './ItemPriceTrendChart';
import { ItemOverviewTab } from './ItemOverviewTab';
import { ItemHistoryTab } from './ItemHistoryTab';
import { RestockModal } from '../../RestockModal';

type TabKey = 'overview' | 'trend' | 'history';

interface ItemDashboardModalProps {
  item: InventoryItem;
  onClose: () => void;
  onEdit: () => void;
  /** Called after stock adjustments so the parent can sync its state. */
  onAdjust: (id: string, delta: number) => Promise<void>;
  onRestock: (id: string, input: RestockInput) => Promise<void>;
  onToggleShoppingList: (id: string) => Promise<void>;
}

export function ItemDashboardModal({
  item,
  onClose,
  onEdit,
  onAdjust,
  onRestock,
  onToggleShoppingList,
}: ItemDashboardModalProps) {
  const [tab, setTab] = useState<TabKey>('overview');
  const [showRestock, setShowRestock] = useState(false);
  const [busy, setBusy] = useState(false);

  const { history, loading: histLoading } = useRestockHistory(item.id);
  const { stats: consumptionStats } = useConsumptionHistory(item.id);

  const priceStats = useMemo(() => derivePriceStats(history), [history]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const ph = html.style.overflow;
    const pb = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = ph;
      body.style.overflow = pb;
    };
  }, []);

  const handleAdjust = async (delta: number) => {
    setBusy(true);
    try {
      await onAdjust(item.id, delta);
    } finally {
      setBusy(false);
    }
  };

  const handleRestock = async (input: RestockInput) => {
    await onRestock(item.id, input);
    setShowRestock(false);
  };

  const handleToggleShoppingList = async () => {
    await onToggleShoppingList(item.id);
  };

  const isConsumable = item.consumable !== false;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'trend', label: 'Price trend' },
    { key: 'history', label: 'History' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-[fadeIn_120ms_ease-out]"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex justify-center sm:inset-0 sm:items-end sm:p-4 pointer-events-none"
        onClick={onClose}
      >
        <div
          className="w-full sm:max-w-md flex flex-col h-[92dvh] sm:h-auto sm:max-h-[88dvh] bg-neutral-950 border border-neutral-800/80 sm:rounded-3xl shadow-2xl overflow-hidden animate-[slideUp_200ms_ease-out] pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <ItemDashboardHeader item={item} onEdit={onEdit} onClose={onClose} />

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {/* Stock actions */}
            <div className="pt-3">
              <ItemStockActions
                item={item}
                busy={busy}
                onAdjust={handleAdjust}
                onRestock={() => setShowRestock(true)}
                onToggleShoppingList={handleToggleShoppingList}
              />
            </div>

            {/* Hero metrics */}
            <ItemHeroMetrics
              item={item}
              priceStats={priceStats}
              consumptionStats={isConsumable ? consumptionStats : null}
            />

            {/* Tab nav */}
            <div className="px-4 pb-1">
              <div className="grid grid-cols-3 gap-1 bg-neutral-900 rounded-xl p-1 border border-neutral-800">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`h-8 rounded-lg text-xs font-medium transition ${
                      tab === t.key
                        ? 'bg-emerald-600 text-white'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="animate-[fadeIn_150ms_ease-out]" key={tab}>
              {tab === 'overview' && (
                <ItemOverviewTab
                  item={item}
                  consumptionStats={isConsumable ? consumptionStats : null}
                />
              )}
              {tab === 'trend' && (
                <div className="py-3">
                  {histLoading ? (
                    <div className="mx-4 h-40 rounded-2xl border border-neutral-800 bg-neutral-900/60 flex items-center justify-center">
                      <div className="h-6 w-6 border-2 border-neutral-700 border-t-emerald-400 rounded-full animate-spin" />
                    </div>
                  ) : (
                    <ItemPriceTrendChart history={history} />
                  )}
                </div>
              )}
              {tab === 'history' && (
                <ItemHistoryTab
                  inventoryId={item.id}
                  history={history}
                  isConsumable={isConsumable}
                  consumptionStats={consumptionStats}
                />
              )}
            </div>

            {/* Bottom spacer for safe area */}
            <div className="h-[env(safe-area-inset-bottom,1rem)]" />
          </div>
        </div>
      </div>

      {/* Restock modal layered on top */}
      {showRestock && (
        <RestockModal
          item={item}
          onClose={() => setShowRestock(false)}
          onConfirm={handleRestock}
        />
      )}
    </>
  );
}
