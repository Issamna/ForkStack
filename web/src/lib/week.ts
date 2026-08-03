export interface DayDef {
  key: string;
  label: string;
}

/** Indexed by JS `Date.getDay()` (0 = Sunday .. 6 = Saturday). */
export const ALL_DAYS: DayDef[] = [
  { key: "sun", label: "Sunday" },
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
];

export const MEALS = ["breakfast", "lunch", "dinner", "snack"];

export function weekStartOf(d: Date, startDow: number): Date {
  const x = new Date(d);
  const diff = (x.getDay() - startDow + 7) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fmtDay(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function mealLabel(meal?: string | null): string {
  return meal ? meal.charAt(0).toUpperCase() + meal.slice(1) : "";
}

/**
 * The user's week-start preference (0 = Sunday). Held in localStorage by the
 * meal plan screen; read here so every screen agrees on which week is "this
 * week" -- the library's plan strip must match the meal plan exactly.
 */
export function readWeekStartPref(): number {
  const v = parseInt(localStorage.getItem("mp_week_start") ?? "", 10);
  return Number.isInteger(v) && v >= 0 && v <= 6 ? v : 1; // default Monday
}

/** ISO date of the start of the week containing today. */
export function currentWeekIso(): string {
  return iso(weekStartOf(new Date(), readWeekStartPref()));
}

/** Short uppercase day chip label, e.g. "MON". */
export function dayChip(dayKey?: string | null): string | null {
  return dayKey ? dayKey.slice(0, 3).toUpperCase() : null;
}
