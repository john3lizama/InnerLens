/** Ensure timestamps without timezone info are treated as UTC */
function normalizeTimestamp(dateString: string): string {
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
    weekday: 'long',
    month: 'long',
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
