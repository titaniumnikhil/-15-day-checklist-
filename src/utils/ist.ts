/**
 * Timezone-aware utilities for Asia/Kolkata (IST, UTC+05:30)
 */

export const SPRINT_DATES: { dayNumber: number; date: string; label: string; shortLabel: string }[] = [
  { dayNumber: 1, date: '2026-10-25', label: '25 October 2026', shortLabel: '25 Oct' },
  { dayNumber: 2, date: '2026-10-26', label: '26 October 2026', shortLabel: '26 Oct' },
  { dayNumber: 3, date: '2026-10-27', label: '27 October 2026', shortLabel: '27 Oct' },
  { dayNumber: 4, date: '2026-10-28', label: '28 October 2026', shortLabel: '28 Oct' },
  { dayNumber: 5, date: '2026-10-29', label: '29 October 2026', shortLabel: '29 Oct' },
  { dayNumber: 6, date: '2026-10-30', label: '30 October 2026', shortLabel: '30 Oct' },
  { dayNumber: 7, date: '2026-10-31', label: '31 October 2026', shortLabel: '31 Oct' },
  { dayNumber: 8, date: '2026-11-01', label: '1 November 2026', shortLabel: '1 Nov' },
  { dayNumber: 9, date: '2026-11-02', label: '2 November 2026', shortLabel: '2 Nov' },
  { dayNumber: 10, date: '2026-11-03', label: '3 November 2026', shortLabel: '3 Nov' },
  { dayNumber: 11, date: '2026-11-04', label: '4 November 2026', shortLabel: '4 Nov' },
  { dayNumber: 12, date: '2026-11-05', label: '5 November 2026', shortLabel: '5 Nov' },
  { dayNumber: 13, date: '2026-11-06', label: '6 November 2026', shortLabel: '6 Nov' },
  { dayNumber: 14, date: '2026-11-07', label: '7 November 2026', shortLabel: '7 Nov' },
  { dayNumber: 15, date: '2026-11-08', label: '8 November 2026', shortLabel: '8 Nov' },
];

export function getCurrentDateIst(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now); // YYYY-MM-DD
}

export function getIstHour(now: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false,
  });
  return parseInt(formatter.format(now), 10);
}

export function getGreetingIst(now: Date = new Date()): string {
  const hour = getIstHour(now);
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function formatIndianDate(dateStr: string): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dateObj = new Date(Date.UTC(y, m - 1, d, 6, 0, 0));
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(dateObj);
}

export function formatShortIndianDate(dateStr: string): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dateObj = new Date(Date.UTC(y, m - 1, d, 6, 0, 0));
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(dateObj);
}

export function formatTimestampIst(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return '—';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(d) + ' IST';
}

export function getSprintStatusLabel(currentDateIst: string): {
  phase: 'before' | 'active' | 'completed';
  badgeText: string;
  activeDayNumber: number | null;
} {
  if (currentDateIst < '2026-10-25') {
    return {
      phase: 'before',
      badgeText: 'Before sprint · Starts 25 October 2026',
      activeDayNumber: null,
    };
  }
  if (currentDateIst > '2026-11-08') {
    return {
      phase: 'completed',
      badgeText: 'Sprint completed · 25 Oct – 8 Nov 2026',
      activeDayNumber: null,
    };
  }
  const found = SPRINT_DATES.find((d) => d.date === currentDateIst);
  const dayNum = found ? found.dayNumber : 1;
  return {
    phase: 'active',
    badgeText: `Day ${dayNum} of 15`,
    activeDayNumber: dayNum,
  };
}

export function getDayNumberForDate(dateStr: string): number | null {
  const found = SPRINT_DATES.find((d) => d.date === dateStr);
  return found ? found.dayNumber : null;
}

export function roundOneDecimal(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value * 10) / 10;
}
