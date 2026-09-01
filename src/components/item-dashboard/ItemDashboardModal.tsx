import { useEffect, useMemo, useState } from 'react';
import type { InventoryItem, RestockInput } from '../../types';
import { useRestockHistory, useConsumptionHistory } from '../../hooks';
import { ItemDashboardHeader } from './ItemDashboardHeader';
import { ItemHeroMetrics, derivePriceStats } from './ItemHeroMetrics';
import { ItemStockActions } from './ItemStockActions';
import { ItemPriceTrendChart } from './ItemPriceTrendChart';
import { ItemOverviewTab } from './ItemOverviewTab';
import { ItemHistoryTab } from './ItemHistoryTab';
import { RestockModal } from '../../RestockModal';

type TabKey = 'overview' | 'price' | 'history';

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
    { key: 'price', label: 'Price' },
    { key: 'history', label: 'History' },
  ];

  return (
    <>
      {/* Backdrop (visible on desktop) */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
        onClick={onClose}
      />

      {/* Screen / Sheet Container */}
      <div
        className="fixed inset-0 z-50 flex sm:items-center sm:justify-center pointer-events-none"
        onClick={onClose}
      >
        <div
          className="w-full h-full sm:h-[90vh] sm:max-w-lg bg-neutral-950 sm:border sm:border-neutral-800/80 sm:rounded-3xl sm:shadow-2xl flex flex-col overflow-hidden animate-[slideUp_200ms_ease-out] pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <ItemDashboardHeader item={item} onEdit={onEdit} onClose={onClose} />

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {/* Stock management section */}
            <div className="pt-3">
              <ItemStockActions
                item={item}
                busy={busy}
                onAdjust={handleAdjust}
                onRestock={() => setShowRestock(true)}
                onToggleShoppingList={handleToggleShoppingList}
              />
            </div>

            {/* Hero metrics 2x2 grid */}
            <ItemHeroMetrics
              item={item}
              priceStats={priceStats}
              consumptionStats={isConsumable ? consumptionStats : null}
            />

            {/* Product-level tabs */}
            <div className="px-4 pt-1 pb-3">
              <div className="grid grid-cols-3 gap-1 bg-neutral-900/90 rounded-2xl p-1 border border-neutral-800">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`h-8 rounded-xl text-xs font-semibold transition ${
                      tab === t.key
                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950/60'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
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
              {tab === 'price' && (
                <div>
                  {histLoading ? (
                    <div className="mx-4 h-40 rounded-2xl border border-neutral-800 bg-neutral-900/60 flex items-center justify-center">
                      <div className="h-6 w-6 border-2 border-neutral-700 border-t-emerald-400 rounded-full animate-spin" />
                    </div>
                  ) : (
                    <ItemPriceTrendChart history={history} item={item} />
                  )}
                </div>
              )}
              {tab === 'history' && (
                <ItemHistoryTab
                  item={item}
                  inventoryId={item.id}
                  history={history}
                  isConsumable={isConsumable}
                  consumptionStats={consumptionStats}
                />
              )}
            </div>

            {/* Bottom spacer for mobile safe area */}
            <div className="h-[env(safe-area-inset-bottom,1.5rem)]" />
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

