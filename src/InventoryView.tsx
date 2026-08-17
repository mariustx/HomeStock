import { useMemo, useState } from 'react';
import { Minus, Plus, Trash2, PackageSearch, Search, X, Package, Layers, ChevronRight, Boxes } from 'lucide-react';
import { pluralize, TRACKING_MODE_SHORT, formatDateOnly, type InventoryItem } from './types';

interface InventoryViewProps {
  items: InventoryItem[];
  loading: boolean;
  error: string | null;
  onAdjust: (id: string, delta: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (item: InventoryItem) => void;
  onAdd?: () => void;
}

interface ProductGroup {
  product: string;
  items: InventoryItem[];
  totalStock: number;
  brandCount: number;
  minStockSum: number;
  outOfStock: boolean;
  lowStock: boolean;
}

function groupByProduct(items: InventoryItem[]): ProductGroup[] {
  const map = new Map<string, InventoryItem[]>();
  for (const it of items) {
    const key = it.product;
    const arr = map.get(key);
    if (arr) arr.push(it);
    else map.set(key, [it]);
  }
  const groups: ProductGroup[] = [];
  for (const [product, groupItems] of map) {
    const totalStock = groupItems.reduce((sum, it) => sum + it.count, 0);
    const minStockSum = groupItems.reduce((sum, it) => sum + it.min_stock, 0);
    const brandCount = new Set(groupItems.map((it) => it.brand ?? '').filter(Boolean)).size;
    const outOfStock = totalStock === 0;
    const lowStock = !outOfStock && minStockSum > 0 && totalStock <= minStockSum;
    groups.push({ product, items: groupItems, totalStock, brandCount, minStockSum, outOfStock, lowStock });
  }
  groups.sort((a, b) => a.product.localeCompare(b.product));
  return groups;
}

function rowMatches(it: InventoryItem, q: string): boolean {
  return (
    it.product.toLowerCase().includes(q) ||
    (it.brand ?? '').toLowerCase().includes(q) ||
    (it.variant ?? '').toLowerCase().includes(q)
  );
}

function groupMatches(group: ProductGroup, q: string): boolean {
  return group.items.some((it) => rowMatches(it, q));
}

export function InventoryView({ items, loading, error, onAdjust, onDelete, onEdit, onAdd }: InventoryViewProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<InventoryItem | null>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();

  const allGroups = useMemo(() => groupByProduct(items), [items]);

  const visibleGroups = useMemo(() => {
    if (!q) return allGroups;
    return allGroups.filter((g) => groupMatches(g, q));
  }, [allGroups, q]);

  // Groups that should render expanded: user-toggled ones, plus any matching
  // groups while a search is active.
  const isOpen = (product: string) => (q ? groupMatches(allGroups.find((g) => g.product === product)!, q) : expanded.has(product));

  const toggleGroup = (product: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(product)) next.delete(product);
      else next.add(product);
      return next;
    });
  };

  const handleAdjust = async (e: React.MouseEvent, id: string, delta: number) => {
    e.stopPropagation();
    setBusyId(id);
    try {
      await onAdjust(id, delta);
    } catch {
      // optimistic update already applied
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-neutral-500">
        <div className="h-8 w-8 border-2 border-neutral-700 border-t-emerald-400 rounded-full animate-spin mb-3" />
        Loading inventory…
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-4 p-4 rounded-2xl bg-red-950/40 border border-red-900 text-red-300 text-sm">
        Could not load inventory: {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-neutral-500 px-6 text-center">
        <PackageSearch className="h-12 w-12 mb-4 text-neutral-700" />
        <p className="text-neutral-300 font-medium text-base">Your storage is empty</p>
        <p className="text-sm mt-1.5 text-neutral-500">Add products to track what you have at home and get a shopping list automatically.</p>
        {onAdd && (
          <button onClick={onAdd} className="mt-5 btn-primary inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Add product
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="pb-36">
      {/* Sticky search region */}
      <div className="sticky top-0 z-20 bg-neutral-950/85 backdrop-blur-lg px-4 pt-3 pb-2 -mt-3">
        <SearchBar value={query} onChange={setQuery} placeholder="Search product, brand, variant…" />
        {q.length > 0 && (
          <p className="mt-1.5 mb-0.5 text-xs text-neutral-400">
            {visibleGroups.length > 0
              ? `${visibleGroups.length} ${visibleGroups.length === 1 ? 'product' : 'products'} found`
              : 'No products found'}
          </p>
        )}
      </div>

      <div className="px-4">
        {visibleGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <PackageSearch className="h-10 w-10 mb-3 text-neutral-700" />
            <p className="text-neutral-300 font-medium">No products found</p>
            <p className="text-sm mt-1 text-neutral-500">
              Nothing matches &ldquo;{query}&rdquo;. Try a different search.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visibleGroups.map((group) =>
              group.items.length === 1 ? (
                <SingleItemCard
                  key={group.product}
                  item={group.items[0]}
                  query={q}
                  busy={busyId === group.items[0].id}
                  onAdjust={handleAdjust}
                  onEdit={onEdit}
                  onDelete={(item) => setPendingDelete(item)}
                />
              ) : (
                <ProductGroupCard
                  key={group.product}
                  group={group}
                  query={q}
                  open={isOpen(group.product)}
                  onToggle={() => toggleGroup(group.product)}
                  busyId={busyId}
                  onAdjust={handleAdjust}
                  onEdit={onEdit}
                  onDelete={(item) => setPendingDelete(item)}
                />
              ),
            )}
          </ul>
        )}
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-2xl">
            <h3 className="text-white font-semibold text-lg">Delete product?</h3>
            <p className="text-sm text-neutral-400 mt-1">
              This removes <span className="text-white">{pendingDelete.brand ?? pendingDelete.product}</span> and its restock
              history. This cannot be undone.
            </p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setPendingDelete(null)} className="btn-ghost flex-1">
                Cancel
              </button>
              <button
                onClick={async () => {
                  setBusyId(pendingDelete.id);
                  try {
                    await onDelete(pendingDelete.id);
                  } catch {
                    // ignore
                  } finally {
                    setBusyId(null);
                    setPendingDelete(null);
                  }
                }}
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

/** Escape regex metacharacters in a user query for safe use in highlight regex. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Split text into segments, marking which match the query for highlighting. */
function highlightSegments(text: string, query: string): { text: string; match: boolean }[] {
  if (!query) return [{ text, match: false }];
  const re = new RegExp(escapeRegExp(query), 'gi');
  const out: { text: string; match: boolean }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), match: false });
    out.push({ text: m[0], match: true });
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (last < text.length) out.push({ text: text.slice(last), match: false });
  return out;
}

