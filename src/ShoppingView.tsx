import { useMemo, useState } from 'react';
import { Plus, ShoppingBag, Trash2, Check, Edit3, Package, Layers } from 'lucide-react';
import { pluralize, TRACKING_MODE_SHORT, type InventoryItem, type RestockInput, type ShoppingItem } from './types';
import { SearchBar } from './InventoryView';
import { RestockModal } from './RestockModal';

interface ShoppingViewProps {
  inventoryItems: InventoryItem[];
  shoppingItems: ShoppingItem[];
  onRestock: (id: string, input: RestockInput) => Promise<void>;
  onEditInventory: (item: InventoryItem) => void;
  onAddShoppingItem: () => void;
  onEditShoppingItem: (item: ShoppingItem) => void;
  onToggleShoppingItemDone: (id: string, value: boolean) => Promise<void>;
  onDeleteShoppingItem: (id: string) => Promise<void>;
}

interface ProductGroup {
  product: string;
  items: InventoryItem[];
  totalStock: number;
}

function groupByProduct(items: InventoryItem[]): ProductGroup[] {
  const map = new Map<string, InventoryItem[]>();
  for (const it of items) {
    const arr = map.get(it.product);
    if (arr) arr.push(it);
    else map.set(it.product, [it]);
  }
  const groups: ProductGroup[] = [];
  for (const [product, groupItems] of map) {
    const totalStock = groupItems.reduce((sum, it) => sum + it.count, 0);
    groups.push({ product, items: groupItems, totalStock });
  }
  groups.sort((a, b) => a.product.localeCompare(b.product));
  return groups;
}

function groupMatches(group: ProductGroup, q: string): boolean {
  if (group.product.toLowerCase().includes(q)) return true;
  return group.items.some(
    (it) =>
      (it.brand ?? '').toLowerCase().includes(q) ||
      (it.variant ?? '').toLowerCase().includes(q),
  );
}

