import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../lib/api";
import { recipeImage } from "../lib/imageHelper";
import { normalizeName, scaleQuantity } from "../lib/quantity";
import type { MealEntry, Recipe, ShoppingItem } from "../lib/types";
import { currentWeekIso, dayChip } from "../lib/week";

export default function RecipeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const weekIso = useMemo(currentWeekIso, []);

  const [recipe, setRecipe] = useState<Recipe>();
  const [showConfirm, setShowConfirm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfMessage, setPdfMessage] = useState("");
  const [pdfError, setPdfError] = useState(false);

  const [servings, setServings] = useState<number | null>(null);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [planEntries, setPlanEntries] = useState<MealEntry[]>([]);
  const [listItems, setListItems] = useState<ShoppingItem[]>([]);
  const [addingRest, setAddingRest] = useState(false);

  useEffect(() => {
    if (!id) return;
    setRecipe(undefined);
    api.recipes
      .get(id)
      .then((r) => {
        setRecipe(r);
        setServings(r.servings ?? null);
      })
      .catch(() => setRecipe(undefined));
  }, [id]);

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

  // Quantities are scaled by however far the stepper is from the recipe's own
  // serving count; without a base there is nothing to scale against.
  const factor =
    recipe?.servings && servings ? servings / recipe.servings : 1;

  const onList = useMemo(
    () =>
      new Set(
        listItems.filter((i) => !i.removed).map((i) => normalizeName(i.name)),
      ),
    [listItems],
  );
  const missing = useMemo(
    () =>
      recipe
        ? recipe.ingredients.filter((i) => !onList.has(normalizeName(i.name)))
        : [],
    [recipe, onList],
  );

  if (!recipe) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="card-surface p-10 text-center">
          <p className="meta">Loading recipe…</p>
        </div>
      </div>
    );
  }

  const isOwner = recipe.owner_id === userId;
  const plannedEntry = planEntries.find((e) => e.recipe_id === recipe.recipe_id);
  const meta = [
    recipe.total_time ? `${recipe.total_time} min` : null,
    `${recipe.ingredients.length} ingredients`,
    recipe.import_source_url
      ? `imported from ${new URL(recipe.import_source_url).hostname}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  function downloadPdf() {
    if (!recipe || downloadingPdf) return;
    setDownloadingPdf(true);
    setPdfMessage("Preparing PDF…");
    setPdfError(false);
    api.recipes
      .pdf(recipe.recipe_id)
      .then((res) => {
        const binary = atob(res.content_base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const url = URL.createObjectURL(
          new Blob([bytes], { type: "application/pdf" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename;
        a.click();
        URL.revokeObjectURL(url);
        setPdfMessage(`Downloaded ${res.filename}`);
        setPdfError(false);
        setTimeout(() => setPdfMessage(""), 4000);
      })
      .catch(() => {
        setPdfMessage("Couldn't generate the PDF. Please try again.");
        setPdfError(true);
      })
      .finally(() => setDownloadingPdf(false));
  }

  function confirmDelete() {
    if (!recipe) return;
    api.recipes.remove(recipe.recipe_id).then(() => navigate("/recipes"));
  }

  function addToCookbook() {
    if (!recipe || adding) return;
    setAdding(true);
    const {
      recipe_id: _r,
      owner_id: _o,
      image_url: _u,
      image_key: _k,
      ...rest
    } = recipe;
    api.recipes
      .create({ ...rest, is_shareable: false })
      .then((created) => navigate(`/recipes/${created.recipe_id}`))
      .catch(() => setAdding(false));
  }

  /** Append the ingredients this recipe needs that aren't on the list yet. */
  function addTheRest() {
    if (!recipe || addingRest || !missing.length) return;
    setAddingRest(true);
    const additions: ShoppingItem[] = missing.map((i) => ({
      name: i.name,
      unit: i.measurement_type || "",
      quantity: scaleQuantity(i.quantity, factor),
      sources: [recipe.title],
      checked: false,
      custom: true,
      removed: false,
    }));
    api.shoppingList
      .save(weekIso, [...listItems, ...additions])
      .then((res) => setListItems(res.items || []))
      .finally(() => setAddingRest(false));
  }

  function toggle(i: number) {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-[22px]">
      <Link to="/recipes" className="meta hover:text-terracotta">
        ‹ Back to recipes
      </Link>

      {/* Hero */}
      <section className="card-surface mt-3 flex flex-col gap-5 p-4 sm:flex-row sm:p-5">
        <img
          src={recipeImage(recipe)}
          alt=""
          className="h-[230px] w-full flex-shrink-0 rounded-card bg-cardalt object-cover sm:w-[230px]"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="break-words font-serif text-[32px] font-semibold leading-[1.1] text-primary sm:text-[40px]">
            {recipe.title}
          </h1>
          <p className="meta mt-2">{meta}</p>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {plannedEntry && (
              <span className="rounded-pill border border-plan-line bg-plan-bg px-2.5 py-1 text-[12px] font-semibold text-sage">
                Planned {dayChip(plannedEntry.day) ?? "this week"}
              </span>
            )}
            {recipe.recipe_tags?.map((t) => (
              <span key={t} className="chip-tag">
                {t}
              </span>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 sm:mt-auto sm:pt-5">
            <Link to="/meal-plan" className="pill-primary">
              Add to plan
            </Link>
            <Link
              to={`/recipes/${recipe.recipe_id}/cook`}
              className="pill-outline"
            >
              Cook mode
            </Link>
            {isOwner && (
              <Link
                to={`/recipes/${recipe.recipe_id}/edit`}
                className="pill-outline"
              >
                Edit
              </Link>
            )}
            <button
              onClick={downloadPdf}
              disabled={downloadingPdf}
              className="pill-outline"
            >
              {downloadingPdf ? "Preparing…" : "Download PDF"}
            </button>
            {recipe.import_source_url && (
              <a
                href={recipe.import_source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="pill-outline"
              >
                Original ↗
              </a>
            )}
            {!isOwner && (
              <button
                onClick={addToCookbook}
                disabled={adding}
                className="pill-accent"
              >
                {adding ? "Adding…" : "+ Add to my cookbook"}
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => setShowConfirm(true)}
                className="pill-outline !text-muted-2"
              >
                Delete
              </button>
            )}
          </div>
          {pdfMessage && (
            <p
              className={`mt-2 text-[12px] ${
                pdfError ? "text-danger" : "text-sage"
              }`}
            >
              {pdfMessage}
            </p>
          )}
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* Ingredients */}
        <section className="card-surface flex flex-col p-4 sm:p-[18px]">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-[20px] font-semibold text-primary">
              Ingredients
            </h2>
            {recipe.servings && servings != null && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setServings(Math.max(1, servings - 1))}
                  aria-label="Fewer servings"
                  className="icon-pill h-8 w-8"
                >
                  −
                </button>
                <span className="min-w-4 text-center text-[14px] font-semibold text-primary">
                  {servings}
                </span>
                <button
                  onClick={() => setServings(servings + 1)}
                  aria-label="More servings"
                  className="icon-pill h-8 w-8"
                >
                  +
                </button>
              </div>
            )}
          </div>

          <ul className="mt-3 space-y-0.5">
            {recipe.ingredients.map((ing, i) => (
              <li key={i}>
                <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-tile px-1 py-2 transition hover:bg-paper sm:min-h-0">
                  <input
                    type="checkbox"
                    checked={ticked.has(i)}
                    onChange={() => toggle(i)}
                    className="mt-0.5 h-[17px] w-[17px] flex-shrink-0 cursor-pointer accent-accent"
                  />
                  <span
                    className={`text-[14px] ${
                      ticked.has(i)
                        ? "text-muted-2 line-through"
                        : "text-textgray"
                    }`}
                  >
                    <span className="font-semibold text-primary">
                      {scaleQuantity(ing.quantity, factor)}{" "}
                      {ing.measurement_type}
                    </span>{" "}
                    {ing.name}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {onList.size > 0 && (
            <div className="note-plan mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
              <span>
                {recipe.ingredients.length - missing.length} of{" "}
                {recipe.ingredients.length} already on this week’s list
              </span>
              {missing.length > 0 && (
                <button
                  onClick={addTheRest}
                  disabled={addingRest}
                  className="pill-accent px-3 py-1.5 text-[12px]"
                >
                  {addingRest ? "Adding…" : "Add the rest"}
                </button>
              )}
            </div>
          )}
        </section>

        {/* Method */}
        <section className="card-surface p-4 sm:p-[18px]">
          <h2 className="font-serif text-[20px] font-semibold text-primary">
            Method
          </h2>
          <ol className="mt-3 space-y-3.5">
            {recipe.instructions.map((step) => (
              <li key={step.step_number} className="flex gap-3.5">
                <span className="step-bubble h-[26px] w-[26px] text-[13px]">
                  {step.step_number}
                </span>
                <span className="text-[15px] leading-[1.65] text-textgray">
                  {step.text}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/30 p-4">
          <div className="card-surface w-full max-w-sm border-danger-line bg-danger-bg p-6 text-center">
            <h2 className="font-serif text-[20px] font-semibold text-danger">
              Delete this recipe?
            </h2>
            <p className="meta mt-2">This action cannot be undone.</p>
            <div className="mt-5 flex justify-center gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="pill-outline"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDelete();
                  setShowConfirm(false);
                }}
                className="rounded-pill border border-danger px-4 py-2 text-[13px] font-semibold text-danger transition hover:bg-danger hover:text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
