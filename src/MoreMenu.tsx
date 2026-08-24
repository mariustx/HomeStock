import { useRef, useState } from 'react';
import {
  MoreVertical,
  DownloadCloud,
  UploadCloud,
  CheckCircle,
  XCircle,
  Clock,
  Package,
} from 'lucide-react';
import { exportBackup, importBackup, restoreBackup, type BackupFile } from './lib/backup';

// ─── localStorage timestamps ──────────────────────────────────────────────────

const LS_EXPORT = 'homestock_last_export';
const LS_IMPORT = 'homestock_last_import';

function readTs(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveTs(key: string): string {
  const ts = new Date().toISOString();
  try {
    localStorage.setItem(key, ts);
  } catch { /* ignore */ }
  return ts;
}

function fmtTs(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Status machine ───────────────────────────────────────────────────────────

type Status =
  | { kind: 'idle' }
  | { kind: 'exporting' }
  | { kind: 'importing' }
  | { kind: 'confirming'; backup: BackupFile }
  | { kind: 'restoring' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

// ─── Component ────────────────────────────────────────────────────────────────

export function MoreMenu() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [lastExport, setLastExport] = useState<string | null>(() => readTs(LS_EXPORT));
  const [lastImport, setLastImport] = useState<string | null>(() => readTs(LS_IMPORT));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy =
    status.kind === 'exporting' ||
    status.kind === 'importing' ||
    status.kind === 'restoring';

  /** Close the panel — blocked while busy or waiting for confirmation. */
  const close = () => {
    if (isBusy || status.kind === 'confirming') return;
    setOpen(false);
    setStatus({ kind: 'idle' });
  };

  const toggle = () => (open ? close() : setOpen(true));

  // ── Export ──────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    setStatus({ kind: 'exporting' });
    try {
      await exportBackup();
      const ts = saveTs(LS_EXPORT);
      setLastExport(ts);
      setStatus({ kind: 'success', message: 'Backup exported successfully.' });
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setStatus({ kind: 'idle' });
        return;
      }
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Export failed. Please try again.',
      });
    }
  };

  // ── Import – step 1: pick & validate ───────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    setStatus({ kind: 'importing' });
    try {
      const backup = await importBackup(file);
      setStatus({ kind: 'confirming', backup });
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Could not read backup file.',
      });
    }
  };

  // ── Import – step 2: confirmed ──────────────────────────────────────────────

  const handleConfirmRestore = async () => {
    if (status.kind !== 'confirming') return;
    const { backup } = status;
    setStatus({ kind: 'restoring' });
    try {
      await restoreBackup(backup);
      saveTs(LS_IMPORT);
      setLastImport(new Date().toISOString());
      setStatus({ kind: 'success', message: 'Restore complete. Reloading…' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setStatus({
        kind: 'error',
        message:
          e instanceof Error ? e.message : 'Restore failed. Your existing data is intact.',
      });
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="relative">
      {/* ⋮ trigger */}
      <button
        id="more-menu-btn"
        onClick={toggle}
        aria-label="More options"
        aria-expanded={open}
        aria-haspopup="menu"
        className="h-9 w-9 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 active:scale-90 transition"
      >
        <MoreVertical className="h-5 w-5" />
      </button>

      {/* Click-outside overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Dropdown panel */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl shadow-black/70 overflow-hidden"
        >
          {/* ── Section: Backup & Restore ── */}
          <div className="px-4 pt-3 pb-0.5">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-neutral-500">
              Backup &amp; Restore
            </p>
          </div>

          {/* Export backup */}
          <button
            id="more-export-btn"
            role="menuitem"
            onClick={handleExport}
            disabled={isBusy}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-neutral-800 active:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-left"
          >
            {status.kind === 'exporting' ? (
              <span className="h-4 w-4 rounded-full border-2 border-neutral-600 border-t-emerald-400 animate-spin shrink-0" />
            ) : (
              <DownloadCloud className="h-4 w-4 shrink-0 text-emerald-400" />
            )}
            <div className="min-w-0">
              <div className="font-medium">Export backup</div>
              {lastExport && (
                <div className="flex items-center gap-1 text-[11px] text-neutral-500 mt-0.5">
                  <Clock className="h-3 w-3 shrink-0" />
                  Last: {fmtTs(lastExport)}
                </div>
              )}
            </div>
          </button>

          {/* Import backup */}
          <button
            id="more-import-btn"
            role="menuitem"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-neutral-800 active:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-left"
          >
            {status.kind === 'importing' ? (
              <span className="h-4 w-4 rounded-full border-2 border-neutral-600 border-t-emerald-400 animate-spin shrink-0" />
            ) : (
              <UploadCloud className="h-4 w-4 shrink-0 text-neutral-400" />
            )}
            <div className="min-w-0">
              <div className="font-medium">Import backup</div>
              {lastImport && (
                <div className="flex items-center gap-1 text-[11px] text-neutral-500 mt-0.5">
                  <Clock className="h-3 w-3 shrink-0" />
                  Last: {fmtTs(lastImport)}
                </div>
              )}
            </div>
          </button>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChange}
            aria-label="Select HomeStock backup file"
          />

          {/* Inline confirm dialog */}
          {status.kind === 'confirming' && (
            <div className="mx-3 mb-1 rounded-xl border border-amber-800/60 bg-amber-950/30 p-3 space-y-2.5">
              <p className="text-xs text-amber-300 leading-relaxed">
                <span className="font-semibold">Replace current data?</span>{' '}
                Your inventory, shopping list, and restock history will be replaced with the
                backup from{' '}
                <span className="font-medium">
                  {fmtTs(status.backup.created_at) ?? status.backup.created_at}
                </span>
                . This cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="more-cancel-restore-btn"
                  onClick={() => setStatus({ kind: 'idle' })}
                  className="h-9 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium active:scale-[0.98] transition"
                >
                  Cancel
                </button>
                <button
                  id="more-confirm-restore-btn"
                  onClick={handleConfirmRestore}
                  className="h-9 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold active:scale-[0.98] transition"
                >
                  Yes, restore
                </button>
              </div>
            </div>
          )}

          {/* Restoring spinner */}
          {status.kind === 'restoring' && (
            <div className="flex items-center gap-2 px-4 pb-3 text-xs text-neutral-400">
              <span className="h-4 w-4 rounded-full border-2 border-neutral-700 border-t-emerald-400 animate-spin shrink-0" />
              Restoring data…
            </div>
          )}

          {/* Success */}
          {status.kind === 'success' && (
            <div className="mx-3 mb-1 flex items-start gap-2 rounded-xl bg-emerald-950/40 border border-emerald-900/50 p-3 text-xs text-emerald-300">
              <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{status.message}</span>
            </div>
          )}

          {/* Error */}
          {status.kind === 'error' && (
            <div className="mx-3 mb-1 flex items-start gap-2 rounded-xl bg-red-950/40 border border-red-900/50 p-3 text-xs text-red-300">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{status.message}</span>
            </div>
          )}

          {/* Divider */}
          <div className="mx-3 my-1 border-t border-neutral-800" />

          {/* ── Section: About ── */}
          <div className="px-4 pt-2 pb-0.5">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-neutral-500">
              About
            </p>
          </div>
          <div className="flex items-start gap-3 px-4 py-3">
            <Package className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-white">HomeStock</div>
              <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">
                Local-first household inventory tracker.
                All data lives on your device — nothing is sent to any server.
              </p>
            </div>
          </div>

          <div className="h-2" />
        </div>
      )}
    </div>
  );
}
