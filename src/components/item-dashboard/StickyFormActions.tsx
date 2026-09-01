import type { ReactNode } from 'react';

interface StickyFormActionsProps {
  primary: ReactNode;
  secondary?: ReactNode;
  error?: string | null;
}

/**
 * Sticky bottom action bar for mobile forms.
 * Renders a primary action button (full-width) with an optional secondary action.
 * Accounts for iOS/Android safe-area insets so the button is never obscured by a home indicator.
 */
export function StickyFormActions({ primary, secondary, error }: StickyFormActionsProps) {
  return (
    <div
      className="shrink-0 border-t border-neutral-800/60 bg-neutral-900 px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
    >
      {error && (
        <p className="text-sm text-red-400 text-center mb-2">{error}</p>
      )}
      <div className="space-y-2">
        {primary}
        {secondary}
      </div>
    </div>
  );
}
