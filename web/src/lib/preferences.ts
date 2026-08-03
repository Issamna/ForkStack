/**
 * Cooking preferences.
 *
 * Held in localStorage, not on the server: there is no user-preferences
 * endpoint, and Clerk owns identity. That means they are per-device, which the
 * account screen says out loud rather than implying they follow the account.
 *
 * Every preference here changes something. Don't add one that nothing reads.
 */

const KEYS = {
  weekStart: "mp_week_start", // read by the meal plan and shopping list
  defaultServings: "fs_default_servings",
  defaultPublic: "fs_default_public",
  listView: "fs_list_view",
} as const;

export type ListView = "aisle" | "recipe";

export function getDefaultServings(): number | "" {
  const v = parseInt(localStorage.getItem(KEYS.defaultServings) ?? "", 10);
  return Number.isInteger(v) && v > 0 ? v : "";
}
export function setDefaultServings(v: number | "") {
  if (v === "") localStorage.removeItem(KEYS.defaultServings);
  else localStorage.setItem(KEYS.defaultServings, String(v));
}

export function getDefaultPublic(): boolean {
  return localStorage.getItem(KEYS.defaultPublic) === "1";
}
export function setDefaultPublic(v: boolean) {
  localStorage.setItem(KEYS.defaultPublic, v ? "1" : "0");
}

export function getListView(): ListView {
  return localStorage.getItem(KEYS.listView) === "recipe" ? "recipe" : "aisle";
}
export function setListView(v: ListView) {
  localStorage.setItem(KEYS.listView, v);
}

export function setWeekStart(dow: number) {
  localStorage.setItem(KEYS.weekStart, String(dow));
}
