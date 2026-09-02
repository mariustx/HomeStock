import { useRef, useState, lazy, Suspense } from 'react';
import { Package, ShoppingCart, BarChart3, Plus, AlertTriangle } from 'lucide-react';
import type { TabKey, InventoryItem, ShoppingItem, ProductInput, RestockInput, ShoppingItemInput } from './types';
import { useInventory, useShoppingItems } from './hooks';
import { InventoryView } from './InventoryView';
import { ShoppingView } from './ShoppingView';
import { AddItemModal } from './AddItemModal';
import { ShoppingItemModal } from './ShoppingItemModal';
import { MoreMenu } from './MoreMenu';

const InsightsView = lazy(() => import('./InsightsView').then(m => ({ default: m.InsightsView })));

const TABS: TabKey[] = ['inventory', 'shopping', 'insights'];

/** Count distinct consumable products whose total unopened stock across all restockable rows is zero. */
function outOfStockProductCount(items: InventoryItem[]): number {
  const totals = new Map<string, number>();
  for (const it of items) {
    if (it.restock_enabled === false || it.consumable === false) continue;
    totals.set(it.product, (totals.get(it.product) ?? 0) + it.count);
  }
  let count = 0;
  for (const total of totals.values()) {
    if (total === 0) count++;
  }
  return count;
}

export default function App() {
  const [tab, setTab] = useState<TabKey>('inventory');
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [showShoppingAdd, setShowShoppingAdd] = useState(false);
  const [editingShoppingItem, setEditingShoppingItem] = useState<ShoppingItem | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const {
    items,
    loading,
    error,
    reload,
    addItem,
    updateItem,
    adjustCount,
    restock,
    deleteItem,
  } = useInventory();
  const {
    items: shoppingItems,
    addShoppingItem,
    updateShoppingItem,
    toggleShoppingItemDone,
    deleteShoppingItem,
  } = useShoppingItems();

  const shoppingCount =
    outOfStockProductCount(items) + shoppingItems.filter((s) => !s.is_done).length;

  const closeProductModal = () => {
    setShowAdd(false);
    setEditingItem(null);
  };

  const openAddProduct = () => {
    setEditingItem(null);
    setShowAdd(true);
  };

  const openEditProduct = (item: InventoryItem) => {
    setShowAdd(false);
    setEditingItem(item);
  };

  const closeShoppingModal = () => {
    setShowShoppingAdd(false);
    setEditingShoppingItem(null);
  };

  const openAddShopping = () => {
    setEditingShoppingItem(null);
    setShowShoppingAdd(true);
  };

  const openEditShopping = (item: ShoppingItem) => {
    setShowShoppingAdd(false);
    setEditingShoppingItem(item);
  };

  const handleFab = () => {
    if (tab === 'shopping') openAddShopping();
    else openAddProduct();
  };

  const tabIndex = TABS.indexOf(tab);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && tabIndex < TABS.length - 1) setTab(TABS[tabIndex + 1]);
      else if (dx > 0 && tabIndex > 0) setTab(TABS[tabIndex - 1]);
    }
  };

  const handleSaveProduct = async (input: ProductInput) => {
    if (editingItem) {
      await updateItem(editingItem.id, input);
    } else {
      await addItem(input);
    }
    closeProductModal();
  };

  const handleSaveShopping = async (input: ShoppingItemInput) => {
    if (editingShoppingItem) {
      await updateShoppingItem(editingShoppingItem.id, input);
    } else {
      await addShoppingItem(input);
    }
    closeShoppingModal();
  };

  const handleRestock = async (id: string, input: RestockInput) => {
    await restock(id, input);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col max-w-md mx-auto relative">
      {/* Top app bar */}
      <header className="sticky top-0 z-30 bg-neutral-950/80 backdrop-blur-lg border-b border-neutral-900">
        <div className="px-4 h-14 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white leading-none">{TITLES[tab].title}</h1>
            <p className="text-[11px] text-neutral-500 mt-0.5">{TITLES[tab].sub}</p>
          </div>
          <div className="flex items-center gap-1">
            {error && (
              <button
                onClick={reload}
                className="h-9 px-2.5 flex items-center gap-1.5 text-amber-400 bg-amber-950/40 rounded-lg text-xs font-medium active:scale-95 transition"
              >
                <AlertTriangle className="h-4 w-4" />
                Retry
              </button>
            )}
            <MoreMenu />
          </div>
        </div>

        {/* Top tab bar */}
        <nav className="px-4 pb-2">
          <div className="grid grid-cols-3 gap-1 bg-neutral-900/80 rounded-xl p-1 border border-neutral-800">
            <TabPill
              active={tab === 'inventory'}
              onClick={() => setTab('inventory')}
              icon={<Package className="h-4 w-4" />}
              label="Inventory"
            />
            <TabPill
              active={tab === 'shopping'}
              onClick={() => setTab('shopping')}
              icon={<ShoppingCart className="h-4 w-4" />}
              label="Shopping"
              badge={shoppingCount}
            />
            <TabPill
              active={tab === 'insights'}
              onClick={() => setTab('insights')}
              icon={<BarChart3 className="h-4 w-4" />}
              label="Insights"
            />
          </div>
        </nav>
      </header>

      {/* Swipeable content */}
      <main className="flex-1 pt-3" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {tab === 'inventory' && (
          <InventoryView
            items={items}
            loading={loading}
            error={error}
            onAdjust={adjustCount}
            onDelete={deleteItem}
            onEdit={openEditProduct}
            onAdd={openAddProduct}
          />
        )}
        {tab === 'shopping' && (
          <ShoppingView
            inventoryItems={items}
            shoppingItems={shoppingItems}
            onRestock={handleRestock}
            onEditInventory={openEditProduct}
            onAddShoppingItem={openAddShopping}
            onEditShoppingItem={openEditShopping}
            onToggleShoppingItemDone={toggleShoppingItemDone}
            onDeleteShoppingItem={deleteShoppingItem}
          />
        )}
        {tab === 'insights' && (
          <Suspense fallback={
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500 mb-2"></div>
              <span>Loading insights...</span>
            </div>
          }>
            <InsightsView items={items} />
          </Suspense>
        )}
      </main>

      {/* Floating action button — hidden on Insights to avoid covering the chart */}
      {tab !== 'insights' && (
        <button
          onClick={handleFab}
          className="fixed bottom-6 right-4 sm:right-[calc(50%-13rem)] z-40 h-14 w-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white grid place-items-center shadow-lg shadow-emerald-900/40 active:scale-90 transition"
          aria-label={tab === 'shopping' ? 'Add shopping item' : 'Add product'}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <AddItemModal
        open={showAdd || !!editingItem}
        itemToEdit={editingItem}
        existingItems={items}
        onClose={closeProductModal}
        onSave={handleSaveProduct}
      />

      <ShoppingItemModal
        open={showShoppingAdd || !!editingShoppingItem}
        itemToEdit={editingShoppingItem}
        onClose={closeShoppingModal}
        onSave={handleSaveShopping}
      />
    </div>
  );
}

const TITLES: Record<TabKey, { title: string; sub: string }> = {
  inventory: { title: 'Inventory', sub: 'Everything in your storage' },
  shopping: { title: 'Shopping List', sub: 'Things you need to buy' },
  insights: { title: 'Insights', sub: 'Price trends over time' },
};

function TabPill({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-medium transition ${
        active ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-black text-[10px] font-bold grid place-items-center">
          {badge}
        </span>
      )}
    </button>
  );
}
