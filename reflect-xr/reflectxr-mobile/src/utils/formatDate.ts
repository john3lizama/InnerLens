/**
 * Ensure timestamps without timezone info are treated as UTC.
 *
 * The backend's `ChatSession.created_at` (and other columns declared
 * `Mapped[datetime]` without `timezone=True`) serialize as naive ISO
 * strings like "2026-04-18T12:06:00" — no `Z`, no offset. ES6 `new
 * Date(...)` parses those as **local time**, which flips the sign of
 * `Date.now() - parsed` for users west of UTC and breaks any "just now"
 * / relative-time logic built on that diff. Appending `Z` forces UTC
 * interpretation so the math is consistent across timezones.
 */
export function normalizeTimestamp(dateString: string): string {
  if (dateString && !dateString.endsWith('Z') && !dateString.includes('+') && !/\d{2}:\d{2}$/.test(dateString.slice(-5))) {
    return dateString + 'Z';
  }
  return dateString;
}

export function formatRelativeDate(dateString: string): string {
  const date = new Date(normalizeTimestamp(dateString));

  // If parsing failed, fall back to the raw string
  if (isNaN(date.getTime())) {
    return dateString;
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Future dates (clock skew / timezone mismatch) — show formatted date
  if (diffMs < 0) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function formatFullDate(dateString: string): string {
  const date = new Date(normalizeTimestamp(dateString));
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(dateString: string): string {
  const date = new Date(normalizeTimestamp(dateString));
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Parse a YYYY-MM-DD slug as a local-calendar date and return its
 * single-letter weekday label (M / T / W / T / F / S / S).
 *
 * Uses `new Date(y, m - 1, d)` explicitly — passing "YYYY-MM-DD" to the
 * Date constructor treats the string as UTC midnight, which shifts the
 * calendar day for users west of UTC (e.g. PST would render Wednesday
 * as Tuesday). This implementation stays tz-safe by avoiding that path.
 */
export function formatDayOfWeek(dateString: string): string {
  const parts = dateString.split('-');
  if (parts.length !== 3) return '';
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return '';
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return '';
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()] ?? '';
}
