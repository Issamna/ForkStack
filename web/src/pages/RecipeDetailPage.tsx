import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../lib/api";
import { imageForTags } from "../lib/imageHelper";
import type { Recipe } from "../lib/types";

const base = import.meta.env.BASE_URL;

export default function RecipeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userId } = useAuth();

  const [recipe, setRecipe] = useState<Recipe>();
  const [showConfirm, setShowConfirm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfMessage, setPdfMessage] = useState("");
  const [pdfError, setPdfError] = useState(false);

  useEffect(() => {
    if (!id) return;
    setRecipe(undefined);
    api.recipes.get(id).then(setRecipe).catch(() => setRecipe(undefined));
  }, [id]);

  if (!recipe) {
    return <div className="py-12 text-center text-gray-400">Loading recipe…</div>;
  }

  const isOwner = recipe.owner_id === userId;
  const img = imageForTags(recipe.recipe_tags, recipe.recipe_id);

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
    const { recipe_id: _r, owner_id: _o, ...rest } = recipe;
    api.recipes
      .create({ ...rest, is_shareable: false })
      .then((created) => navigate(`/recipes/${created.recipe_id}`))
      .catch(() => setAdding(false));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 text-textgray">
      <Link
        to="/recipes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-accent"
      >
        ‹ Back to recipes
      </Link>

      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="break-words text-3xl font-bold sm:text-4xl">
            {recipe.title}
          </h1>
          <div className="mb-1 flex items-center gap-2">
            <button
              onClick={downloadPdf}
              disabled={downloadingPdf}
              title="Download PDF"
              aria-label="Download PDF"
              className="h-6 w-6 text-textgray transition hover:text-accent disabled:opacity-50"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            {recipe.import_source_url && (
              <a
                href={recipe.import_source_url}
                target="_blank"
                rel="noopener noreferrer"
                title="View original recipe"
                className="block h-6 w-6"
              >
                <img
                  src={`${base}assets/link.svg`}
                  alt="View original"
                  className="h-6 w-6"
                />
              </a>
            )}
            {isOwner && (
              <>
                <Link
                  to={`/recipes/${recipe.recipe_id}/edit`}
                  title="Edit"
                  className="block h-6 w-6"
                >
                  <img
                    src={`${base}assets/edit.svg`}
                    alt="Edit"
                    className="h-6 w-6"
                  />
                </Link>
                <button
                  onClick={() => setShowConfirm(true)}
                  title="Delete"
                  className="block h-6 w-6"
                >
                  <img
                    src={`${base}assets/delete.svg`}
                    alt="Delete"
                    className="h-6 w-6"
                  />
                </button>
              </>
            )}
          </div>
        </div>

        {!isOwner && (
          <button
            onClick={addToCookbook}
            disabled={adding}
            className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary disabled:opacity-60"
          >
            {adding ? "Adding…" : "+ Add to my cookbook"}
          </button>
        )}
      </div>

      {pdfMessage && (
        <p className={`mb-2 text-sm ${pdfError ? "text-red-600" : "text-sage"}`}>
          {pdfMessage}
        </p>
      )}
      {recipe.servings ? (
        <p className="mb-2 text-sm text-gray-500">Serves {recipe.servings}</p>
      ) : null}
      {recipe.recipe_tags?.length ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {recipe.recipe_tags.map((tag) => (
            <span key={tag} className="rounded border px-2 py-1 text-sm">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mx-auto mb-6 w-full max-w-xs sm:hidden">
        <div className="aspect-square overflow-hidden rounded shadow">
          <img src={img} alt="Recipe" className="h-full w-full object-cover" />
        </div>
      </div>

      <div className="mb-8 grid gap-6 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <h2 className="mb-2 text-xl font-semibold">Ingredients</h2>
          <ul className="list-disc space-y-1 pl-5">
            {recipe.ingredients.map((ing, i) => (
              <li key={i}>
                {ing.quantity} {ing.measurement_type} {ing.name}
              </li>
            ))}
          </ul>
        </div>
        <div className="hidden aspect-square w-full max-w-xs overflow-hidden rounded shadow sm:block">
          <img src={img} alt="Recipe" className="h-full w-full object-cover" />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-xl font-semibold">Instructions</h2>
        <ol className="list-decimal space-y-2 pl-5">
          {recipe.instructions.map((step) => (
            <li key={step.step_number}>{step.text}</li>
          ))}
        </ol>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-80 max-w-full rounded-lg bg-white p-6 text-center shadow-lg">
            <h2 className="mb-4 text-xl font-semibold text-textgray">
              Delete Recipe?
            </h2>
            <p className="mb-6 text-sm text-gray-600">
              This action cannot be undone.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDelete();
                  setShowConfirm(false);
                }}
                className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
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
