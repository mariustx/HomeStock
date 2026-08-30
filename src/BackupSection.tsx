import { useRef, useState } from 'react';
import { DownloadCloud, UploadCloud, CheckCircle, XCircle, Clock } from 'lucide-react';
import { exportBackup, importBackup, restoreBackup, type BackupFile } from './lib/backup';

const LS_KEY_LAST_EXPORT = 'homestock_last_export';
const LS_KEY_LAST_IMPORT = 'homestock_last_import';

type Status =
  | { kind: 'idle' }
  | { kind: 'exporting' }
  | { kind: 'importing' }
  | { kind: 'confirming'; backup: BackupFile }
  | { kind: 'restoring' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

function readTimestamp(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveTimestamp(key: string): string {
  const ts = new Date().toISOString();
  try {
    localStorage.setItem(key, ts);
  } catch {
    // localStorage unavailable – silently ignore
  }
  return ts;
}

function formatTs(iso: string | null): string | null {
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

export function BackupSection() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [lastExport, setLastExport] = useState<string | null>(() =>
    readTimestamp(LS_KEY_LAST_EXPORT),
  );
  const [lastImport, setLastImport] = useState<string | null>(() =>
    readTimestamp(LS_KEY_LAST_IMPORT),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    setStatus({ kind: 'exporting' });
    try {
      await exportBackup();
      const ts = saveTimestamp(LS_KEY_LAST_EXPORT);
      setLastExport(ts);
      setStatus({ kind: 'success', message: 'Backup exported successfully.' });
    } catch (e) {
      // AbortError is thrown when the user dismisses the native share sheet —
      // treat it as a non-error cancellation.
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

  // ── Import – step 1: pick & validate file ─────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so the same file can be re-selected if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    setStatus({ kind: 'importing' });
    try {
      const backup = await importBackup(file);
      // Validation passed — ask the user to confirm before touching the DB
      setStatus({ kind: 'confirming', backup });
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Could not read backup file.',
      });
    }
  };

  // ── Import – step 2: user confirmed, do the restore ───────────────────────

  const handleConfirmRestore = async () => {
    if (status.kind !== 'confirming') return;
    const { backup } = status;
    setStatus({ kind: 'restoring' });
    try {
      await restoreBackup(backup);
      saveTimestamp(LS_KEY_LAST_IMPORT);
      setLastImport(new Date().toISOString());
      setStatus({
        kind: 'success',
        message: 'Restore complete. The app will now reload.',
      });
      // Give the user a moment to read the success message before reload
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Restore failed. Your existing data is intact.',
      });
    }
  };

  const handleCancelRestore = () => setStatus({ kind: 'idle' });

  const busy =
    status.kind === 'exporting' ||
    status.kind === 'importing' ||
    status.kind === 'restoring';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-neutral-200">Backup &amp; Restore</h3>
        <p className="text-xs text-neutral-500 mt-0.5">
          Save a local copy of your HomeStock data or restore from a previous backup.
        </p>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        {/* Export */}
        <button
          id="backup-export-btn"
          onClick={handleExport}
          disabled={busy}
          className="flex items-center justify-center gap-2 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm active:scale-[0.98] transition"
        >
          {status.kind === 'exporting' ? (
            <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <DownloadCloud className="h-4 w-4 shrink-0" />
          )}
          Export
        </button>

        {/* Import – opens file picker */}
        <button
          id="backup-import-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="flex items-center justify-center gap-2 h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm active:scale-[0.98] transition"
        >
          {status.kind === 'importing' ? (
            <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <UploadCloud className="h-4 w-4 shrink-0" />
          )}
          Import
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
      </div>

      {/* Confirmation dialog (inline) */}
      {status.kind === 'confirming' && (
        <div className="rounded-xl border border-amber-800/60 bg-amber-950/30 p-3 space-y-3">
          <p className="text-xs text-amber-300 leading-relaxed">
            <span className="font-semibold">Replace current data?</span>
            <br />
            Importing this backup will permanently overwrite your current inventory, shopping list,
            restock history, and consumption history with the data from{' '}
            <span className="font-medium">
              {formatTs(status.backup.created_at) ?? status.backup.created_at}
            </span>
            . This cannot be undone.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              id="backup-cancel-restore-btn"
              onClick={handleCancelRestore}
              className="h-9 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium active:scale-[0.98] transition"
            >
              Cancel
            </button>
            <button
              id="backup-confirm-restore-btn"
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
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span className="h-4 w-4 rounded-full border-2 border-neutral-700 border-t-emerald-400 animate-spin shrink-0" />
          Restoring data…
        </div>
      )}

      {/* Success feedback */}
      {status.kind === 'success' && (
        <div className="flex items-start gap-2 rounded-xl bg-emerald-950/40 border border-emerald-900/50 p-3 text-xs text-emerald-300">
          <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{status.message}</span>
        </div>
      )}

      {/* Error feedback */}
      {status.kind === 'error' && (
        <div className="flex items-start gap-2 rounded-xl bg-red-950/40 border border-red-900/50 p-3 text-xs text-red-300">
          <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{status.message}</span>
        </div>
      )}

      {/* Last backup/restore timestamps */}
      {(lastExport || lastImport) && (
        <div className="space-y-1 pt-1 border-t border-neutral-800">
          {lastExport && (
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              <Clock className="h-3 w-3 shrink-0" />
              Last export: {formatTs(lastExport)}
            </div>
          )}
          {lastImport && (
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              <Clock className="h-3 w-3 shrink-0" />
              Last import: {formatTs(lastImport)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
