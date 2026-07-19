import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import type { ShoppingItem } from "../lib/types";

const CATEGORY_ORDER = [
  "produce",
  "meat",
  "dairy",
  "bakery",
  "pantry",
  "spices",
  "frozen",
  "beverages",
  "household",
  "other",
];
const CATEGORY_LABELS: Record<string, string> = {
  produce: "Produce",
  meat: "Meat & Seafood",
  dairy: "Dairy & Eggs",
  bakery: "Bakery",
  pantry: "Pantry",
  spices: "Spices & Seasonings",
  frozen: "Frozen",
  beverages: "Beverages",
  household: "Household",
  other: "Other",
};

function thisMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function ShoppingListPage() {
  const [searchParams] = useSearchParams();
  const week = searchParams.get("week") || thisMonday();

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newItem, setNewItem] = useState("");

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

  // The server assigns categories, so sync back its version of the list.
  const save = useCallback(
    (next: ShoppingItem[]) => {
      setItems(next);
      api.shoppingList
        .save(week, next)
        .then((res) => {
          if (res.items) setItems(res.items);
        })
        .catch(() => {});
    },
    [week],
  );

  function toggle(item: ShoppingItem) {
    save(items.map((i) => (i === item ? { ...i, checked: !i.checked } : i)));
  }
  function remove(item: ShoppingItem) {
    if (item.custom) {
      save(items.filter((i) => i !== item));
    } else {
      save(items.map((i) => (i === item ? { ...i, removed: true } : i)));
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
    ].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    setNewItem("");
    save(next);
  }

  const visible = useMemo(() => items.filter((i) => !i.removed), [items]);
  const removedCount = items.filter((i) => i.removed).length;
  const remaining = visible.filter((i) => !i.checked).length;
  const grouped = CATEGORY_ORDER.map((c) => ({
    label: CATEGORY_LABELS[c],
    items: visible.filter((i) => (i.category || "other") === c),
  })).filter((g) => g.items.length);

  const weekLabel = useMemo(() => {
    const start = new Date(week + "T00:00:00");
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(start)} – ${fmt(end)}`;
  }, [week]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        to="/meal-plan"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-accent"
      >
        ‹ Back to meal plan
      </Link>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="heading-primary">Shopping List</h1>
          <p className="text-sm text-gray-500">Week of {weekLabel}</p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-1 rounded border border-textgray px-4 py-2 text-sm font-semibold text-textgray transition hover:border-accent hover:bg-accent disabled:opacity-50"
        >
          {generating ? "Refreshing…" : "↻ Regenerate"}
        </button>
      </div>

      {loading && (
        <div className="py-12 text-center text-gray-400">
          Building your list…
        </div>
      )}

      {!loading && !visible.length && (
        <div className="mx-auto max-w-sm py-10 text-center text-gray-500">
          <div className="mb-3 text-4xl">🛒</div>
          <p className="mb-1 font-semibold text-textgray">Nothing to shop for</p>
          <p className="text-sm">
            Add some recipes to this week’s meal plan, or add your own items
            below. (Eating-out and quick items are skipped.)
          </p>
        </div>
      )}

      {!loading && (
        <div>
          {visible.length > 0 && (
            <>
              <p className="mb-3 text-sm text-gray-500">
                {remaining} of {visible.length} still to get
              </p>
              <ul className="divide-y rounded-lg border border-gray-200 bg-white">
                {grouped.map((group) => (
                  <div key={group.label}>
                    <li className="bg-gray-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      {group.label}
                    </li>
                    {group.items.map((item, idx) => (
                      <li
                        key={`${group.label}-${idx}`}
                        className="flex items-start gap-3 px-4 py-2.5"
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => toggle(item)}
                          className="mt-1 h-4 w-4 flex-shrink-0 cursor-pointer accent-accent"
                        />
                        <div
                          className={`min-w-0 flex-1 ${
                            item.checked ? "opacity-50" : ""
                          }`}
                        >
                          <div
                            className={`text-sm ${
                              item.checked ? "line-through" : ""
                            }`}
                          >
                            <span className="font-semibold text-textgray">
                              {item.quantity} {item.unit}
                            </span>{" "}
                            {item.name}
                          </div>
                          {item.sources?.length ? (
                            <div
                              className="truncate text-xs text-gray-400"
                              title={item.sources.join(", ")}
                            >
                              for {item.sources.join(", ")}
                            </div>
                          ) : null}
                          {item.custom && (
                            <div className="text-xs text-gray-400">
                              added by you
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(item)}
                          className="mt-0.5 flex-shrink-0 px-1 text-gray-300 transition hover:text-red-500"
                          aria-label={`Remove ${item.name}`}
                          title="Remove from list"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </div>
                ))}
              </ul>
            </>
          )}

          <form onSubmit={addItem} className="mt-4 flex gap-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Add your own item, e.g. 2 paper towels"
              className="form-input flex-1"
            />
            <button
              type="submit"
              className="button-primary"
              disabled={!newItem.trim()}
            >
              Add
            </button>
          </form>

          {removedCount > 0 && (
            <button
              type="button"
              onClick={restoreRemoved}
              className="mt-3 text-xs text-gray-400 underline hover:text-accent"
            >
              {removedCount} removed item{removedCount === 1 ? "" : "s"} — restore
            </button>
          )}
        </div>
      )}
    </div>
  );
}
