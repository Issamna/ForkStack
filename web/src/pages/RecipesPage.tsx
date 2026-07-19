import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../lib/api";
import { imageForTags } from "../lib/imageHelper";
import type { Recipe } from "../lib/types";

type Tab = "mine" | "discover";
const PAGE_SIZE = 12;
const base = import.meta.env.BASE_URL;

export default function RecipesPage() {
  const { userId } = useAuth();
  const [all, setAll] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("mine");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    api.recipes
      .list()
      .then(setAll)
      .catch(() => setAll([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const scoped =
      tab === "mine"
        ? all.filter((r) => r.owner_id === userId)
        : all.filter((r) => r.is_shareable && r.owner_id !== userId);
    const q = search.trim().toLowerCase();
    return q ? scoped.filter((r) => r.title.toLowerCase().includes(q)) : scoped;
  }, [all, tab, search, userId]);

  useEffect(() => setPage(1), [tab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function changeTab(t: Tab) {
    if (t !== tab) {
      setTab(t);
      setSearch("");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Tabs */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex rounded-full bg-gray-200 p-1">
          {(["mine", "discover"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => changeTab(t)}
              className={`rounded-full px-5 py-1.5 text-sm font-semibold transition ${
                tab === t ? "bg-white text-textgray shadow" : "text-gray-500"
              }`}
            >
              {t === "mine" ? "My Recipes" : "Discover"}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative mx-auto mb-8 w-full max-w-md text-textgray">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${tab === "mine" ? "your" : "shared"} recipes`}
          className="h-10 w-full rounded-full border border-gray-300 bg-white px-5 pr-10 text-sm focus:outline-none"
        />
      </div>

      {loading && (
        <div className="py-12 text-center text-gray-400">Loading recipes…</div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="mx-auto max-w-md py-16 text-center">
          <img
            src={`${base}assets/logo.png`}
            alt=""
            className="mx-auto mb-4 h-16 w-16 opacity-40"
          />
          {search ? (
            <>
              <p className="mb-1 text-lg font-semibold text-textgray">
                No matches
              </p>
              <p className="text-sm text-gray-500">
                Nothing here matches “{search}”.
              </p>
            </>
          ) : tab === "mine" ? (
            <>
              <p className="mb-1 text-lg font-semibold text-textgray">
                Your cookbook is empty
              </p>
              <p className="mb-6 text-sm text-gray-500">
                Add your first recipe to get started.
              </p>
              <div className="flex justify-center gap-3">
                <Link to="/recipes/new" className="button-primary inline-block">
                  Create recipe
                </Link>
                <Link
                  to="/recipes/new?import=1"
                  className="inline-flex rounded border border-textgray px-4 py-2 text-sm font-semibold text-textgray transition hover:border-accent hover:bg-accent"
                >
                  Import from URL
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="mb-1 text-lg font-semibold text-textgray">
                Nothing shared yet
              </p>
              <p className="text-sm text-gray-500">
                Check back later for recipes shared by the community.
              </p>
            </>
          )}
        </div>
      )}

      {!loading && pageItems.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {pageItems.map((recipe) => (
            <Link
              key={recipe.recipe_id}
              to={`/recipes/${recipe.recipe_id}`}
              className="flex aspect-square cursor-pointer flex-col overflow-hidden rounded-lg bg-white shadow hover:shadow-md"
            >
              <img
                src={imageForTags(recipe.recipe_tags, recipe.recipe_id)}
                alt="Recipe"
                className="h-3/5 w-full object-cover"
              />
              <div className="flex flex-1 flex-col items-center justify-center p-2 text-center">
                <h3 className="line-clamp-2 break-words text-xs font-semibold text-textgray sm:text-sm">
                  {recipe.title}
                </h3>
                {recipe.recipe_tags?.length ? (
                  <p
                    className="mt-1 w-full truncate text-center text-xs text-gray-500"
                    title={recipe.recipe_tags.join(" | ")}
                  >
                    {recipe.recipe_tags.join(" | ")}
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="pagination-button"
          >
            ‹
          </button>
          <span className="text-sm text-textgray">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="pagination-button"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
