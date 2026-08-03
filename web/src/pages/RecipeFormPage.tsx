import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { imageForTags } from "../lib/imageHelper";
import { ACCEPTED_TYPES, uploadRecipePhoto } from "../lib/photoUpload";
import type { Ingredient, InstructionStep, Tag } from "../lib/types";

const emptyIngredient = (): Ingredient => ({
  name: "",
  quantity: "",
  measurement_type: "",
});

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
  const [isShareable, setIsShareable] = useState(false);
  const [servings, setServings] = useState<number | "">("");
  const [totalTime, setTotalTime] = useState<number | "">("");
  const [recipeUrl, setRecipeUrl] = useState("");
  const [showParser, setShowParser] = useState(
    searchParams.get("import") === "1",
  );
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [recipeTags, setRecipeTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

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
      return tags.length < 5 ? [...tags, name] : tags;
    });
  }

  function parseRecipeUrl() {
    if (!recipeUrl) return;
    setIsParsing(true);
    setParseError(null);
    api.recipes
      .parseUrl(recipeUrl)
      .then((data) => {
        setTitle(data.title);
        if (data.servings != null) setServings(data.servings);
        if (data.total_time != null) setTotalTime(data.total_time);
        setIngredients(
          data.ingredients?.length ? data.ingredients : [emptyIngredient()],
        );
        setInstructions(
          data.instructions?.length
            ? reindex(data.instructions)
            : [{ step_number: 1, text: "" }],
        );
        setShowParser(false);
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

  function submit() {
    setFormError(null);
    const cleanTitle = title.trim();
    const cleanIngredients = ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({ ...i, name: i.name.trim() }));
    const cleanInstructions = instructions
      .filter((s) => s.text.trim())
      .map((s, idx) => ({ step_number: idx + 1, text: s.text.trim() }));

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

    const done = () => navigate("/recipes");
    (editing && id
      ? api.recipes.update(id, payload)
      : api.recipes.create(payload)
    ).then(done);
  }

  const filteredTags = availableTags.filter((t) =>
    t.name.toLowerCase().includes(tagSearch.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Recipe title"
          aria-label="Recipe title"
          className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent sm:flex-1"
        />
        <button
          onClick={() => setShowParser(true)}
          className="w-full rounded bg-accent px-4 py-2 text-white hover:bg-primary sm:w-auto"
        >
          Import from URL
        </button>
      </div>

      {/* Visibility */}
      <div className="mt-4 flex items-center gap-3">
        <span className="text-sm font-medium text-textgray">Visibility</span>
        <button
          type="button"
          role="switch"
          aria-checked={isShareable}
          onClick={() => setIsShareable((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
            isShareable ? "bg-accent" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
              isShareable ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span
          className={`text-sm font-semibold ${
            isShareable ? "text-textgray" : "text-gray-500"
          }`}
        >
          {isShareable ? "Public" : "Private"}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Public recipes appear in others’ Discover tab.
      </p>

      {/* Servings */}
      <div className="mt-4 flex items-center gap-2">
        <label htmlFor="servings" className="text-sm font-medium text-textgray">
          Serves
        </label>
        <input
          id="servings"
          type="number"
          min={1}
          value={servings}
          onChange={(e) =>
            setServings(e.target.value === "" ? "" : Number(e.target.value))
          }
          placeholder="—"
          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <span className="text-xs text-gray-400">
          people (used to scale shopping lists)
        </span>
      </div>

      {/* Total time */}
      <div className="mt-4 flex items-center gap-2">
        <label
          htmlFor="total-time"
          className="text-sm font-medium text-textgray"
        >
          Takes
        </label>
        <input
          id="total-time"
          type="number"
          min={1}
          value={totalTime}
          onChange={(e) =>
            setTotalTime(e.target.value === "" ? "" : Number(e.target.value))
          }
          placeholder="—"
          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <span className="text-xs text-gray-400">
          minutes (filled in automatically when importing, if the page says)
        </span>
      </div>

      {/* Photo -- optional; falls back to the tag-based illustration. */}
      <div className="mt-4">
        <span className="text-sm font-medium text-textgray">Photo</span>
        <div className="mt-2 flex items-center gap-4">
          <img
            src={imagePreview || imageForTags(recipeTags, id)}
            alt=""
            className={`h-24 w-24 flex-shrink-0 rounded-lg border border-gray-200 bg-gray-100 object-cover ${
              uploading ? "opacity-50" : ""
            }`}
          />
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <label
              className={`button-primary cursor-pointer ${
                uploading ? "pointer-events-none opacity-60" : ""
              }`}
            >
              {uploading
                ? "Uploading…"
                : imageKey
                  ? "Replace photo"
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
                className="text-xs text-gray-400 underline hover:text-red-500"
              >
                Remove photo
              </button>
            )}
            <p className="text-xs text-gray-400">
              Optional — we’ll pick an illustration if you skip it.
            </p>
          </div>
        </div>
        {photoError && (
          <p className="mt-1 text-xs text-red-500">{photoError}</p>
        )}
      </div>

      {/* Tags */}
      <div className="relative mb-4 mt-4 flex items-start gap-4">
        <div>
          <button
            type="button"
            onClick={() => {
              setShowTagDropdown((v) => !v);
              setTagSearch("");
            }}
            className="rounded bg-accent px-3 py-1 text-sm text-white transition hover:bg-primary"
          >
            + Tags
          </button>
          {showTagDropdown && (
            <div className="absolute z-10 mt-1 max-h-64 w-64 overflow-y-auto rounded border bg-white p-2 shadow">
              <input
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                placeholder="Search tags..."
                className="mb-2 w-full rounded border p-1 text-sm"
              />
              <p className="mt-2 text-center text-xs text-gray-500">
                {recipeTags.length}/5 selected
              </p>
              {filteredTags.map((tag) => {
                const checked = recipeTags.includes(tag.name);
                return (
                  <label
                    key={tag.id}
                    className="flex items-center gap-2 py-1 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && recipeTags.length >= 5}
                      onChange={() => toggleTag(tag.name)}
                    />
                    {tag.name}
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {recipeTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-sm text-textgray"
            >
              {tag}
              <button
                type="button"
                onClick={() => toggleTag(tag)}
                aria-label={`Remove ${tag}`}
                className="leading-none text-gray-400 hover:text-red-600"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Ingredients */}
      <div className="mt-6 space-y-8">
        <div>
          <h2 className="mb-2 text-xl font-semibold text-textgray">
            Ingredients
          </h2>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-8 gap-2 px-1 text-xs font-medium text-gray-500">
              <span className="col-span-1">Qty</span>
              <span className="col-span-2">Unit</span>
              <span className="col-span-5">Ingredient</span>
            </div>
            {ingredients.map((ing, i) => (
              <div key={i} className="grid grid-cols-8 items-center gap-2">
                <input
                  value={ing.quantity}
                  onChange={(e) =>
                    updateIngredient(i, { quantity: e.target.value })
                  }
                  aria-label="Quantity"
                  className="col-span-1 w-full rounded border px-2 py-1"
                />
                <input
                  value={ing.measurement_type}
                  onChange={(e) =>
                    updateIngredient(i, { measurement_type: e.target.value })
                  }
                  aria-label="Unit"
                  className="col-span-2 w-full rounded border px-2 py-1"
                />
                <div className="col-span-5 flex gap-2">
                  <input
                    value={ing.name}
                    onChange={(e) =>
                      updateIngredient(i, { name: e.target.value })
                    }
                    aria-label="Ingredient name"
                    className="w-full rounded border px-2 py-1"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setIngredients((l) => l.filter((_, idx) => idx !== i))
                    }
                    title="Remove"
                    className="rounded bg-red-200 px-2 font-bold text-red-800 hover:bg-red-300"
                  >
                    −
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setIngredients((l) => [...l, emptyIngredient()])}
              className="mt-2 font-bold text-accent"
            >
              + Add Ingredient
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div>
          <h2 className="mb-2 text-xl font-semibold text-textgray">
            Instructions
          </h2>
          <div className="flex flex-col gap-3">
            {instructions.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2 font-bold">{i + 1}.</span>
                <textarea
                  value={step.text}
                  onChange={(e) => updateStep(i, e.target.value)}
                  placeholder="Instruction step"
                  rows={3}
                  className="min-h-[5rem] w-full resize-y rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="button"
                  onClick={() =>
                    setInstructions((l) =>
                      reindex(l.filter((_, idx) => idx !== i)),
                    )
                  }
                  title="Remove"
                  className="mt-2 rounded bg-red-200 px-2 font-bold text-red-800 hover:bg-red-300"
                >
                  −
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setInstructions((l) => [
                  ...l,
                  { step_number: l.length + 1, text: "" },
                ])
              }
              className="font-bold text-accent"
            >
              + Add Step
            </button>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="mt-8">
        {formError && (
          <div className="mb-3 text-center text-sm text-red-600">
            {formError}
          </div>
        )}
        <div className="flex justify-center gap-3">
          <Link
            to="/recipes"
            className="rounded border border-gray-300 px-6 py-3 text-textgray transition hover:bg-gray-100"
          >
            Cancel
          </Link>
          <button
            onClick={submit}
            className="rounded bg-textgray px-6 py-3 text-white transition hover:bg-accent hover:text-textgray"
          >
            {editing ? "Save changes" : "Save Recipe"}
          </button>
        </div>
      </div>

      {/* Import modal */}
      {showParser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-textgray">
              Import Recipe
            </h3>
            {parseError && (
              <div className="mt-2 text-sm text-red-500">{parseError}</div>
            )}
            <input
              value={recipeUrl}
              onChange={(e) => setRecipeUrl(e.target.value)}
              placeholder="Paste recipe URL"
              className="mb-4 w-full rounded border px-3 py-2"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowParser(false)}
                className="rounded px-4 py-2 text-textgray hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={parseRecipeUrl}
                disabled={isParsing}
                className="rounded bg-accent px-4 py-2 text-white hover:bg-primary"
              >
                {isParsing ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