export function ShoppingView({
  inventoryItems,
  shoppingItems,
  onRestock,
  onEditInventory,
  onAddShoppingItem,
  onEditShoppingItem,
  onToggleShoppingItemDone,
  onDeleteShoppingItem,
}: ShoppingViewProps) {
  const [restockTarget, setRestockTarget] = useState<InventoryItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [confirmDeleteShopping, setConfirmDeleteShopping] = useState<ShoppingItem | null>(null);

  const q = query.trim().toLowerCase();

  // Product-level auto shopping list: a product appears only when total stock = 0.
  const outOfStockProducts = useMemo<ProductGroup[]>(() => {
    const all = groupByProduct(inventoryItems);
    return all
      .filter((g) => g.totalStock === 0)
      .filter((g) => (q ? groupMatches(g, q) : true));
  }, [inventoryItems, q]);

  // Expand the group to the individual rows for display; each row is out-of-stock
  // but we keep them so users can restock a specific brand/variant directly.
  const autoRows = useMemo(() => {
    return outOfStockProducts.flatMap((g) =>
      g.items
        .slice()
        .sort((a, b) => {
          const bc = (a.brand ?? '').localeCompare(b.brand ?? '');
          return bc !== 0 ? bc : (a.variant ?? '').localeCompare(b.variant ?? '');
        }),
    );
  }, [outOfStockProducts]);

  const manualItems = useMemo(() => {
    return shoppingItems
      .filter((it) => {
        if (!q) return true;
        return (
          it.product.toLowerCase().includes(q) ||
          (it.brand ?? '').toLowerCase().includes(q) ||
          (it.variant ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.product.localeCompare(b.product));
  }, [shoppingItems, q]);

  const hasAuto = autoRows.length > 0;
  const hasManual = manualItems.length > 0;
  const isEmpty =
    !hasAuto && !hasManual && shoppingItems.length === 0 && outOfStockProducts.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-neutral-500 px-6 text-center">
        <ShoppingBag className="h-12 w-12 mb-4 text-neutral-700" />
        <p className="text-neutral-300 font-medium text-base">Shopping list is empty</p>
        <p className="text-sm mt-1.5 text-neutral-500">
          Products appear here automatically when they run out. You can also add one-off items like a gift or cable.
        </p>
        <button onClick={onAddShoppingItem} className="mt-5 btn-primary inline-flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Add shopping item
        </button>
      </div>
    );
  }

  const handleRestock = async (input: RestockInput) => {
    if (!restockTarget) return;
    setBusyId(restockTarget.id);
    setErr(null);
    try {
      await onRestock(restockTarget.id, input);
      setRestockTarget(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to record restock.');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleDone = async (e: React.MouseEvent, id: string, value: boolean) => {
    e.stopPropagation();
    setBusyId(id);
    try {
      await onToggleShoppingItemDone(id, value);
    } catch {
      // ignore
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteShopping = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setBusyId(id);
    try {
      await onDeleteShoppingItem(id);
    } catch {
      // ignore
    } finally {
      setBusyId(null);
      setConfirmDeleteShopping(null);
    }
  };

  return (
    <div className="px-4 pb-36">
      <SearchBar value={query} onChange={setQuery} placeholder="Search products…" />

      {err && (
        <div className="mb-3 p-3 rounded-2xl bg-red-950/40 border border-red-900 text-red-300 text-sm">
          {err}
        </div>
      )}

      {q && !hasAuto && !hasManual && (
        <p className="text-center text-neutral-500 text-sm py-12">No items match &ldquo;{query}&rdquo;.</p>
      )}

      {hasAuto && (
        <ShoppingGroup label="Out of stock" count={outOfStockProducts.length} tone="out">
          {outOfStockProducts.map((g) => (
            <ProductShoppingCard
              key={g.product}
              group={g}
              onRestock={(it) => setRestockTarget(it)}
              onEdit={onEditInventory}
            />
          ))}
        </ShoppingGroup>
      )}

      {hasManual && (
        <ShoppingGroup label="Shopping list" count={manualItems.length} tone="manual">
          {manualItems.map((it) => (
            <ManualShoppingCard
              key={it.id}
              item={it}
              busy={busyId === it.id}
              onToggleDone={(e) => handleToggleDone(e, it.id, !it.is_done)}
              onEdit={() => onEditShoppingItem(it)}
              onDelete={() => setConfirmDeleteShopping(it)}
            />
          ))}
        </ShoppingGroup>
      )}

      {restockTarget && (
        <RestockModal item={restockTarget} onClose={() => setRestockTarget(null)} onConfirm={handleRestock} />
      )}

      {confirmDeleteShopping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-2xl">
            <h3 className="text-white font-semibold text-lg">Remove from list?</h3>
            <p className="text-sm text-neutral-400 mt-1">
              This deletes <span className="text-white">{confirmDeleteShopping.product}</span> from
              your shopping list.
            </p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setConfirmDeleteShopping(null)} className="btn-ghost flex-1">
                Cancel
              </button>
              <button
                onClick={(e) => handleDeleteShopping(e, confirmDeleteShopping.id)}
                className="btn-danger flex-1"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShoppingGroup({
  label,
  count,
  tone,
  children,
}: {
  label: string;
  count: number;
  tone: 'out' | 'manual';
  children: React.ReactNode;
}) {
  const dot = tone === 'out' ? 'bg-red-500' : 'bg-neutral-500';
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{label}</h2>
        <span className="text-xs text-neutral-600">{count}</span>
      </div>
      <ul className="space-y-3">{children}</ul>
    </div>
  );
}

function ProductShoppingCard({
  group,
  onRestock,
  onEdit,
}: {
  group: ProductGroup;
  onRestock: (item: InventoryItem) => void;
  onEdit: (item: InventoryItem) => void;
}) {
  const sorted = [...group.items].sort((a, b) => {
    const bc = (a.brand ?? '').localeCompare(b.brand ?? '');
    return bc !== 0 ? bc : (a.variant ?? '').localeCompare(b.variant ?? '');
  });

  return (
    <li className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-white text-base leading-tight truncate">{group.product}</h3>
          <div className="flex items-center gap-1.5 mt-1 text-xs flex-wrap">
            <span className="text-neutral-500">
              {group.items.length} {group.items.length === 1 ? 'variant' : 'variants'} · all out of stock
            </span>
          </div>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {sorted.map((it) => (
          <li
            key={it.id}
            onClick={() => onEdit(it)}
            className="bg-neutral-950/50 border border-neutral-800/70 rounded-xl p-2.5 cursor-pointer hover:bg-neutral-800/60 active:bg-neutral-800 transition"
          >
            <ShoppingRow item={it} onRestock={() => onRestock(it)} />
          </li>
        ))}
      </ul>
    </li>
  );
}

function ShoppingRow({ item, onRestock }: { item: InventoryItem; onRestock: () => void }) {
  const isUnitsMode = item.tracking_mode === 'units';
  const modeIcon = isUnitsMode ? <Layers className="h-3 w-3" /> : <Package className="h-3 w-3" />;
  const brandVariant = [item.brand, item.variant].filter(Boolean).join(' • ');

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-neutral-200 leading-tight truncate">
            {brandVariant || 'No brand'}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {item.specification && <span className="text-neutral-500 text-xs">{item.specification}</span>}
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 bg-neutral-800/60 px-2 py-0.5 rounded-full">
              {modeIcon}
              {TRACKING_MODE_SHORT[item.tracking_mode]}
            </span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRestock();
          }}
          className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 font-medium text-sm active:scale-95 transition shrink-0"
        >
          <Plus className="h-4 w-4 shrink-0" />
          Restock
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-xs">
        <span className="text-neutral-500">
          {item.count}/{item.min_stock} {pluralize(item.unit, item.count)}
        </span>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-red-950/50 text-red-400">
          Out of stock
        </span>
      </div>
    </>
  );
}

function ManualShoppingCard({
  item,
  busy,
  onToggleDone,
  onEdit,
  onDelete,
}: {
  item: ShoppingItem;
  busy: boolean;
  onToggleDone: (e: React.MouseEvent) => void;
  onEdit: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <li
      onClick={onEdit}
      className={`bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 cursor-pointer hover:bg-neutral-800/60 active:bg-neutral-800 transition ${
        item.is_done ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleDone}
          disabled={busy}
          className={`h-7 w-7 shrink-0 rounded-full border-2 grid place-items-center transition active:scale-90 ${
            item.is_done
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'border-neutral-600 text-transparent hover:border-emerald-500'
          }`}
          aria-label={item.is_done ? 'Mark as not done' : 'Mark as done'}
        >
          <Check className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h3
            className={`font-semibold text-base leading-tight truncate ${
              item.is_done ? 'text-neutral-500 line-through' : 'text-white'
            }`}
          >
            {item.product}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs flex-wrap">
            {item.brand && <span className="text-neutral-400">{item.brand}</span>}
            {item.brand && item.variant && <span className="text-neutral-700">·</span>}
            {item.variant && <span className="text-neutral-500">{item.variant}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="h-9 w-9 grid place-items-center text-neutral-500 hover:text-white active:scale-90 transition"
            aria-label="Edit"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            className="h-9 w-9 grid place-items-center text-neutral-600 hover:text-red-400 active:scale-90 transition disabled:opacity-50"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
