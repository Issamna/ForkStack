import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { recipeImage } from "../lib/imageHelper";
import { CATEGORY_ORDER, categoryLabel } from "../lib/categories";
import type { MealEntry, Recipe, ShoppingItem } from "../lib/types";
import {
  ALL_DAYS,
  MEALS,
  fmtDay,
  iso,
  mealLabel,
  readWeekStartPref,
  weekStartOf,
} from "../lib/week";

export default function MealPlanPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [weekStartDow, setWeekStartDow] = useState(readWeekStartPref);
  const [weekStart, setWeekStart] = useState(() =>
    weekStartOf(new Date(), readWeekStartPref()),
  );
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [listItems, setListItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Which day the phone layout shows; desktop shows all seven at once.
  const [mobileDay, setMobileDay] = useState(0);

  // Add-dialog state
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<"recipe" | "item">("recipe");
  const [recipeSearch, setRecipeSearch] = useState("");
  const [railSearch, setRailSearch] = useState("");
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
    api.shoppingList
      .get(weekIso)
      .then((res) => setListItems(res.items || []))
      .catch(() => setListItems([]));
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

  const openAdd = useCallback((day: string | null = null) => {
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
  }, []);

  // The shell header's "+ Add to plan" links here with ?add=1.
  useEffect(() => {
    if (searchParams.get("add") !== "1") return;
    openAdd();
    const next = new URLSearchParams(searchParams);
    next.delete("add");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, openAdd]);

  function selectRecipe(r: Recipe) {
    setSelectedRecipe(r);
    setNewServings(r.servings ?? "");
  }
  const canAdd =
    addMode === "recipe" ? !!selectedRecipe : quickLabel.trim().length > 0;

  function newId(): string {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function confirmAdd() {
    if (!canAdd) return;
    const base = {
      id: newId(),
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
  /** Rail quick add: straight onto the week with no day set. */
  function quickAdd(r: Recipe) {
    save([
      ...entries,
      {
        id: newId(),
        day: null,
        meal: null,
        who: null,
        eat_out: false,
        recipe_id: r.recipe_id,
        title: r.title,
        tags: r.recipe_tags || [],
        servings: r.servings ?? null,
      },
    ]);
  }

  const plannedCount = entries.filter((e) => !e.eat_out).length;
  const outstanding = listItems.filter((i) => !i.removed && !i.checked);

  const aisles = useMemo(() => {
    const counts = new Map<string, number>();
    outstanding.forEach((i) => {
      const k = i.category || "other";
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    return CATEGORY_ORDER.filter((c) => counts.has(c)).map((c) => ({
      key: c,
      label: categoryLabel(c),
      count: counts.get(c)!,
    }));
  }, [outstanding]);

  // Recipes not already on the week, so the rail always offers something new.
  const railSuggestions = useMemo(() => {
    const planned = new Set(entries.map((e) => e.recipe_id).filter(Boolean));
    const q = railSearch.trim().toLowerCase();
    return recipes
      .filter((r) => !planned.has(r.recipe_id))
      .filter((r) => (q ? r.title.toLowerCase().includes(q) : true))
      .slice(0, 3);
  }, [recipes, entries, railSearch]);

  function EntryCard({ entry }: { entry: MealEntry }) {
    if (entry.eat_out) {
      return (
        <div className="rounded-tile border border-terracotta-line bg-terracotta-tint p-2">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-terracotta">
              Eating out
            </span>
            <button
              onClick={() => removeEntry(entry.id)}
              aria-label={`Remove ${entry.title}`}
              className="leading-none text-muted-2 transition hover:text-danger"
            >
              ×
            </button>
          </div>
          <div className="mt-0.5 font-serif text-[14px] font-semibold text-primary">
            {entry.title}
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-tile border border-line bg-card p-2">
        <div className="relative">
          <img
            src={recipeImage({
              recipe_tags: entry.tags,
              recipe_id: entry.recipe_id || entry.id,
            })}
            alt=""
            className="h-[54px] w-full rounded object-cover"
          />
          <button
            onClick={() => removeEntry(entry.id)}
            aria-label={`Remove ${entry.title}`}
            className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-paper/90 text-[13px] leading-none text-muted transition hover:text-danger"
          >
            ×
          </button>
        </div>
        {entry.recipe_id ? (
          <Link
            to={`/recipes/${entry.recipe_id}`}
            className="mt-1.5 line-clamp-2 block font-serif text-[14px] font-semibold leading-snug text-primary hover:text-terracotta"
          >
            {entry.title}
          </Link>
        ) : (
          <span className="mt-1.5 line-clamp-2 block font-serif text-[14px] font-semibold leading-snug text-primary">
            {entry.title}
          </span>
        )}
        {(entry.meal || entry.servings || entry.who) && (
          <div className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.05em] text-sage">
            {[mealLabel(entry.meal), entry.servings, entry.who]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}
        <select
          value={entry.day || ""}
          onChange={(e) => moveTo(entry, e.target.value || null)}
          aria-label={`Move ${entry.title} to a day`}
          className="mt-1.5 w-full rounded border border-line-soft bg-card px-1 py-0.5 text-[11px] text-muted"
        >
          <option value="">Anytime</option>
          {days.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label.slice(0, 3)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const AddButton = ({ day, label }: { day: string | null; label: string }) => (
    <button
      onClick={() => openAdd(day)}
      className="min-h-[44px] w-full rounded-tile border border-dashed border-terracotta-line py-2 text-[12px] font-semibold text-terracotta transition hover:bg-terracotta-tint lg:min-h-0"
    >
      {label}
    </button>
  );

  return (
    <div className="px-4 pb-24 pt-4 sm:px-[22px] lg:pb-10">
      {/* Week navigator */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => shiftWeek(-1)}
            aria-label="Previous week"
            className="icon-pill h-[30px] w-[30px]"
          >
            ‹
          </button>
          <div className="text-center">
            <div className="font-serif text-[22px] font-semibold text-primary sm:text-[26px]">
              {fmtDay(weekStart)} – {fmtDay(dayDate(6))}
            </div>
            {isThisWeek ? (
              <div className="meta">This week</div>
            ) : (
              <button
                onClick={goToThisWeek}
                className="text-[12px] font-semibold text-terracotta hover:underline"
              >
                Back to this week
              </button>
            )}
          </div>
          <button
            onClick={() => shiftWeek(1)}
            aria-label="Next week"
            className="icon-pill h-[30px] w-[30px]"
          >
            ›
          </button>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-[13px] text-muted">
            Week starts
            <select
              value={weekStartDow}
              onChange={(e) => setWeekStartPref(Number(e.target.value))}
              aria-label="Day the week starts on"
              className="rounded border border-field bg-card px-1.5 py-1 text-[13px] text-primary"
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
              className="text-[13px] text-muted transition hover:text-danger"
            >
              Clear week
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="card-surface mt-4 p-10 text-center">
          <p className="meta">Loading your plan…</p>
        </div>
      )}

      {!loading && (
        <div className="mt-4 flex flex-col gap-4 xl:flex-row">
          <div className="min-w-0 flex-1">
            {/* Anytime lane */}
            <section className="card-surface flex flex-col gap-3 p-3 sm:flex-row">
              <div className="w-full flex-shrink-0 sm:w-[120px]">
                <div className="eyebrow">★ Anytime</div>
                <div className="meta">no set day</div>
              </div>
              <div className="grid flex-1 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {anytime.map((e) => (
                  <EntryCard key={e.id} entry={e} />
                ))}
                <div className="self-start">
                  <AddButton day={null} label="+ Add" />
                </div>
              </div>
            </section>

            {/* Day strip (phone) */}
            <div className="mt-4 grid grid-cols-7 gap-1 lg:hidden">
              {days.map((d, i) => (
                <button
                  key={d.key}
                  onClick={() => setMobileDay(i)}
                  className={`flex min-h-[52px] flex-col items-center justify-center rounded-tile border text-[11px] font-bold transition ${
                    mobileDay === i
                      ? "border-terracotta bg-terracotta text-white"
                      : isToday(i)
                        ? "border-terracotta-line bg-card text-terracotta"
                        : "border-line bg-card text-muted"
                  }`}
                >
                  <span>{d.label.slice(0, 3).toUpperCase()}</span>
                  <span className="font-medium opacity-80">
                    {dayDate(i).getDate()}
                  </span>
                </button>
              ))}
            </div>

            {/* One day (phone) */}
            <section className="mt-3 space-y-2 lg:hidden">
              {entriesFor(days[mobileDay].key).map((e) => (
                <EntryCard key={e.id} entry={e} />
              ))}
              <AddButton
                day={days[mobileDay].key}
                label={`+ Add to ${days[mobileDay].label}`}
              />
            </section>

            {/* Week grid (desktop) */}
            <section className="mt-4 hidden grid-cols-7 gap-2 lg:grid">
              {days.map((d, i) => (
                <div
                  key={d.key}
                  className="flex flex-col gap-2 rounded-[11px] border border-line bg-card px-2 py-2.5"
                >
                  <div>
                    <div
                      className={`text-[13px] font-bold ${
                        isToday(i) ? "text-terracotta" : "text-primary"
                      }`}
                    >
                      {d.label.slice(0, 3)}
                    </div>
                    <div className="meta">{dayDate(i).getDate()}</div>
                  </div>
                  {entriesFor(d.key).map((e) => (
                    <EntryCard key={e.id} entry={e} />
                  ))}
                  <div className="mt-auto">
                    <AddButton day={d.key} label="+" />
                  </div>
                </div>
              ))}
            </section>
          </div>

          {/* Rail */}
          <aside className="w-full flex-shrink-0 space-y-3 xl:w-[280px]">
            <div className="panel-dark p-4">
              <h2 className="font-serif text-[19px] font-semibold">
                {outstanding.length} to buy
              </h2>
              <p className="text-[12px] text-accent">
                from {plannedCount} planned meal{plannedCount === 1 ? "" : "s"}
              </p>
              <ul className="mt-3 space-y-1.5">
                {aisles.map((a) => (
                  <li
                    key={a.key}
                    className="flex justify-between text-[13px] text-paper/90"
                  >
                    <span>{a.label}</span>
                    <span className="text-accent">{a.count}</span>
                  </li>
                ))}
                {!aisles.length && (
                  <li className="text-[13px] text-paper/70">
                    Nothing on the list yet.
                  </li>
                )}
              </ul>
              <Link
                to={`/shopping-list?week=${weekIso}`}
                className="pill-accent mt-4 w-full"
              >
                Open shopping list →
              </Link>
            </div>

            <div className="card-surface p-4">
              <h2 className="font-serif text-[19px] font-semibold text-primary">
                Quick add
              </h2>
              <input
                value={railSearch}
                onChange={(e) => setRailSearch(e.target.value)}
                placeholder="Search your recipes"
                aria-label="Search recipes to add"
                className="search-pill mt-2.5"
              />
              <ul className="mt-2.5 space-y-1">
                {railSuggestions.map((r) => (
                  <li key={r.recipe_id}>
                    <button
                      onClick={() => quickAdd(r)}
                      className="flex min-h-[44px] w-full items-center gap-2.5 rounded-tile px-1.5 py-1.5 text-left transition hover:bg-paper"
                    >
                      <img
                        src={recipeImage(r)}
                        alt=""
                        className="h-[34px] w-[34px] flex-shrink-0 rounded object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-serif text-[14px] font-semibold text-primary">
                          {r.title}
                        </span>
                        {r.total_time ? (
                          <span className="meta block">{r.total_time} min</span>
                        ) : null}
                      </span>
                      <span className="text-[18px] leading-none text-terracotta">
                        +
                      </span>
                    </button>
                  </li>
                ))}
                {!railSuggestions.length && (
                  <li className="meta px-1.5">
                    {railSearch
                      ? "No matches."
                      : "Everything you have is already planned."}
                  </li>
                )}
              </ul>
            </div>
          </aside>
        </div>
      )}

      {/* Sticky footer (phone) */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 bg-primary px-4 pt-3 lg:hidden">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-paper">
            {outstanding.length} items to buy
          </div>
          <div className="text-[11px] text-accent">
            from {plannedCount} planned meal{plannedCount === 1 ? "" : "s"}
          </div>
        </div>
        <Link
          to={`/shopping-list?week=${weekIso}`}
          className="pill-accent flex-shrink-0"
        >
          Shopping list
        </Link>
      </div>

      {/* Add dialog */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-primary/30 p-4 sm:items-center">
          <div className="card-surface flex max-h-[85vh] w-full max-w-md flex-col p-5">
            <h2 className="font-serif text-[20px] font-semibold text-primary">
              Add to plan
            </h2>

            <div className="mt-3 flex gap-1.5">
              {(["recipe", "item"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setAddMode(m)}
                  className={`chip ${addMode === m ? "chip-active" : ""}`}
                >
                  {m === "recipe" ? "From my recipes" : "Quick item"}
                </button>
              ))}
            </div>

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
              {addMode === "recipe" ? (
                <>
                  <input
                    value={recipeSearch}
                    onChange={(e) => setRecipeSearch(e.target.value)}
                    placeholder="Search your recipes"
                    aria-label="Search recipes"
                    className="search-pill"
                  />
                  <ul className="mt-2 space-y-0.5">
                    {recipes
                      .filter((r) =>
                        recipeSearch.trim()
                          ? r.title
                              .toLowerCase()
                              .includes(recipeSearch.trim().toLowerCase())
                          : true,
                      )
                      .slice(0, 50)
                      .map((r) => (
                        <li key={r.recipe_id}>
                          <button
                            onClick={() => selectRecipe(r)}
                            className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-tile px-2 py-1.5 text-left transition hover:bg-paper ${
                              selectedRecipe?.recipe_id === r.recipe_id
                                ? "border border-terracotta-line bg-terracotta-tint"
                                : ""
                            }`}
                          >
                            <img
                              src={recipeImage(r)}
                              alt=""
                              className="h-7 w-7 flex-shrink-0 rounded object-cover"
                            />
                            <span className="truncate text-[14px] text-primary">
                              {r.title}
                            </span>
                            {selectedRecipe?.recipe_id === r.recipe_id && (
                              <span className="ml-auto font-bold text-terracotta">
                                ✓
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    {!recipes.length && (
                      <li className="meta px-2 py-3 text-center">
                        No recipes found.
                      </li>
                    )}
                  </ul>
                </>
              ) : (
                <input
                  value={quickLabel}
                  onChange={(e) => setQuickLabel(e.target.value)}
                  placeholder="e.g. Pizza out, School lunch, Leftovers"
                  aria-label="What are you having?"
                  className="form-input w-full"
                />
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line-soft pt-3">
              <label className="text-[12px] text-muted">
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
              <label className="text-[12px] text-muted">
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
              <label className="text-[12px] text-muted">
                Who (optional)
                <input
                  value={newWho}
                  onChange={(e) => setNewWho(e.target.value)}
                  placeholder="e.g. Kids"
                  className="form-input mt-1 w-full"
                />
              </label>
              {addMode === "recipe" && (
                <label className="text-[12px] text-muted">
                  Serves
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
                    className="form-input mt-1 w-full"
                  />
                </label>
              )}
              <label className="col-span-2 flex items-center gap-2 text-[13px] text-textgray">
                <input
                  type="checkbox"
                  checked={newEatOut}
                  onChange={(e) => setNewEatOut(e.target.checked)}
                  className="h-[17px] w-[17px] accent-accent"
                />
                Eating out (kept off the shopping list)
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="pill-outline">
                Cancel
              </button>
              <button
                onClick={confirmAdd}
                disabled={!canAdd}
                className="pill-primary"
              >
                Add to plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
