import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { imageForTags, recipeImage } from "../lib/imageHelper";
import type { MealEntry, Recipe } from "../lib/types";

interface DayDef {
  key: string;
  label: string;
}

// Indexed by JS Date.getDay() (0 = Sunday .. 6 = Saturday).
const ALL_DAYS: DayDef[] = [
  { key: "sun", label: "Sunday" },
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
];
const MEALS = ["breakfast", "lunch", "dinner", "snack"];

function weekStartOf(d: Date, startDow: number): Date {
  const x = new Date(d);
  const diff = (x.getDay() - startDow + 7) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function fmtDay(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function mealLabel(meal?: string | null): string {
  return meal ? meal.charAt(0).toUpperCase() + meal.slice(1) : "";
}
function readWeekStartPref(): number {
  const v = parseInt(localStorage.getItem("mp_week_start") ?? "", 10);
  return Number.isInteger(v) && v >= 0 && v <= 6 ? v : 1; // default Monday
}

export default function MealPlanPage() {
  const [weekStartDow, setWeekStartDow] = useState(readWeekStartPref);
  const [weekStart, setWeekStart] = useState(() =>
    weekStartOf(new Date(), readWeekStartPref()),
  );
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  // Add-modal state
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<"recipe" | "item">("recipe");
  const [recipeSearch, setRecipeSearch] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [quickLabel, setQuickLabel] = useState("");
  const [newDay, setNewDay] = useState("");
  const [newMeal, setNewMeal] = useState("");
  const [newWho, setNewWho] = useState("");
  const [newEatOut, setNewEatOut] = useState(false);
  const [newServings, setNewServings] = useState<number | "">("");

  const weekIso = iso(weekStart);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => ALL_DAYS[(weekStartDow + i) % 7]),
    [weekStartDow],
  );

  useEffect(() => {
    api.recipes.list().then(setRecipes).catch(() => setRecipes([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    api.mealPlan
      .get(weekIso)
      .then((res) => setEntries(res.entries || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [weekIso]);

  const save = useCallback(
    (next: MealEntry[]) => {
      setEntries(next);
      api.mealPlan.save(weekIso, next).catch(() => {});
    },
    [weekIso],
  );

  function setWeekStartPref(dow: number) {
    setWeekStartDow(dow);
    localStorage.setItem("mp_week_start", String(dow));
    setWeekStart((w) => weekStartOf(w, dow));
  }
  function shiftWeek(deltaWeeks: number) {
    setWeekStart((w) => {
      const d = new Date(w);
      d.setDate(d.getDate() + deltaWeeks * 7);
      return d;
    });
  }
  function goToThisWeek() {
    setWeekStart(weekStartOf(new Date(), weekStartDow));
  }

  const dayDate = (i: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  };
  const isThisWeek =
    weekStart.getTime() === weekStartOf(new Date(), weekStartDow).getTime();
  const isToday = (i: number) => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return dayDate(i).getTime() === t.getTime();
  };

  const entriesFor = (dayKey: string | null) =>
    entries.filter((e) => (e.day || null) === dayKey);
  const anytime = entriesFor(null);

  const filteredRecipes = () => {
    const q = recipeSearch.trim().toLowerCase();
    const list = q
      ? recipes.filter((r) => r.title.toLowerCase().includes(q))
      : recipes;
    return list.slice(0, 50);
  };

  function openAdd(day: string | null = null) {
    setAddMode("recipe");
    setRecipeSearch("");
    setSelectedRecipe(null);
    setQuickLabel("");
    setNewDay(day || "");
    setNewMeal("");
    setNewWho("");
    setNewEatOut(false);
    setNewServings("");
    setShowAdd(true);
  }
  function selectRecipe(r: Recipe) {
    setSelectedRecipe(r);
    setNewServings(r.servings ?? "");
  }
  const canAdd =
    addMode === "recipe" ? !!selectedRecipe : quickLabel.trim().length > 0;

  function confirmAdd() {
    if (!canAdd) return;
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
    const base = {
      id,
      day: newDay || null,
      meal: newMeal || null,
      who: newWho.trim() || null,
      eat_out: newEatOut,
    };
    const entry: MealEntry =
      addMode === "recipe" && selectedRecipe
        ? {
            ...base,
            recipe_id: selectedRecipe.recipe_id,
            title: selectedRecipe.title,
            tags: selectedRecipe.recipe_tags || [],
            servings: newServings === "" ? null : Number(newServings),
          }
        : { ...base, title: quickLabel.trim(), tags: [] };
    save([...entries, entry]);
    setShowAdd(false);
  }

  function removeEntry(id: string) {
    save(entries.filter((e) => e.id !== id));
  }
  function moveTo(entry: MealEntry, day: string | null) {
    save(entries.map((e) => (e.id === entry.id ? { ...e, day } : e)));
  }
  function clearWeek() {
    if (!entries.length) return;
    if (!window.confirm("Clear all meals planned for this week?")) return;
    save([]);
  }

  function EntryCard({ entry }: { entry: MealEntry }) {
    return (
      <div className="meal-card">
        {entry.recipe_id ? (
          <img
            src={imageForTags(entry.tags, entry.recipe_id || entry.id)}
            alt=""
            className="h-10 w-10 flex-shrink-0 rounded object-cover"
          />
        ) : (
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-gray-100">
            🍴
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1">
            {entry.recipe_id ? (
              <Link
                to={`/recipes/${entry.recipe_id}`}
                className="line-clamp-2 flex-1 text-sm font-semibold leading-snug text-textgray hover:text-accent"
              >
                {entry.title}
              </Link>
            ) : (
              <span className="line-clamp-2 flex-1 text-sm font-semibold leading-snug text-textgray">
                {entry.title}
              </span>
            )}
            <button
              onClick={() => removeEntry(entry.id)}
              className="flex-shrink-0 text-lg leading-none text-gray-300 hover:text-red-600"
              aria-label="Remove"
            >
              ×
            </button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {entry.meal && <span className="badge">{mealLabel(entry.meal)}</span>}
            {entry.servings ? (
              <span className="badge">serves {entry.servings}</span>
            ) : null}
            {entry.who && <span className="badge">👤 {entry.who}</span>}
            {entry.eat_out && <span className="badge">🍴 Out</span>}
            <select
              value={entry.day || ""}
              onChange={(e) => moveTo(entry, e.target.value || null)}
              className="ml-auto rounded border border-gray-200 bg-white px-1 py-0.5 text-xs text-gray-500"
              title="Move to day"
              aria-label="Move to day"
            >
              <option value="">Anytime</option>
              {days.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label.slice(0, 3)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="heading-primary">Meal Plan</h1>
        <div className="flex gap-2">
          <Link
            to={`/shopping-list?week=${weekIso}`}
            className="inline-flex items-center gap-1 rounded border border-textgray px-4 py-2 text-sm font-semibold text-textgray transition hover:border-accent hover:bg-accent"
          >
            🛒 Shopping list
          </Link>
          <button onClick={() => openAdd()} className="button-primary">
            + Add to plan
          </button>
        </div>
      </div>

      {/* Week navigator */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftWeek(-1)}
            className="h-8 w-8 rounded-full border border-gray-300 text-textgray hover:bg-gray-100"
            aria-label="Previous week"
          >
            ‹
          </button>
          <div className="min-w-[8.5rem] text-center">
            <div className="font-semibold text-textgray">
              {fmtDay(weekStart)} – {fmtDay(dayDate(6))}
            </div>
            {isThisWeek && <div className="text-xs text-gray-400">This week</div>}
          </div>
          <button
            onClick={() => shiftWeek(1)}
            className="h-8 w-8 rounded-full border border-gray-300 text-textgray hover:bg-gray-100"
            aria-label="Next week"
          >
            ›
          </button>
          {!isThisWeek && (
            <button
              onClick={goToThisWeek}
              className="ml-1 text-sm font-semibold text-accent hover:underline"
            >
              Today
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-sm text-gray-500">
            Week starts
            <select
              value={weekStartDow}
              onChange={(e) => setWeekStartPref(Number(e.target.value))}
              className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-sm text-textgray"
              aria-label="Day the week starts on"
            >
              {ALL_DAYS.map((d, i) => (
                <option key={d.key} value={i}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          {entries.length > 0 && (
            <button
              onClick={clearWeek}
              className="text-sm text-gray-500 hover:text-red-600"
            >
              Clear week
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="py-12 text-center text-gray-400">Loading…</div>
      )}

      {!loading && entries.length === 0 && (
        <div className="mx-auto max-w-md py-16 text-center">
          <div className="mb-3 text-5xl">🗓️</div>
          <p className="mb-1 text-lg font-semibold text-textgray">
            Nothing planned yet
          </p>
          <p className="mb-6 text-sm text-gray-500">
            Add what you’re cooking or eating this week — recipes from your
            cookbook or quick items like “Pizza out”.
          </p>
          <button onClick={() => openAdd()} className="button-primary">
            + Add to plan
          </button>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div>
          <section className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-textgray">
                ★ Anytime this week
              </h2>
              <button
                onClick={() => openAdd(null)}
                className="text-sm font-semibold text-accent hover:underline"
              >
                + Add
              </button>
            </div>
            {anytime.length ? (
              <div className="flex flex-wrap gap-2">
                {anytime.map((e) => (
                  <EntryCard key={e.id} entry={e} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                Loose ideas with no set day land here.
              </p>
            )}
          </section>

          {days.map((d, i) => (
            <section key={d.key} className="border-t border-gray-200 py-3">
              <div className="flex items-start gap-4">
                <div className="w-24 flex-shrink-0 pt-1 sm:w-28">
                  <div
                    className={`font-semibold ${
                      isToday(i) ? "text-accent" : "text-textgray"
                    }`}
                  >
                    {d.label}
                  </div>
                  <div
                    className={`text-xs ${
                      isToday(i) ? "text-accent" : "text-gray-400"
                    }`}
                  >
                    {fmtDay(dayDate(i))}
                  </div>
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  {!entriesFor(d.key).length && (
                    <span className="text-xs text-gray-300">nothing planned</span>
                  )}
                  {entriesFor(d.key).map((e) => (
                    <EntryCard key={e.id} entry={e} />
                  ))}
                  <button
                    onClick={() => openAdd(d.key)}
                    className="rounded border border-dashed border-gray-300 px-2 py-1 text-sm text-gray-400 hover:border-accent hover:text-accent"
                  >
                    + add
                  </button>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-textgray">
              Add to meal plan
            </h3>

            <div className="mb-4 inline-flex rounded-full bg-gray-200 p-1">
              {(["recipe", "item"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setAddMode(m)}
                  className={`rounded-full px-3 py-1 text-sm transition ${
                    addMode === m
                      ? "bg-white font-semibold shadow"
                      : "text-gray-500"
                  }`}
                >
                  {m === "recipe" ? "From my recipes" : "Quick item"}
                </button>
              ))}
            </div>

            {addMode === "recipe" ? (
              <div>
                <input
                  value={recipeSearch}
                  onChange={(e) => setRecipeSearch(e.target.value)}
                  placeholder="Search your recipes"
                  className="form-input mb-2 w-full"
                />
                <div className="max-h-48 divide-y overflow-y-auto rounded border border-gray-200">
                  {filteredRecipes().map((r) => (
                    <button
                      key={r.recipe_id}
                      onClick={() => selectRecipe(r)}
                      className={`flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-50 ${
                        selectedRecipe?.recipe_id === r.recipe_id
                          ? "bg-gray-100"
                          : ""
                      }`}
                    >
                      <img
                        src={recipeImage(r)}
                        alt=""
                        className="h-7 w-7 flex-shrink-0 rounded object-cover"
                      />
                      <span className="truncate text-sm">{r.title}</span>
                      {selectedRecipe?.recipe_id === r.recipe_id && (
                        <span className="ml-auto font-bold text-accent">✓</span>
                      )}
                    </button>
                  ))}
                  {!filteredRecipes().length && (
                    <p className="px-2 py-3 text-center text-sm text-gray-400">
                      No recipes found.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <input
                value={quickLabel}
                onChange={(e) => setQuickLabel(e.target.value)}
                placeholder="e.g. Pizza out, School lunch, Leftovers"
                className="form-input w-full"
              />
            )}

            {addMode === "recipe" && (
              <div className="mt-4 flex items-center gap-2">
                <label className="text-sm text-textgray">Servings</label>
                <input
                  type="number"
                  min={1}
                  value={newServings}
                  onChange={(e) =>
                    setNewServings(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  placeholder="—"
                  className="form-input w-24"
                />
                <span className="text-xs text-gray-400">
                  scales the shopping list
                </span>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-sm text-textgray">
                Day
                <select
                  value={newDay}
                  onChange={(e) => setNewDay(e.target.value)}
                  className="form-input mt-1 w-full"
                >
                  <option value="">Anytime</option>
                  {days.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-textgray">
                Meal
                <select
                  value={newMeal}
                  onChange={(e) => setNewMeal(e.target.value)}
                  className="form-input mt-1 w-full"
                >
                  <option value="">—</option>
                  {MEALS.map((m) => (
                    <option key={m} value={m}>
                      {mealLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-textgray">
                Who (optional)
                <input
                  value={newWho}
                  onChange={(e) => setNewWho(e.target.value)}
                  placeholder="e.g. Kids"
                  className="form-input mt-1 w-full"
                />
              </label>
              <label className="mt-6 flex items-center gap-2 text-sm text-textgray">
                <input
                  type="checkbox"
                  checked={newEatOut}
                  onChange={(e) => setNewEatOut(e.target.checked)}
                />
                Eating out
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="rounded px-4 py-2 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmAdd}
                disabled={!canAdd}
                className="button-primary disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
