const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'America/New_York',
});

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'America/New_York',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/New_York',
});

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'America/New_York',
});

export const formatDate = (value?: string) => (value ? dateFormatter.format(new Date(value)) : '—');

export const formatShortDate = (value: string) => shortDateFormatter.format(new Date(value));

export const formatDateTime = (value: string) => dateTimeFormatter.format(new Date(value));

export const formatDayHeading = (value: Date) => weekdayFormatter.format(value);

export function initials(value: string): string {
  return value
    .split(/\s|&/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
