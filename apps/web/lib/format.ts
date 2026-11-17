// Pure date/number formatting helpers. All dates are the student's local time.

const pad = (value: number) => String(value).padStart(2, "0");

/** Parse a YYYY-MM-DD string as a local calendar date (not UTC midnight). */
export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Split an ISO timestamp into local date and time strings for the planner API. */
export function toLocalParts(iso: string): { date: string; time: string } {
  const value = new Date(iso);
  return {
    date: toDateKey(value),
    time: `${pad(value.getHours())}:${pad(value.getMinutes())}:00`,
  };
}

/** The current local time as a timezone-free ISO string, matching the planner's naive datetimes. */
export function localNowIso(now = new Date()): string {
  return `${toDateKey(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
}

export function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function formatClock(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatTimeString(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  return formatClock(new Date(2000, 0, 1, hours, minutes));
}

export function dayLabel(dateKey: string, now: Date | null): string {
  if (now) {
    const today = toDateKey(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    if (dateKey === today) return "Today";
    if (dateKey === toDateKey(tomorrow)) return "Tomorrow";
  }
  return parseLocalDate(dateKey).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDue(dueDate: string, dueTime: string | null, now: Date | null): string {
  const day = dayLabel(dueDate, now);
  return dueTime ? `${day} · ${formatTimeString(dueTime)}` : day;
}

/** Hours until a task is due, or null if the clock isn't known yet. */
export function hoursUntilDue(dueDate: string, dueTime: string | null, now: Date | null): number | null {
  if (!now) return null;
  const due = parseLocalDate(dueDate);
  if (dueTime) {
    const [hours, minutes] = dueTime.split(":").map(Number);
    due.setHours(hours, minutes);
  } else {
    due.setHours(23, 59);
  }
  return (due.getTime() - now.getTime()) / 3_600_000;
}

export function relativeTime(then: Date, now: Date | null): string {
  if (!now) return "";
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return then.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatLongDate(now: Date): string {
  return now
    .toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
    .replace(",", " ·")
    .toUpperCase();
}

/**
 * A starting estimate from Canvas points. Points loosely track effort within a
 * course; the student is always shown and can edit the number before import.
 */
export function estimateFromPoints(points: number | null | undefined): number {
  if (points == null || points <= 0) return 60;
  if (points <= 10) return 45;
  if (points <= 25) return 60;
  if (points <= 50) return 90;
  if (points <= 100) return 120;
  return 180;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "");
}

export function plural(count: number, word: string, pluralWord = `${word}s`): string {
  return `${count} ${count === 1 ? word : pluralWord}`;
}
