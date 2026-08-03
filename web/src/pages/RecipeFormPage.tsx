import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { imageForTags } from "../lib/imageHelper";
import { ACCEPTED_TYPES, uploadRecipePhoto } from "../lib/photoUpload";
import { getDefaultPublic, getDefaultServings } from "../lib/preferences";
import type { Ingredient, InstructionStep, Tag } from "../lib/types";

const emptyIngredient = (): Ingredient => ({
  name: "",
  quantity: "",
  measurement_type: "",
});

const MAX_TAGS = 5;

/** Textarea that grows with its content instead of scrolling in a fixed box. */
function AutoTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      className="w-full resize-none rounded-tile border border-field bg-card px-3 py-2 text-[14px] leading-[1.6] text-textgray placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-accent"
    />
  );
}

export default function RecipeFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editing = !!id;

  const [title, setTitle] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    emptyIngredient(),
  ]);
  const [instructions, setInstructions] = useState<InstructionStep[]>([
    { step_number: 1, text: "" },
  ]);
  // New recipes start from the account defaults; editing loads the recipe.
  const [isShareable, setIsShareable] = useState(() =>
    id ? false : getDefaultPublic(),
  );
  const [servings, setServings] = useState<number | "">(() =>
    id ? "" : getDefaultServings(),
  );
  const [totalTime, setTotalTime] = useState<number | "">("");
  const [recipeUrl, setRecipeUrl] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSummary, setParseSummary] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recipeTags, setRecipeTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const urlRef = useRef<HTMLInputElement>(null);

  // Local previews are object URLs, which leak unless explicitly revoked.
  const blobUrl = useRef<string | null>(null);
  function showPreview(url: string | null, isObjectUrl = false) {
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    blobUrl.current = isObjectUrl ? url : null;
    setImagePreview(url);
  }
  useEffect(
    () => () => {
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    },
    [],
  );

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so picking the same file twice still fires a change event.
    e.target.value = "";
    if (!file) return;
    setPhotoError(null);
    setUploading(true);
    try {
      const key = await uploadRecipePhoto(file);
      setImageKey(key);
      showPreview(URL.createObjectURL(file), true);
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : "Upload failed. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  function removePhoto() {
    setImageKey(null);
    showPreview(null);
    setPhotoError(null);
  }

  useEffect(() => {
    api.recipes.tags().then(setAvailableTags).catch(() => setAvailableTags([]));
  }, []);

  // Import is part of the page now, not a modal; ?import=1 just focuses it.
  useEffect(() => {
    if (searchParams.get("import") === "1") urlRef.current?.focus();
  }, [searchParams]);

  useEffect(() => {
    if (!editing || !id) return;
    api.recipes.get(id).then((r) => {
      setTitle(r.title);
      setIngredients(r.ingredients.length ? r.ingredients : [emptyIngredient()]);
      setInstructions(
        r.instructions.length ? r.instructions : [{ step_number: 1, text: "" }],
      );
      setIsShareable(r.is_shareable);
      setServings(r.servings ?? "");
      setTotalTime(r.total_time ?? "");
      setRecipeUrl(r.import_source_url ?? "");
      setRecipeTags(r.recipe_tags ?? []);
      setImageKey(r.image_key ?? null);
      setImagePreview(r.image_url ?? null);
    });
  }, [editing, id]);

  function updateIngredient(i: number, patch: Partial<Ingredient>) {
    setIngredients((list) =>
      list.map((ing, idx) => (idx === i ? { ...ing, ...patch } : ing)),
    );
  }
  function updateStep(i: number, text: string) {
    setInstructions((list) =>
      list.map((s, idx) => (idx === i ? { ...s, text } : s)),
    );
  }
  function reindex(list: InstructionStep[]): InstructionStep[] {
    return list.map((s, i) => ({ ...s, step_number: i + 1 }));
  }

  function toggleTag(name: string) {
    setRecipeTags((tags) => {
      if (tags.includes(name)) return tags.filter((t) => t !== name);
      return tags.length < MAX_TAGS ? [...tags, name] : tags;
    });
  }

  function parseRecipeUrl() {
    if (!recipeUrl) return;
    setIsParsing(true);
    setParseError(null);
    setParseSummary(null);
    api.recipes
      .parseUrl(recipeUrl)
      .then((data) => {
        setTitle(data.title);
        if (data.servings != null) setServings(data.servings);
        if (data.total_time != null) setTotalTime(data.total_time);
        const ing = data.ingredients?.length
          ? data.ingredients
          : [emptyIngredient()];
        const steps = data.instructions?.length
          ? reindex(data.instructions)
          : [{ step_number: 1, text: "" }];
        setIngredients(ing);
        setInstructions(steps);
        setParseSummary(
          `Imported ${data.ingredients?.length ?? 0} ingredients and ${
            data.instructions?.length ?? 0
          } steps · check the quantities below`,
        );
      })
      .catch((err: unknown) => {
        // Surface the backend's specific reason when available.
        setParseError(
          (err instanceof ApiError && err.message) ||
            "Failed to parse recipe. Try another URL.",
        );
      })
      .finally(() => setIsParsing(false));
  }

  const cleanTitle = title.trim();
  const filledIngredients = ingredients.filter((i) => i.name.trim());
  const filledSteps = instructions.filter((s) => s.text.trim());

  function submit() {
    setFormError(null);
    const cleanIngredients = filledIngredients.map((i) => ({
      ...i,
      name: i.name.trim(),
    }));
    const cleanInstructions = filledSteps.map((s, idx) => ({
      step_number: idx + 1,
      text: s.text.trim(),
    }));

    if (!cleanTitle) return setFormError("Please add a recipe title.");
    if (!cleanIngredients.length)
      return setFormError("Add at least one ingredient.");
    if (!cleanInstructions.length)
      return setFormError("Add at least one instruction step.");

    const payload = {
      title: cleanTitle,
      ingredients: cleanIngredients,
      instructions: cleanInstructions,
      is_shareable: isShareable,
      servings: servings === "" ? null : Number(servings),
      total_time: totalTime === "" ? null : Number(totalTime),
      recipe_tags: recipeTags,
      image_key: imageKey,
      ...(recipeUrl.trim() ? { import_source_url: recipeUrl.trim() } : {}),
    };

    setSaving(true);
    (editing && id
      ? api.recipes.update(id, payload)
      : api.recipes.create(payload)
    )
      .then(() => navigate("/recipes"))
      .catch(() => {
        setFormError("Couldn't save the recipe. Please try again.");
        setSaving(false);
      });
  }

  const filteredTags = availableTags.filter((t) =>
    t.name.toLowerCase().includes(tagSearch.toLowerCase()),
  );

  // "Before you save" -- computed from the form, never decorative.
  const checks: { ok: boolean; text: string }[] = [
    { ok: !!cleanTitle, text: cleanTitle ? "Title set" : "Needs a title" },
    {
      ok: filledIngredients.length > 0,
      text: filledIngredients.length
        ? `${filledIngredients.length} ingredients`
        : "Add at least one ingredient",
    },
    {
      ok: filledSteps.length > 0,
      text: filledSteps.length
        ? `${filledSteps.length} steps`
        : "Add at least one step",
    },
    {
      ok: servings !== "",
      text:
        servings !== ""
          ? `Serves ${servings}`
          : "No servings — shopping lists can't scale without it",
    },
    {
      ok: totalTime !== "",
      text: totalTime !== "" ? `${totalTime} min` : "No time set (optional)",
    },
  ];

  return (
    <div className="px-4 pb-10 pt-4 sm:px-[22px]">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-[26px] font-semibold text-primary sm:text-[30px]">
          {editing ? "Edit recipe" : "New recipe"}
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="pill-outline">
            Cancel
          </button>
          <button onClick={submit} disabled={saving} className="pill-primary">
            {saving ? "Saving…" : "Save recipe"}
          </button>
        </div>
      </div>

      {formError && (
        <p className="mt-2 text-[13px] font-semibold text-danger">{formError}</p>
      )}

      <div className="mt-4 flex flex-col gap-4 xl:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
          {/* Title + meta */}
          <section className="card-surface p-4 sm:p-[18px]">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Recipe title"
              aria-label="Recipe title"
              className="w-full border-b border-line-soft bg-transparent pb-2 font-serif text-[26px] font-semibold text-primary placeholder:text-placeholder focus:border-terracotta focus:outline-none sm:text-[30px]"
            />

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
              <label className="flex items-center gap-2 text-[13px] text-muted">
                Serves
                <input
                  type="number"
                  min={1}
                  value={servings}
                  onChange={(e) =>
                    setServings(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  placeholder="—"
                  className="w-16 rounded border border-field bg-card px-2 py-1 text-[13px] text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </label>
              <label className="flex items-center gap-2 text-[13px] text-muted">
                Takes
                <input
                  type="number"
                  min={1}
                  value={totalTime}
                  onChange={(e) =>
                    setTotalTime(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  placeholder="—"
                  className="w-16 rounded border border-field bg-card px-2 py-1 text-[13px] text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
                min
              </label>
              <div className="flex items-center gap-2.5">
                <span className="text-[13px] text-muted">Visibility</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isShareable}
                  onClick={() => setIsShareable((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    isShareable ? "bg-accent" : "bg-check"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      isShareable ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-[13px] font-semibold text-primary">
                  {isShareable ? "Public" : "Private"}
                </span>
                {isShareable && (
                  <span className="meta">shows in others’ Discover</span>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="relative mt-4 flex flex-wrap items-center gap-2">
              {recipeTags.map((tag) => (
                <span key={tag} className="chip-tag gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => toggleTag(tag)}
                    aria-label={`Remove ${tag}`}
                    className="leading-none text-muted transition hover:text-danger"
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => {
                  setShowTagDropdown((v) => !v);
                  setTagSearch("");
                }}
                className="rounded-pill border border-dashed border-terracotta-line px-3 py-1 text-[12px] font-semibold text-terracotta transition hover:bg-terracotta-tint"
              >
                + Tag
              </button>
              <span className="meta">
                {recipeTags.length} of {MAX_TAGS}
              </span>

              {showTagDropdown && (
                <div className="card-surface absolute left-0 top-9 z-10 max-h-64 w-64 overflow-y-auto p-2 shadow-sheet">
                  <input
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder="Search tags…"
                    aria-label="Search tags"
                    className="search-pill"
                  />
                  <div className="mt-2 space-y-0.5">
                    {filteredTags.map((tag) => {
                      const checked = recipeTags.includes(tag.name);
                      return (
                        <label
                          key={tag.id}
                          className="flex min-h-[36px] cursor-pointer items-center gap-2 rounded px-1 text-[13px] text-textgray hover:bg-paper"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!checked && recipeTags.length >= MAX_TAGS}
                            onChange={() => toggleTag(tag.name)}
                            className="h-4 w-4 accent-accent"
                          />
                          {tag.name}
                        </label>
                      );
                    })}
                    {!filteredTags.length && (
                      <p className="meta px-1 py-2">No tags found.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Editors */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card-surface p-4 sm:p-[18px]">
              <h2 className="font-serif text-[20px] font-semibold text-primary">
                Ingredients
              </h2>
              <div className="mt-3 space-y-1.5">
                <div className="flex gap-2 px-0.5">
                  <span className="eyebrow w-[52px]">Qty</span>
                  <span className="eyebrow w-[68px]">Unit</span>
                  <span className="eyebrow flex-1">Ingredient</span>
                  <span className="w-[22px]" />
                </div>
                {ingredients.map((ing, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={ing.quantity}
                      onChange={(e) =>
                        updateIngredient(i, { quantity: e.target.value })
                      }
                      aria-label={`Quantity for ingredient ${i + 1}`}
                      className="h-8 w-[52px] rounded border border-field bg-card px-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <input
                      value={ing.measurement_type}
                      onChange={(e) =>
                        updateIngredient(i, { measurement_type: e.target.value })
                      }
                      aria-label={`Unit for ingredient ${i + 1}`}
                      className="h-8 w-[68px] rounded border border-field bg-card px-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <input
                      value={ing.name}
                      onChange={(e) =>
                        updateIngredient(i, { name: e.target.value })
                      }
                      aria-label={`Ingredient ${i + 1} name`}
                      className="h-8 min-w-0 flex-1 rounded border border-field bg-card px-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setIngredients((l) => l.filter((_, idx) => idx !== i))
                      }
                      aria-label={`Remove ingredient ${i + 1}`}
                      className="w-[22px] flex-shrink-0 text-muted-2 transition hover:text-danger"
                    >
                      −
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setIngredients((l) => [...l, emptyIngredient()])
                  }
                  className="min-h-[44px] w-full rounded-tile border border-dashed border-terracotta-line text-[12px] font-semibold text-terracotta transition hover:bg-terracotta-tint sm:min-h-[36px]"
                >
                  + Add ingredient
                </button>
                <p className="meta pt-1">
                  Importing from a URL fills this in for you.
                </p>
              </div>
            </section>

            <section className="card-surface p-4 sm:p-[18px]">
              <h2 className="font-serif text-[20px] font-semibold text-primary">
                Method
              </h2>
              <div className="mt-3 space-y-2">
                {instructions.map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="step-bubble mt-1">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <AutoTextarea
                        value={step.text}
                        onChange={(v) => updateStep(i, v)}
                        placeholder="What happens in this step?"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setInstructions((l) =>
                          reindex(l.filter((_, idx) => idx !== i)),
                        )
                      }
                      aria-label={`Remove step ${i + 1}`}
                      className="mt-2 w-[22px] flex-shrink-0 text-muted-2 transition hover:text-danger"
                    >
                      −
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setInstructions((l) =>
                      reindex([...l, { step_number: l.length + 1, text: "" }]),
                    )
                  }
                  className="min-h-[44px] w-full rounded-tile border border-dashed border-terracotta-line text-[12px] font-semibold text-terracotta transition hover:bg-terracotta-tint sm:min-h-[36px]"
                >
                  + Add step
                </button>
              </div>
            </section>
          </div>
        </div>

        {/* Rail */}
        <aside className="w-full flex-shrink-0 space-y-3 xl:w-[300px]">
          <div className="panel-dark p-4">
            <h2 className="font-serif text-[19px] font-semibold">
              Import from a URL
            </h2>
            <p className="mt-0.5 text-[12px] text-accent">
              Paste a recipe page and we’ll pull out the parts.
            </p>
            <input
              ref={urlRef}
              value={recipeUrl}
              onChange={(e) => setRecipeUrl(e.target.value)}
              placeholder="https://…"
              aria-label="Recipe URL"
              className="mt-3 h-9 w-full rounded-pill border border-accent/35 bg-paper/[0.08] px-3.5 text-[13px] text-paper placeholder:text-paper/50 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              onClick={parseRecipeUrl}
              disabled={isParsing || !recipeUrl.trim()}
              className="pill-accent mt-2 w-full"
            >
              {isParsing ? "Importing…" : "Import"}
            </button>
            {parseSummary && (
              <p className="mt-2 text-[12px] text-accent">✓ {parseSummary}</p>
            )}
            {parseError && (
              <p className="mt-2 text-[12px] text-white">! {parseError}</p>
            )}
          </div>

          <div className="card-surface p-4">
            <h2 className="font-serif text-[19px] font-semibold text-primary">
              Photo
            </h2>
            <div className="mt-2.5 flex items-start gap-3">
              <img
                src={imagePreview || imageForTags(recipeTags, id)}
                alt=""
                className={`h-[120px] w-[120px] flex-shrink-0 rounded-tile border border-line bg-cardalt object-cover ${
                  uploading ? "opacity-50" : ""
                }`}
              />
              <div className="flex min-w-0 flex-col items-start gap-1.5">
                <label
                  className={`pill-primary cursor-pointer ${
                    uploading ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  {uploading
                    ? "Uploading…"
                    : imageKey
                      ? "Replace"
                      : "Upload photo"}
                  <input
                    type="file"
                    accept={ACCEPTED_TYPES.join(",")}
                    onChange={onPhotoChange}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
                {imageKey && !uploading && (
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="text-[12px] text-muted-2 underline hover:text-danger"
                  >
                    Remove photo
                  </button>
                )}
                <p className="meta">
                  {imageKey
                    ? "Your photo."
                    : "Picked from your tags — upload to replace."}
                </p>
              </div>
            </div>
            {photoError && (
              <p className="mt-2 text-[12px] text-danger">{photoError}</p>
            )}
          </div>

          <div className="card-surface p-4">
            <h2 className="font-serif text-[19px] font-semibold text-primary">
              Before you save
            </h2>
            <ul className="mt-2.5 space-y-1.5">
              {checks.map((c) => (
                <li
                  key={c.text}
                  className={`flex gap-2 text-[13px] ${
                    c.ok ? "text-sage" : "text-terracotta"
                  }`}
                >
                  <span className="font-bold">{c.ok ? "✓" : "!"}</span>
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