function HighlightedName({ name, query }: { name: string; query: string }) {
  const segs = highlightSegments(name, query);
  if (!query) return <>{name}</>;
  return (
    <>
      {segs.map((s, i) =>
        s.match ? (
          <mark key={i} className="bg-emerald-500/30 text-emerald-200 rounded-sm px-0.5">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

function SingleItemCard({
  item,
  query,
  busy,
  onAdjust,
  onEdit,
  onDelete,
}: {
  item: InventoryItem;
  query: string;
  busy: boolean;
  onAdjust: (e: React.MouseEvent, id: string, delta: number) => Promise<void>;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
}) {
  const out = item.count === 0;
  const low = !out && item.min_stock > 0 && item.count <= item.min_stock;
  const modeIcon =
    item.tracking_mode === 'units' ? <Layers className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />;
  const brandVariant = [item.brand, item.variant].filter(Boolean).join(' • ');
  const hasMeta = item.min_stock > 0 || out || low || Boolean(formatDateOnly(item.opened_at));

  return (
    <li className="bg-neutral-900/70 border border-neutral-800 rounded-xl overflow-hidden">
      <div
        onClick={() => onEdit(item)}
        className="px-3.5 py-2.5 cursor-pointer hover:bg-neutral-800/40 active:bg-neutral-800/60 transition"
      >
        {/* Title row: product name + stock */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-white text-[15px] leading-tight truncate">
              <HighlightedName name={item.product} query={query} />
            </h3>
            {brandVariant ? (
              <p className="text-[13px] text-neutral-400 leading-tight truncate mt-0.5">
                <HighlightedName name={brandVariant} query={query} />
              </p>
            ) : (
              <p className="text-[13px] text-neutral-600 leading-tight truncate mt-0.5">No brand</p>
            )}
          </div>
          <div className="flex items-baseline gap-1 shrink-0 tabular-nums">
            <span
              className={`text-2xl font-bold leading-none ${
                out ? 'text-red-400' : low ? 'text-amber-400' : 'text-white'
              }`}
            >
              {item.count}
            </span>
            <span className="text-[11px] text-neutral-500">{pluralize(item.unit, item.count)}</span>
          </div>
        </div>

        {/* Meta row */}
        <div className={`flex items-center gap-1.5 flex-wrap ${hasMeta ? 'mt-1.5' : ''}`}>
          <span className="text-neutral-600" title={TRACKING_MODE_SHORT[item.tracking_mode]}>
            {modeIcon}
          </span>
          {item.min_stock > 0 && (
            <span className="text-[11px] text-neutral-600">Min {item.min_stock}</span>
          )}
          {out && (
            <span className="text-[9px] font-semibold uppercase tracking-wide text-red-400/80 px-1 py-0.5 rounded bg-red-950/40">
              Out of stock
            </span>
          )}
          {!out && low && (
            <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-400/80 px-1 py-0.5 rounded bg-amber-950/40">
              Low stock
            </span>
          )}
          {formatDateOnly(item.opened_at) && (
            <span className="text-[11px] text-neutral-600">Opened {formatDateOnly(item.opened_at)}</span>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div
        className="flex items-center gap-2 px-3.5 py-2 border-t border-neutral-800/70"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => onAdjust(e, item.id, -1)}
          disabled={busy}
          className="touch-target bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg grid place-items-center active:scale-90 transition disabled:opacity-50"
          aria-label={`Decrease ${item.product}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => onAdjust(e, item.id, 1)}
          disabled={busy}
          className="touch-target bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg grid place-items-center active:scale-90 transition disabled:opacity-50"
          aria-label={`Increase ${item.product}`}
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDelete(item)}
          className="touch-target bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-lg grid place-items-center active:scale-90 transition ml-auto"
          aria-label={`Delete ${item.product}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

function ProductGroupCard({
  group,
  query,
  open,
  onToggle,
  busyId,
  onAdjust,
  onEdit,
  onDelete,
}: {
  group: ProductGroup;
  query: string;
  open: boolean;
  onToggle: () => void;
  busyId: string | null;
  onAdjust: (e: React.MouseEvent, id: string, delta: number) => Promise<void>;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
}) {
  const sortedItems = [...group.items].sort((a, b) => {
    const brandCompare = (a.brand ?? '').localeCompare(b.brand ?? '');
    if (brandCompare !== 0) return brandCompare;
    return (a.variant ?? '').localeCompare(b.variant ?? '');
  });

  return (
    <li className="bg-neutral-900/70 border border-neutral-800 rounded-xl overflow-hidden">
      {/* Group header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-neutral-800/50 active:bg-neutral-800/70 transition text-left"
      >
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-white text-[15px] leading-tight truncate">
            <HighlightedName name={group.product} query={query} />
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
              <Boxes className="h-3 w-3" />
              {group.brandCount} {group.brandCount === 1 ? 'brand' : 'brands'}
            </span>
            {group.outOfStock && (
              <span className="text-[9px] font-semibold uppercase tracking-wide text-red-400/80 px-1 py-0.5 rounded bg-red-950/40">
                Out of stock
              </span>
            )}
            {!group.outOfStock && group.lowStock && (
              <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-400/80 px-1 py-0.5 rounded bg-amber-950/40">
                Low stock
              </span>
            )}
          </div>
        </div>
        <div className="flex items-baseline gap-1 shrink-0 tabular-nums">
          <span
            className={`text-2xl font-bold leading-none ${
              group.outOfStock ? 'text-red-400' : group.lowStock ? 'text-amber-400' : 'text-white'
            }`}
          >
            {group.totalStock}
          </span>
        </div>
      </button>

      {/* Expanded rows */}
      {open && (
        <div className="border-t border-neutral-800/70 divide-y divide-neutral-800/60">
          {sortedItems.map((it) => (
            <GroupRow
              key={it.id}
              item={it}
              query={query}
              busy={busyId === it.id}
              onAdjust={onAdjust}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </li>
  );
}

function GroupRow({
  item,
  query,
  busy,
  onAdjust,
  onEdit,
  onDelete,
}: {
  item: InventoryItem;
  query: string;
  busy: boolean;
  onAdjust: (e: React.MouseEvent, id: string, delta: number) => Promise<void>;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
}) {
  const out = item.count === 0;
  const low = !out && item.min_stock > 0 && item.count <= item.min_stock;
  const modeIcon =
    item.tracking_mode === 'units' ? <Layers className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />;
  const brandVariant = [item.brand, item.variant].filter(Boolean).join(' • ');
  const hasMeta = Boolean(brandVariant) || item.min_stock > 0 || out || low || Boolean(formatDateOnly(item.opened_at));

  return (
    <div
      onClick={() => onEdit(item)}
      className="px-3.5 py-2 cursor-pointer hover:bg-neutral-800/40 active:bg-neutral-800/60 transition"
    >
      {/* Identity row: name + stock on one line */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {brandVariant ? (
            <p className="text-[13px] text-neutral-300 leading-tight truncate">
              <HighlightedName name={brandVariant} query={query} />
            </p>
          ) : (
            <p className="text-[13px] text-neutral-500 leading-tight truncate">No brand</p>
          )}
        </div>

        {/* Compact stock block */}
        <div className="flex items-baseline gap-1 shrink-0 tabular-nums">
          <span
            className={`text-xl font-bold leading-none ${
              out ? 'text-red-400' : low ? 'text-amber-400' : 'text-white'
            }`}
          >
            {item.count}
          </span>
          <span className="text-[11px] text-neutral-500">{pluralize(item.unit, item.count)}</span>
        </div>
      </div>

      {/* Meta row: subtle mode icon + min stock + status */}
      <div className={`flex items-center gap-1.5 flex-wrap ${hasMeta ? 'mt-1' : ''}`}>
        <span className="text-neutral-600" title={TRACKING_MODE_SHORT[item.tracking_mode]}>
          {modeIcon}
        </span>
        {item.min_stock > 0 && (
          <span className="text-[11px] text-neutral-600">Min {item.min_stock}</span>
        )}
        {out && (
          <span className="text-[9px] font-semibold uppercase tracking-wide text-red-400/80 px-1 py-0.5 rounded bg-red-950/40">
            Out of stock
          </span>
        )}
        {!out && low && (
          <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-400/80 px-1 py-0.5 rounded bg-amber-950/40">
            Low stock
          </span>
        )}
        {formatDateOnly(item.opened_at) && (
          <span className="text-[11px] text-neutral-600">Opened {formatDateOnly(item.opened_at)}</span>
        )}
      </div>

      {/* Controls */}
      <div
        className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-neutral-800/70"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => onAdjust(e, item.id, -1)}
          disabled={busy}
          className="touch-target bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg grid place-items-center active:scale-90 transition disabled:opacity-50"
          aria-label={`Decrease ${item.product}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => onAdjust(e, item.id, 1)}
          disabled={busy}
          className="touch-target bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg grid place-items-center active:scale-90 transition disabled:opacity-50"
          aria-label={`Increase ${item.product}`}
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDelete(item)}
          className="touch-target bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-lg grid place-items-center active:scale-90 transition ml-auto"
          aria-label={`Delete ${item.product}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-10 pr-9"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center text-neutral-500 hover:text-white rounded-lg transition"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
