import type { ConsumptionEntry, ConsumptionPeriod, ConsumptionStats } from '../types';

/**
 * Derives consumption periods and summary statistics from an item's opening history.
 *
 * Requirements:
 * - Durations are NOT stored statically; they are dynamically derived from chronological opening events.
 * - If fewer than 2 opening events exist, no complete consumption periods exist.
 * - Periods are computed between consecutive sorted opening dates: date[i] -> date[i+1].
 */
export function calculateConsumptionStats(entries: ConsumptionEntry[]): ConsumptionStats {
  if (!entries || entries.length === 0) {
    return {
      openingsCount: 0,
      periodsCount: 0,
      averageDays: null,
      lastDays: null,
      periods: [],
    };
  }

  // Filter valid dates and sort chronologically (earliest to latest)
  const sorted = entries
    .map((e) => ({
      ...e,
      ts: new Date(e.opened_at).getTime(),
    }))
    .filter((e) => !Number.isNaN(e.ts))
    .sort((a, b) => a.ts - b.ts);

  if (sorted.length < 2) {
    return {
      openingsCount: sorted.length,
      periodsCount: 0,
      averageDays: null,
      lastDays: null,
      periods: [],
    };
  }

  const periods: ConsumptionPeriod[] = [];
  let totalDays = 0;

  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];
    const diffMs = Math.max(0, to.ts - from.ts);
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));

    periods.push({
      fromOpenedAt: from.opened_at,
      toOpenedAt: to.opened_at,
      days,
    });
    totalDays += days;
  }

  const periodsCount = periods.length;
  const averageDays = periodsCount > 0 ? totalDays / periodsCount : null;
  const lastDays = periodsCount > 0 ? periods[periods.length - 1].days : null;

  return {
    openingsCount: sorted.length,
    periodsCount,
    averageDays,
    lastDays,
    periods,
  };
}

/**
 * Format a duration in days into user-friendly text (e.g. "~43 days", "1 day", "45 days").
 */
export function formatConsumptionDuration(days: number | null | undefined): string {
  if (days === null || days === undefined || Number.isNaN(days)) {
    return '';
  }
  if (days === 1) {
    return '1 day';
  }
  if (Number.isInteger(days)) {
    return `${days} days`;
  }
  // Decimal average -> "~43 days"
  return `~${Math.round(days)} days`;
}

/**
 * Format a concise badge label for inventory view cards (e.g. "Avg ~43d" or "Lasts ~43d").
 */
export function formatConsumptionBadge(stats: ConsumptionStats | null | undefined): string | null {
  if (!stats || stats.periodsCount < 1 || stats.averageDays === null) {
    return null;
  }
  const avg = stats.averageDays;
  const daysStr = Number.isInteger(avg) ? `${avg}d` : `~${Math.round(avg)}d`;
  return `Avg ${daysStr}`;
}

/**
 * Estimate total remaining days of supply.
 *
 * Logic:
 *  - The current open unit has already been consumed for (today - openedAt) days.
 *  - Remaining days in current unit = max(0, averageDays - daysSinceOpen).
 *  - Additional units in stock (count - 1) each contribute averageDays.
 *
 * Returns null when:
 *  - averageDays is not yet known (fewer than 2 opening events).
 *  - openedAt is null/invalid and count === 0 (nothing open, nothing in stock).
 *
 * When count > 0 and openedAt is null we treat every unit as full (count * averageDays).
 */
export function calculateDaysRemaining(
  openedAt: string | null,
  count: number,
  stats: ConsumptionStats,
): number | null {
  const avg = stats.averageDays;
  if (avg === null || avg <= 0) return null;

  const stockCount = Math.max(0, count);

  if (openedAt) {
    const openedTs = new Date(openedAt).getTime();
    if (Number.isNaN(openedTs)) return null;
    const daysSinceOpen = Math.max(0, (Date.now() - openedTs) / (1000 * 60 * 60 * 24));
    const remainingInCurrentUnit = Math.max(0, avg - daysSinceOpen);
    // stockCount includes the currently-open unit in packages mode; in units mode
    // the opened unit has already been removed from count when '-' was pressed.
    // We play it conservatively: remaining in current + full units still in stock.
    const additionalUnits = Math.max(0, stockCount); // stockCount = sealed packages
    return Math.round(remainingInCurrentUnit + additionalUnits * avg);
  }

  // Nothing currently open — all stock is sealed
  if (stockCount === 0) return null;
  return Math.round(stockCount * avg);
}
