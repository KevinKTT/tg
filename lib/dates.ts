export function todayISO(timeZone = process.env["TZ"]): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso: string, days: number): string {
  const date = parseISO(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

export function startOfWeek(iso: string): string {
  const date = parseISO(iso);
  const pad = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - pad);
  return toISO(date);
}

export function weekDates(anchor: string): string[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseISO(value);
  return toISO(date) === value;
}

export function formatLong(iso: string): string {
  return parseISO(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function formatShort(iso: string): string {
  return parseISO(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function weekdayShort(iso: string): string {
  return parseISO(iso).toLocaleDateString("en-US", { weekday: "short" });
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function monthMatrix(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const pad = (first.getDay() + 6) % 7;
  const days = new Date(year, month, 0).getDate();
  const cells: { iso: string; inMonth: boolean }[] = [];
  for (let i = 0; i < pad; i++) {
    cells.push({
      iso: toISO(new Date(year, month - 1, 1 - (pad - i))),
      inMonth: false,
    });
  }
  for (let day = 1; day <= days; day++) {
    cells.push({ iso: toISO(new Date(year, month - 1, day)), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ iso: addDays(cells[cells.length - 1].iso, 1), inMonth: false });
  }
  return cells;
}

export function monthBounds(year: number, month: number) {
  const start = toISO(new Date(year, month - 1, 1));
  const end = toISO(new Date(year, month, 0));
  return { start, end };
}
