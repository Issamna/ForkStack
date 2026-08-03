import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../lib/api";
import { recipeImage } from "../lib/imageHelper";
import { normalizeName, scaleQuantity } from "../lib/quantity";
import type { MealEntry, Recipe, ShoppingItem } from "../lib/types";
import {
  ALL_DAYS,
  MEALS,
  currentWeekIso,
  dayChip,
  mealLabel,
} from "../lib/week";

type Scope = "mine" | "shared" | "discover";
const SCALES = [0.5, 1, 2, 3];
const base = import.meta.env.BASE_URL;

/** "35 min · serves 4 · Pasta" — every part is optional. */
function metaLine(r: Recipe): string {
  return [
    r.total_time ? `${r.total_time} min` : null,
    r.servings ? `serves ${r.servings}` : null,
    r.recipe_tags?.[0] ?? null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function RecipesPage() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const weekIso = useMemo(currentWeekIso, []);

  const [all, setAll] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<Scope>("mine");
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [planEntries, setPlanEntries] = useState<MealEntry[]>([]);
  const [listItems, setListItems] = useState<ShoppingItem[]>([]);

  const [planningFor, setPlanningFor] = useState<Recipe | null>(null);
  const [planDay, setPlanDay] = useState("");
  const [planMeal, setPlanMeal] = useState("dinner");
  const [planSaving, setPlanSaving] = useState(false);

  const filterRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    api.recipes
      .list()
      .then(setAll)
      .catch(() => setAll([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.mealPlan
      .get(weekIso)
      .then((r) => setPlanEntries(r.entries || []))
      .catch(() => setPlanEntries([]));
    api.shoppingList
      .get(weekIso)
      .then((r) => setListItems(r.items || []))
      .catch(() => setListItems([]));
  }, [weekIso]);

  const counts = useMemo(
    () => ({
      mine: all.filter((r) => r.owner_id === userId).length,
      shared: all.filter((r) => r.owner_id === userId && r.is_shareable).length,
      discover: all.filter((r) => r.is_shareable && r.owner_id !== userId)
        .length,
    }),
    [all, userId],
  );

  const visible = useMemo(() => {
    const scoped = all.filter((r) =>
      scope === "mine"
        ? r.owner_id === userId
        : scope === "shared"
          ? r.owner_id === userId && r.is_shareable
          : r.is_shareable && r.owner_id !== userId,
    );
    const q = filter.trim().toLowerCase();
    const matched = q
      ? scoped.filter((r) => r.title.toLowerCase().includes(q))
      : scoped;
    return [...matched].sort((a, b) => a.title.localeCompare(b.title));
  }, [all, scope, filter, userId]);

  /** recipe_id -> first planned day this week, for the day chip on a row. */
  const plannedDay = useMemo(() => {
    const map = new Map<string, string>();
    planEntries.forEach((e) => {
      if (e.recipe_id && e.day && !map.has(e.recipe_id)) {
        map.set(e.recipe_id, e.day);
      }
    });
    return map;
  }, [planEntries]);

  // Two-tier index: the week's planned recipes first, then A-Z. The design's
  // first group is "RECENT", but recipes carry no created_at, so this uses the
  // plan -- real data -- rather than inventing a recency order.
  const groups = useMemo(() => {
    const planned = visible.filter((r) => plannedDay.has(r.recipe_id));
    const out: { label: string; rows: Recipe[] }[] = [];
    if (planned.length) out.push({ label: "This week", rows: planned });

    const byLetter = new Map<string, Recipe[]>();
    visible.forEach((r) => {
      const letter = (r.title[0] || "#").toUpperCase();
      if (!byLetter.has(letter)) byLetter.set(letter, []);
      byLetter.get(letter)!.push(r);
    });
    [...byLetter.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([letter, rows], i) => {
        out.push({ label: i === 0 ? `All recipes · ${letter}` : letter, rows });
      });
    return out;
  }, [visible, plannedDay]);

  /** Flattened row order — what the arrow keys walk. */
  const ordered = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

  const selected = useMemo(
    () => visible.find((r) => r.recipe_id === selectedId) ?? null,
    [visible, selectedId],
  );

  // Keep a selection that survives filtering; default to the first row.
  useEffect(() => {
    if (loading) return;
    if (!visible.some((r) => r.recipe_id === selectedId)) {
      setSelectedId(visible[0]?.recipe_id ?? null);
    }
  }, [visible, selectedId, loading]);

  useEffect(() => setScale(1), [selectedId]);

  const openSelected = useCallback(() => {
    if (selected) navigate(`/recipes/${selected.recipe_id}`);
  }, [selected, navigate]);

  const startPlanning = useCallback((r: Recipe | null) => {
    if (!r) return;
    setPlanningFor(r);
    setPlanDay("");
    setPlanMeal("dinner");
  }, []);

  const move = useCallback(
    (delta: number) => {
      if (!ordered.length) return;
      const i = ordered.findIndex((r) => r.recipe_id === selectedId);
      const next = Math.min(
        Math.max((i < 0 ? 0 : i) + delta, 0),
        ordered.length - 1,
      );
      setSelectedId(ordered[next].recipe_id);
    },
    [ordered, selectedId],
  );

  // Keyboard: ↑ ↓ move · ↵ open · p add to plan · / focus filter.
  // Ignored while a field has focus, so typing in the filter still works.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable);

      if (e.key === "/" && !typing) {
        e.preventDefault();
        filterRef.current?.focus();
        return;
      }
      if (typing) {
        if (e.key === "Escape") el?.blur();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        move(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "Enter") {
        openSelected();
      } else if (e.key === "p" || e.key === "P") {
        startPlanning(selected);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, openSelected, startPlanning, selected]);

  async function confirmPlan() {
    if (!planningFor) return;
    setPlanSaving(true);
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36);
    const entry: MealEntry = {
      id,
      recipe_id: planningFor.recipe_id,
      title: planningFor.title,
      tags: planningFor.recipe_tags || [],
      day: planDay || null,
      meal: planMeal || null,
      who: null,
      eat_out: false,
      servings: planningFor.servings ?? null,
    };
    try {
      const res = await api.mealPlan.save(weekIso, [...planEntries, entry]);
      setPlanEntries(res.entries || []);
      setPlanningFor(null);
    } finally {
      setPlanSaving(false);
    }
  }

  // "7 of 12 already on this week's shopping list" — matched by loose
  // canonical name against the live list, so it stays honest if the list moves.
  const listOverlap = useMemo(() => {
    if (!selected) return null;
    const onList = new Set(
      listItems.filter((i) => !i.removed).map((i) => normalizeName(i.name)),
    );
    if (!onList.size) return null;
    const names = selected.ingredients.map((i) => normalizeName(i.name));
    const hit = names.filter((n) => n && onList.has(n)).length;
    return hit ? { hit, total: names.length } : null;
  }, [selected, listItems]);

  const plannedCount = planEntries.filter((e) => !e.eat_out).length;
  const toBuy = listItems.filter((i) => !i.removed && !i.checked).length;

  return (
    <div className="px-4 pb-10 sm:px-[22px]">
      {/* Cooking this week */}
      {planEntries.length > 0 && (
        <section className="panel-dark mt-3.5 flex flex-col gap-3 p-3 px-4 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex-shrink-0">
            <h2 className="font-serif text-[18px] font-semibold">
              Cooking this week
            </h2>
            <p className="text-[12px] text-accent">
              {plannedCount} planned · {toBuy} to buy
            </p>
          </div>
          <div className="grid flex-1 gap-2 sm:grid-cols-3">
            {planEntries.slice(0, 3).map((e) => (
              <div
                key={e.id}
                className="flex min-w-0 items-center gap-2 rounded-tile bg-white/[0.08] px-2.5 py-2"
              >
                <img
                  src={recipeImage({
                    recipe_tags: e.tags,
                    recipe_id: e.recipe_id || e.id,
                  })}
                  alt=""
                  className="h-8 w-8 flex-shrink-0 rounded object-cover"
                />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-accent">
                    {[dayChip(e.day) ?? "Anytime", mealLabel(e.meal)]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div className="truncate text-[13px]">{e.title}</div>
                </div>
              </div>
            ))}
          </div>
          <Link to="/meal-plan" className="pill-accent flex-shrink-0">
            Open plan →
          </Link>
        </section>
      )}

      <div className="mt-3.5 flex flex-col gap-4 lg:flex-row">
        {/* ---------------- Index column ---------------- */}
        <section className="card-surface flex w-full flex-col overflow-hidden lg:w-[392px] lg:flex-shrink-0">
          <div className="border-b border-line-soft p-3">
            <div className="relative">
              <input
                ref={filterRef}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={`Filter ${visible.length} recipes`}
                aria-label="Filter recipes"
                className="search-pill pr-10"
              />
              <span className="kbd-hint pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
                /
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5">
              {(
                [
                  ["mine", `Mine ${counts.mine}`],
                  ["shared", `Shared ${counts.shared}`],
                  ["discover", "Discover"],
                ] as [Scope, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setScope(key)}
                  className={`chip ${scope === key ? "chip-active" : ""}`}
                >
                  {label}
                </button>
              ))}
              <span className="meta ml-auto">A–Z</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2 lg:max-h-[calc(100vh-230px)]">
            {loading && (
              /* Skeleton rows, not centred "Loading…" text. */
              <div className="space-y-2 p-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-1 py-2">
                    <div className="h-[42px] w-[42px] flex-shrink-0 animate-pulse rounded-tile bg-line-list" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/3 animate-pulse rounded bg-line-list" />
                      <div className="h-2.5 w-1/3 animate-pulse rounded bg-line-list" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && !visible.length && (
              <div className="px-4 py-10 text-center">
                <img
                  src={`${base}assets/logo.png`}
                  alt=""
                  className="mx-auto mb-3 h-12 w-12 opacity-40"
                />
                {filter ? (
                  <p className="meta">Nothing matches “{filter}”.</p>
                ) : scope === "discover" ? (
                  <p className="meta">
                    Check back later for recipes shared by the community.
                  </p>
                ) : (
                  <>
                    <p className="mb-1 font-serif text-[17px] font-semibold text-primary">
                      Your cookbook is empty
                    </p>
                    <p className="meta mb-4">
                      Add your first recipe to get started.
                    </p>
                    <Link to="/recipes/new" className="pill-primary">
                      Create recipe
                    </Link>
                  </>
                )}
              </div>
            )}

            {!loading &&
              groups.map((group) => (
                <div key={group.label}>
                  <div className="eyebrow px-3 pb-1 pt-3">{group.label}</div>
                  {group.rows.map((r) => {
                    const isSelected = r.recipe_id === selectedId;
                    const chip = dayChip(plannedDay.get(r.recipe_id));
                    return (
                      <button
                        key={r.recipe_id}
                        onClick={() => {
                          setSelectedId(r.recipe_id);
                          setSheetOpen(true);
                        }}
                        aria-current={isSelected}
                        className={`index-row ${isSelected ? "index-row-selected" : ""}`}
                      >
                        <img
                          src={recipeImage(r)}
                          alt=""
                          className="index-thumb"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="index-title block">{r.title}</span>
                          <span className="meta block truncate">
                            {metaLine(r)}
                          </span>
                        </span>
                        {chip && <span className="chip-planned">{chip}</span>}
                        {isSelected && (
                          <span className="kbd-hint hidden lg:inline">↵</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
          </div>
        </section>

        {/* ---------------- Preview column (desktop) ---------------- */}
        <section className="card-surface hidden min-w-0 flex-1 overflow-hidden lg:block">
          {selected ? (
            <PreviewPane
              recipe={selected}
              scale={scale}
              setScale={setScale}
              overlap={listOverlap}
              onPlan={() => startPlanning(selected)}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-10">
              <p className="meta">Select a recipe to preview it.</p>
            </div>
          )}
        </section>
      </div>

      {/* ---------------- Mobile bottom sheet ---------------- */}
      {selected && sheetOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-line bg-card p-4 shadow-sheet lg:hidden">
          <button
            onClick={() => setSheetOpen(false)}
            aria-label="Close preview"
            className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-check"
          />
          <div className="flex gap-3">
            <img
              src={recipeImage(selected)}
              alt=""
              className="h-[78px] w-[78px] flex-shrink-0 rounded-tile object-cover"
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-[17px] font-semibold leading-tight text-primary">
                {selected.title}
              </h2>
              <p className="meta mt-0.5">
                {metaLine(selected)} · {selected.ingredients.length} ingredients
              </p>
              {listOverlap && (
                <span className="note-plan mt-1.5 inline-block">
                  {listOverlap.hit} of {listOverlap.total} already on the list
                </span>
              )}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => startPlanning(selected)}
              className="pill-primary h-11"
            >
              Add to plan
            </button>
            <Link
              to={`/recipes/${selected.recipe_id}`}
              className="pill-outline h-11"
            >
              Open recipe
            </Link>
          </div>
        </div>
      )}

      {/* ---------------- Add-to-plan dialog ---------------- */}
      {planningFor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-primary/30 p-4 sm:items-center">
          <div className="card-surface w-full max-w-sm p-5">
            <h2 className="font-serif text-[20px] font-semibold text-primary">
              Add to plan
            </h2>
            <p className="meta mt-0.5 truncate">{planningFor.title}</p>

            <label className="eyebrow mt-4 block">Day</label>
            <select
              value={planDay}
              onChange={(e) => setPlanDay(e.target.value)}
              className="form-input mt-1 w-full"
            >
              <option value="">Anytime this week</option>
              {ALL_DAYS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>

            <label className="eyebrow mt-3 block">Meal</label>
            <select
              value={planMeal}
              onChange={(e) => setPlanMeal(e.target.value)}
              className="form-input mt-1 w-full"
            >
              {MEALS.map((m) => (
                <option key={m} value={m}>
                  {mealLabel(m)}
                </option>
              ))}
            </select>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setPlanningFor(null)}
                className="pill-outline"
              >
                Cancel
              </button>
              <button
                onClick={confirmPlan}
                disabled={planSaving}
                className="pill-primary"
              >
                {planSaving ? "Adding…" : "Add to plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewPane({
  recipe,
  scale,
  setScale,
  overlap,
  onPlan,
}: {
  recipe: Recipe;
  scale: number;
  setScale: (n: number) => void;
  overlap: { hit: number; total: number } | null;
  onPlan: () => void;
}) {
  const chip = [
    recipe.total_time ? `${recipe.total_time} MIN` : null,
    recipe.servings ? `SERVES ${recipe.servings}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex h-full flex-col">
      <div className="relative h-[190px] flex-shrink-0">
        <img
          src={recipeImage(recipe)}
          alt=""
          className="h-full w-full object-cover"
        />
        {chip && (
          <span className="absolute left-4 top-4 rounded-md bg-paper/[0.92] px-2 py-1 text-[11px] font-bold tracking-[0.05em] text-primary">
            {chip}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line-soft px-[22px] py-4">
        <div className="min-w-0">
          <h1 className="font-serif text-[32px] font-semibold leading-[1.1] text-primary">
            {recipe.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {recipe.recipe_tags?.map((t) => (
              <span key={t} className="chip-tag">
                {t}
              </span>
            ))}
            {recipe.import_source_url && (
              <span className="meta">
                imported from {new URL(recipe.import_source_url).hostname}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button onClick={onPlan} className="pill-primary">
            Add to plan
          </button>
          <Link to={`/recipes/${recipe.recipe_id}`} className="pill-outline">
            Open full recipe
          </Link>
          <Link
            to={`/recipes/${recipe.recipe_id}/edit`}
            aria-label="Edit recipe"
            title="Edit recipe"
            className="icon-pill"
          >
            ✎
          </Link>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[296px_1fr]">
        {/* Ingredients */}
        <div className="card-inset m-4 flex flex-col p-4">
          <div className="flex items-center justify-between">
            <span className="eyebrow">
              Ingredients · {recipe.ingredients.length}
            </span>
            <label className="sr-only" htmlFor="scale">
              Scale quantities
            </label>
            <select
              id="scale"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="rounded border border-field bg-card px-1.5 py-0.5 text-[12px] font-semibold text-terracotta"
            >
              {SCALES.map((s) => (
                <option key={s} value={s}>
                  Scale ×{s}
                </option>
              ))}
            </select>
          </div>
          <ul className="mt-3 space-y-1.5">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="text-[13px] text-textgray">
                <span className="font-semibold text-primary">
                  {scaleQuantity(ing.quantity, scale)} {ing.measurement_type}
                </span>{" "}
                {ing.name}
              </li>
            ))}
          </ul>
          {overlap && (
            <p className="note-plan mt-auto pt-3">
              {overlap.hit} of {overlap.total} already on this week’s shopping
              list
            </p>
          )}
        </div>

        {/* Method */}
        <div className="flex flex-col px-4 py-4 lg:pl-0 lg:pr-[22px]">
          <span className="eyebrow">Method</span>
          <ol className="mt-3 space-y-3">
            {recipe.instructions.map((s) => (
              <li key={s.step_number} className="flex gap-3">
                <span className="step-bubble">{s.step_number}</span>
                <span className="text-[14px] leading-[1.6] text-textgray">
                  {s.text}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-auto flex flex-wrap gap-x-5 gap-y-1 border-t border-line-soft pt-3 text-[12px] text-muted">
            <span>
              <span className="kbd-hint">↑ ↓</span> move through the index
            </span>
            <span>
              <span className="kbd-hint">↵</span> open
            </span>
            <span>
              <span className="kbd-hint">p</span> add to plan
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
