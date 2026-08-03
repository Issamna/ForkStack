import { useEffect, useState } from "react";
import { UserProfile, useCurrentUser, useSignOut } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import {
  getDefaultPublic,
  getDefaultServings,
  getListView,
  setDefaultPublic,
  setDefaultServings,
  setListView,
  setWeekStart,
  type ListView,
} from "../lib/preferences";
import { ALL_DAYS, readWeekStartPref } from "../lib/week";

type Section = "profile" | "preferences" | "data" | "feedback";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "profile", label: "Profile & sign-in" },
  { key: "preferences", label: "Cooking preferences" },
  { key: "data", label: "Data & export" },
  { key: "feedback", label: "Report a problem" },
];

export default function AccountPage() {
  const { user } = useCurrentUser();
  const signOut = useSignOut();
  const navigate = useNavigate();

  const [section, setSection] = useState<Section>("profile");
  const [recipeCount, setRecipeCount] = useState<number | null>(null);

  const [weekStartDow, setWeekStartDow] = useState(readWeekStartPref);
  const [servings, setServings] = useState<number | "">(getDefaultServings);
  const [isPublic, setIsPublic] = useState(getDefaultPublic);
  const [listView, setView] = useState<ListView>(getListView);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [fbType, setFbType] = useState<"bug" | "feature">("bug");
  const [fbTitle, setFbTitle] = useState("");
  const [fbBody, setFbBody] = useState("");
  const [fbSending, setFbSending] = useState(false);
  const [fbResult, setFbResult] = useState<{ number: number; url: string } | null>(null);
  const [fbError, setFbError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.recipes
      .list()
      .then((rs) =>
        setRecipeCount(rs.filter((r) => r.owner_id === user?.id).length),
      )
      .catch(() => setRecipeCount(null));
  }, [user?.id]);

  function noteSaved() {
    setSavedAt("Saved on this device");
    setTimeout(() => setSavedAt(null), 2500);
  }

  /** Client-side export: the API has no export endpoint, so build it here. */
  async function exportRecipes() {
    setExporting(true);
    try {
      const recipes = await api.recipes.list();
      const mine = recipes.filter((r) => r.owner_id === user?.id);
      // image_url is a short-lived presigned link -- useless in a saved file.
      const clean = mine.map(({ image_url: _u, ...rest }) => rest);
      const blob = new Blob([JSON.stringify(clean, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `forkstack-recipes-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function sendFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!fbTitle.trim() || fbSending) return;
    setFbSending(true);
    setFbError(null);
    setFbResult(null);
    try {
      const res = await api.feedback.create(fbType, fbTitle.trim(), fbBody.trim());
      setFbResult(res);
      setFbTitle("");
      setFbBody("");
    } catch (err) {
      setFbError(
        err instanceof ApiError
          ? err.message
          : "Couldn't send that. Please try again.",
      );
    } finally {
      setFbSending(false);
    }
  }

  async function deleteEverything() {
    setDeleting(true);
    try {
      await api.users.deleteMyData();
      await signOut();
      navigate("/");
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-[22px] lg:flex-row">
      {/* Section rail */}
      <aside className="card-surface flex w-full flex-shrink-0 flex-col p-4 lg:w-[230px]">
        <div className="flex items-center gap-3">
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt=""
              className="h-11 w-11 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent font-semibold text-primary">
              {(user?.username || user?.fullName || "?").slice(0, 2)}
            </span>
          )}
          <div className="min-w-0">
            <div className="truncate font-serif text-[16px] font-semibold text-primary">
              {user?.username ||
                user?.fullName ||
                user?.primaryEmailAddress?.emailAddress ||
                "Your account"}
            </div>
            {recipeCount != null && (
              <div className="meta">
                {recipeCount} recipe{recipeCount === 1 ? "" : "s"}
              </div>
            )}
          </div>
        </div>

        <nav className="mt-4 space-y-1">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`w-full rounded-tile px-3 py-2 text-left text-[13px] font-medium transition ${
                section === s.key
                  ? "bg-terracotta-tint font-semibold text-primary"
                  : "text-muted hover:bg-paper"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <button
          onClick={async () => {
            await signOut();
            navigate("/");
          }}
          className="pill-outline mt-4 lg:mt-auto"
        >
          Log out
        </button>
      </aside>

      <div className="min-w-0 flex-1">
        {section === "profile" && (
          /* Clerk owns identity, email and password -- its own UI is the
             supported surface for all three, so it is embedded rather than
             reimplemented. */
          <div className="[&_.cl-rootBox]:w-full [&_.cl-cardBox]:w-full">
            <UserProfile routing="hash" />
          </div>
        )}

        {section === "preferences" && (
          <section className="card-surface p-4 sm:p-[18px]">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-[21px] font-semibold text-primary">
                Cooking preferences
              </h2>
              {savedAt && <span className="meta">{savedAt}</span>}
            </div>
            <p className="meta mt-1">
              Kept on this device — there’s no preferences endpoint yet, so
              these won’t follow you to another browser.
            </p>

            <div className="mt-4 space-y-4">
              <label className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[14px] text-textgray">
                  Week starts on
                </span>
                <select
                  value={weekStartDow}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setWeekStartDow(v);
                    setWeekStart(v);
                    noteSaved();
                  }}
                  className="form-input"
                >
                  {ALL_DAYS.map((d, i) => (
                    <option key={d.key} value={i}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-4">
                <span className="text-[14px] text-textgray">
                  Default servings for new recipes
                </span>
                <input
                  type="number"
                  min={1}
                  value={servings}
                  onChange={(e) => {
                    const v = e.target.value === "" ? "" : Number(e.target.value);
                    setServings(v);
                    setDefaultServings(v);
                    noteSaved();
                  }}
                  placeholder="—"
                  className="form-input w-20"
                />
              </label>

              <label className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-4">
                <span className="text-[14px] text-textgray">
                  Shopping list grouped by
                </span>
                <select
                  value={listView}
                  onChange={(e) => {
                    const v = e.target.value as ListView;
                    setView(v);
                    setListView(v);
                    noteSaved();
                  }}
                  className="form-input"
                >
                  <option value="aisle">Aisle</option>
                  <option value="recipe">Recipe</option>
                </select>
              </label>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-4">
                <span className="text-[14px] text-textgray">
                  New recipes are public
                  <span className="meta block">
                    Public recipes appear in others’ Discover tab.
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isPublic}
                  onClick={() => {
                    const v = !isPublic;
                    setIsPublic(v);
                    setDefaultPublic(v);
                    noteSaved();
                  }}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition ${
                    isPublic ? "bg-accent" : "bg-check"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      isPublic ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>
        )}

        {section === "feedback" && (
          <section className="card-surface p-4 sm:p-[18px]">
            <h2 className="font-serif text-[21px] font-semibold text-primary">
              Report a problem
            </h2>
            <p className="meta mt-1">
              Goes straight to the project's issue tracker. You'll get a link to
              follow it.
            </p>

            <form onSubmit={sendFeedback} className="mt-4 space-y-3">
              <div className="flex gap-1.5">
                {(
                  [
                    ["bug", "Something's broken"],
                    ["feature", "Idea for a feature"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFbType(value)}
                    className={`chip ${fbType === value ? "chip-active" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <input
                value={fbTitle}
                onChange={(e) => setFbTitle(e.target.value)}
                maxLength={200}
                placeholder={
                  fbType === "bug"
                    ? "e.g. Can't tick items off the shopping list"
                    : "e.g. Let me sort recipes by how often I cook them"
                }
                aria-label="Summary"
                className="form-input w-full"
              />
              <textarea
                value={fbBody}
                onChange={(e) => setFbBody(e.target.value)}
                maxLength={5000}
                rows={5}
                placeholder={
                  fbType === "bug"
                    ? "What did you do, what did you expect, and what happened instead?"
                    : "What would it let you do that you can't today?"
                }
                aria-label="Details"
                className="form-input w-full resize-y"
              />

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={!fbTitle.trim() || fbSending}
                  className="pill-primary"
                >
                  {fbSending ? "Sending…" : "Send report"}
                </button>
                {fbResult && (
                  <a
                    href={fbResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] font-semibold text-sage hover:underline"
                  >
                    ✓ Filed as #{fbResult.number} — track it here ↗
                  </a>
                )}
                {fbError && (
                  <span className="text-[13px] text-danger">{fbError}</span>
                )}
              </div>
            </form>
          </section>
        )}

        {section === "data" && (
          <div className="space-y-4">
            <section className="card-surface p-4 sm:p-[18px]">
              <h2 className="font-serif text-[21px] font-semibold text-primary">
                Data &amp; export
              </h2>
              <p className="meta mt-1">
                Your recipes as JSON — everything you’ve saved, yours to take.
              </p>
              <button
                onClick={exportRecipes}
                disabled={exporting}
                className="pill-outline mt-3"
              >
                {exporting ? "Preparing…" : "Export recipes"}
              </button>
            </section>

            <section className="rounded-card border border-danger-line bg-danger-bg p-4 sm:p-[18px]">
              <h2 className="font-serif text-[21px] font-semibold text-danger">
                Delete account data
              </h2>
              <p className="mt-1 text-[13px] text-textgray">
                Permanently deletes your recipes, meal plans and shopping lists,
                then signs you out. This cannot be undone.
              </p>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="mt-3 rounded-pill border border-danger px-4 py-2 text-[13px] font-semibold text-danger transition hover:bg-danger hover:text-white"
                >
                  Delete everything
                </button>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-danger">
                    Are you sure?
                  </span>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="pill-outline"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteEverything}
                    disabled={deleting}
                    className="rounded-pill bg-danger px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-110"
                  >
                    {deleting ? "Deleting…" : "Yes, delete everything"}
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
