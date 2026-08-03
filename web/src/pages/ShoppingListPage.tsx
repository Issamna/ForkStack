import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { CATEGORY_ORDER, categoryLabel } from "../lib/categories";
import { recipeImage } from "../lib/imageHelper";
import type { MealEntry, ShoppingItem } from "../lib/types";
import { ALL_DAYS, currentWeekIso, fmtDay } from "../lib/week";

type View = "aisle" | "recipe";

/** A row plus its index in `items`, so handlers never rely on object identity. */
interface Row {
  item: ShoppingItem;
  index: number;
}

export default function ShoppingListPage() {
  const [searchParams] = useSearchParams();
  // Falls back to the user's own week start, not a hardcoded Monday -- the
  // list has to describe the same week the meal plan does.
  const week = searchParams.get("week") || currentWeekIso();

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [view, setView] = useState<View>("aisle");
  const [hideChecked, setHideChecked] = useState(false);

  const generate = useCallback(() => {
    setGenerating(true);
    api.shoppingList
      .generate(week)
      .then((res) => setItems(res.items || []))
      .catch(() => {})
      .finally(() => {
        setGenerating(false);
        setLoading(false);
      });
  }, [week]);

  useEffect(() => {
    // Generate fresh from the current plan on open (checks are preserved).
    generate();
  }, [generate]);

  useEffect(() => {
    api.mealPlan
      .get(week)
      .then((r) => setEntries(r.entries || []))
      .catch(() => setEntries([]));
  }, [week]);

  // Saves are fire-and-forget, so a fast second tap can have its PUT answered
  // before the first one's. Only the newest response may overwrite local state
  // -- otherwise a stale echo silently reverts the tap the user just made.
  const saveSeq = useRef(0);

  // The server assigns categories, so sync back its version of the list.
  const save = useCallback(
    (next: ShoppingItem[]) => {
      setItems(next);
      const seq = ++saveSeq.current;
      api.shoppingList
        .save(week, next)
        .then((res) => {
          if (seq === saveSeq.current && res.items) setItems(res.items);
        })
        .catch(() => {});
    },
    [week],
  );

  // Addressed by index, not object identity: every save swaps in fresh objects
  // from the server, so an `i === item` comparison matches nothing once a
  // response has landed mid-interaction.
  function toggle(index: number) {
    save(items.map((i, n) => (n === index ? { ...i, checked: !i.checked } : i)));
  }
  function remove(index: number) {
    const target = items[index];
    if (!target) return;
    if (target.custom) {
      save(items.filter((_, n) => n !== index));
    } else {
      save(items.map((i, n) => (n === index ? { ...i, removed: true } : i)));
    }
  }
  function restoreRemoved() {
    save(items.map((i) => ({ ...i, removed: false })));
  }
  function addItem(e: React.FormEvent) {
    e.preventDefault();
    const text = newItem.trim();
    if (!text) return;
    const m = text.match(/^(\d+(?:[.\/]\d+)?)\s+(.+)$/);
    const next = [
      ...items,
      {
        name: m ? m[2] : text,
        unit: "",
        quantity: m ? m[1] : "",
        sources: [],
        checked: false,
        custom: true,
        removed: false,
      } as ShoppingItem,
    ];
    setNewItem("");
    save(next);
  }

  const rows = useMemo<Row[]>(
    () =>
      items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => !item.removed)
        .filter(({ item }) => (hideChecked ? !item.checked : true)),
    [items, hideChecked],
  );

  const removedCount = items.filter((i) => i.removed).length;
  const visibleCount = items.filter((i) => !i.removed).length;
  const remaining = items.filter((i) => !i.removed && !i.checked).length;
  const ticked = visibleCount - remaining;

  const groups = useMemo(() => {
    if (view === "aisle") {
      const custom = rows.filter(({ item }) => item.custom);
      const fromRecipes = rows.filter(({ item }) => !item.custom);
      const out = CATEGORY_ORDER.map((c) => ({
        label: categoryLabel(c),
        rows: fromRecipes.filter(({ item }) => (item.category || "other") === c),
      })).filter((g) => g.rows.length);
      if (custom.length) out.push({ label: "Added by you", rows: custom });
      return out;
    }
    // By recipe: an item can feed several meals, so it appears under each.
    const bySource = new Map<string, Row[]>();
    rows.forEach((row) => {
      const keys = row.item.sources?.length
        ? row.item.sources
        : [row.item.custom ? "Added by you" : "Other"];
      keys.forEach((k) => {
        if (!bySource.has(k)) bySource.set(k, []);
        bySource.get(k)!.push(row);
      });
    });
    return [...bySource.entries()].map(([label, rs]) => ({ label, rows: rs }));
  }, [rows, view]);

  const aisleCount = useMemo(
    () =>
      new Set(
        rows.filter(({ item }) => !item.custom).map(({ item }) => item.category || "other"),
      ).size,
    [rows],
  );

  const weekLabel = useMemo(() => {
    const start = new Date(week + "T00:00:00");
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${fmtDay(start)} – ${fmtDay(end)}`;
  }, [week]);

  const cooking = entries.filter((e) => !e.eat_out);
  const eatingOut = entries.filter((e) => e.eat_out);

  /** How many list lines each planned meal contributed. */
  function itemsFrom(title: string): number {
    return items.filter((i) => !i.removed && i.sources?.includes(title)).length;
  }
  const dayLabel = (key?: string | null) =>
    ALL_DAYS.find((d) => d.key === key)?.label.slice(0, 3) ?? null;

  return (
    <div className="px-4 pb-28 pt-4 sm:px-[22px] lg:pb-10">
      <Link to="/meal-plan" className="meta hover:text-terracotta">
        ‹ Back to meal plan
      </Link>

      {/* Title block */}
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-[26px] font-semibold text-primary sm:text-[30px]">
            Shopping list
          </h1>
          <p className="meta">
            Week of {weekLabel} · from {cooking.length} planned meal
            {cooking.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setView("aisle")}
            className={`chip ${view === "aisle" ? "chip-active" : ""}`}
          >
            By aisle
          </button>
          <button
            onClick={() => setView("recipe")}
            className={`chip ${view === "recipe" ? "chip-active" : ""}`}
          >
            By recipe
          </button>
          <button
            onClick={() => setHideChecked((v) => !v)}
            className={`chip ${hideChecked ? "chip-active" : ""}`}
          >
            Hide checked
          </button>
          <button
            onClick={generate}
            disabled={generating}
            className="pill-outline ml-1"
          >
            {generating ? "Refreshing…" : "↻ Regenerate"}
          </button>
          <button onClick={() => window.print()} className="pill-outline">
            Print
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4 xl:flex-row">
        {/* List card */}
        <section className="card-surface min-w-0 flex-1 p-4 sm:p-[18px]">
          {loading && <p className="meta py-8 text-center">Building your list…</p>}

          {!loading && !rows.length && (
            <div className="mx-auto max-w-sm py-10 text-center">
              <div className="mb-3 text-4xl">🛒</div>
              <p className="mb-1 font-serif text-[17px] font-semibold text-primary">
                {hideChecked && visibleCount
                  ? "Everything is ticked off"
                  : "Nothing to shop for"}
              </p>
              <p className="meta">
                {hideChecked && visibleCount
                  ? "Turn off “Hide checked” to see the full list."
                  : "Add some recipes to this week’s meal plan, or add your own items below. (Eating-out and quick items are skipped.)"}
              </p>
            </div>
          )}

          {!loading && rows.length > 0 && (
            <div className="gap-x-[26px] sm:columns-2">
              {groups.map((group) => (
                <div key={group.label} className="mb-5 break-inside-avoid">
                  <div className="eyebrow-terracotta">
                    {group.label} · {group.rows.length}
                  </div>
                  <ul className="mt-1">
                    {group.rows.map(({ item, index }) => (
                      <li
                        key={`${group.label}-${index}`}
                        className="flex items-stretch border-t border-line-list"
                      >
                        {/* Whole row is the tap target -- a bare checkbox is
                            far below the ~44px a thumb can hit. */}
                        <label className="flex min-h-[52px] flex-1 cursor-pointer touch-manipulation items-start gap-2.5 py-2 pr-2 sm:min-h-0 sm:py-[7px]">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => toggle(index)}
                            className="mt-0.5 h-6 w-6 flex-shrink-0 cursor-pointer rounded-[7px] accent-accent sm:h-[18px] sm:w-[18px] sm:rounded-[5px]"
                          />
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block text-[14px] ${
                                item.checked
                                  ? "text-muted-2 line-through"
                                  : "text-textgray"
                              }`}
                            >
                              <span
                                className={`font-semibold ${
                                  item.checked ? "text-muted-2" : "text-primary"
                                }`}
                              >
                                {item.quantity} {item.unit}
                              </span>{" "}
                              {item.name}
                            </span>
                            {item.sources?.length ? (
                              <span
                                className="block truncate text-[11px] text-muted-2"
                                title={item.sources.join(", ")}
                              >
                                for {item.sources.join(", ")}
                              </span>
                            ) : null}
                            {item.custom && (
                              <span className="block text-[11px] text-muted-2">
                                added by you
                              </span>
                            )}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="flex w-9 flex-shrink-0 items-center justify-center text-check transition hover:text-danger"
                          aria-label={`Remove ${item.name}`}
                          title="Remove from list"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {removedCount > 0 && (
            <button
              type="button"
              onClick={restoreRemoved}
              className="mt-2 text-[12px] text-muted-2 underline hover:text-terracotta"
            >
              {removedCount} removed item{removedCount === 1 ? "" : "s"} —
              restore
            </button>
          )}
        </section>

        {/* Rail */}
        <aside className="w-full flex-shrink-0 space-y-3 xl:w-[280px]">
          <div className="panel-dark p-4">
            <h2 className="font-serif text-[19px] font-semibold">
              {remaining} of {visibleCount} still to get
            </h2>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper/[0.18]">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
                style={{
                  width: visibleCount
                    ? `${(ticked / visibleCount) * 100}%`
                    : "0%",
                }}
              />
            </div>
            <p className="mt-2 text-[12px] text-accent">
              {ticked} ticked off · {aisleCount} aisle
              {aisleCount === 1 ? "" : "s"}
            </p>
          </div>

          <div className="card-surface p-4">
            <h2 className="font-serif text-[19px] font-semibold text-primary">
              From these meals
            </h2>
            <ul className="mt-2.5 space-y-1.5">
              {cooking.map((e) => (
                <li key={e.id} className="flex items-center gap-2.5">
                  <img
                    src={recipeImage({
                      recipe_tags: e.tags,
                      recipe_id: e.recipe_id || e.id,
                    })}
                    alt=""
                    className="h-8 w-8 flex-shrink-0 rounded object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-primary">
                      {e.title}
                    </span>
                    <span className="meta block">
                      {[
                        `${itemsFrom(e.title)} item${itemsFrom(e.title) === 1 ? "" : "s"}`,
                        dayLabel(e.day),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </li>
              ))}
              {!cooking.length && (
                <li className="meta">Nothing planned for this week yet.</li>
              )}
            </ul>
            {eatingOut.length > 0 && (
              <p className="meta mt-3 border-t border-line-soft pt-2.5">
                {eatingOut
                  .map((e) => dayLabel(e.day) ?? e.title)
                  .join(", ")}{" "}
                {eatingOut.length === 1 ? "is" : "are"} eating out — nothing
                added.
              </p>
            )}
          </div>

          <div className="card-surface hidden p-4 lg:block">
            <h2 className="font-serif text-[19px] font-semibold text-primary">
              Add your own
            </h2>
            <form onSubmit={addItem} className="mt-2.5 space-y-2">
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="e.g. 2 paper towels"
                aria-label="Add your own item"
                className="search-pill"
              />
              <button
                type="submit"
                className="pill-primary w-full"
                disabled={!newItem.trim()}
              >
                Add to list
              </button>
            </form>
          </div>
        </aside>
      </div>

      {/* Sticky add bar (phone) */}
      <form
        onSubmit={addItem}
        className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-line bg-paper px-4 py-3 lg:hidden"
      >
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add your own item"
          aria-label="Add your own item"
          className="search-pill flex-1"
        />
        <button
          type="submit"
          disabled={!newItem.trim()}
          aria-label="Add to list"
          className="h-11 w-11 flex-shrink-0 rounded-full bg-terracotta text-2xl leading-none text-white disabled:opacity-50"
        >
          +
        </button>
      </form>
    </div>
  );
}
