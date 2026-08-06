function formatWithTimeZone(
  value: string | Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  try {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(
      new Date(value),
    );
  }
}

export const formatDate = (value?: string, timeZone = 'UTC') =>
  value
    ? formatWithTimeZone(value, timeZone, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

export const formatShortDate = (value: string, timeZone = 'UTC') =>
  formatWithTimeZone(value, timeZone, { month: 'short', day: 'numeric' });

export const formatDateTime = (value: string, timeZone = 'UTC') =>
  formatWithTimeZone(value, timeZone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

export const formatDayHeading = (value: Date, timeZone = 'UTC') =>
  formatWithTimeZone(value, timeZone, { weekday: 'long', month: 'long', day: 'numeric' });

export function initials(value: string): string {
  return value
    .split(/\s|&/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
