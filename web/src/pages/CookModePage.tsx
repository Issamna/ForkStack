import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { ingredientsForStep } from "../lib/steps";
import type { Recipe } from "../lib/types";

/**
 * Step-by-step cooking view. Full-bleed dark panel, one step at a time, sized
 * to be readable at arm's length with messy hands.
 */
export default function CookModePage() {
  const { id } = useParams();
  const [recipe, setRecipe] = useState<Recipe>();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!id) return;
    api.recipes.get(id).then(setRecipe).catch(() => setRecipe(undefined));
  }, [id]);

  // Don't let the screen sleep mid-recipe. Not supported everywhere, and the
  // lock is dropped by the browser on tab switch, so re-acquire on visibility.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        lock = await navigator.wakeLock?.request("screen");
      } catch {
        /* denied or unsupported -- cook mode still works */
      }
    }
    function onVisible() {
      if (document.visibilityState === "visible" && !cancelled) acquire();
    }

    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  const steps = recipe?.instructions ?? [];
  const current = steps[step];

  // Ingredients this step actually mentions -- see lib/steps.ts for why the
  // matching is whole-word rather than a substring test.
  const forThisStep = useMemo(
    () => (recipe && current ? ingredientsForStep(recipe.ingredients, current.text) : []),
    [recipe, current],
  );

  if (!recipe) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-primary">
        <p className="text-[14px] text-accent">Loading recipe…</p>
      </div>
    );
  }

  if (!steps.length) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-primary px-6 text-center">
        <p className="text-paper">This recipe has no steps to cook through.</p>
        <Link to={`/recipes/${recipe.recipe_id}`} className="pill-accent">
          Back to the recipe
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-primary px-5 pb-6 pt-4 text-paper">
      <header className="flex items-center justify-between">
        <Link
          to={`/recipes/${recipe.recipe_id}`}
          className="text-[14px] text-paper/80 hover:text-paper"
        >
          ‹ Recipe
        </Link>
        <span className="rounded-pill bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-primary">
          Cook mode
        </span>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col pt-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-accent">
          Step {step + 1} of {steps.length}
        </p>
        <h1 className="mt-1 font-serif text-[26px] font-semibold leading-tight">
          {recipe.title}
        </h1>

        <p className="mt-6 text-[21px] leading-[1.5]">{current.text}</p>

        {forThisStep.length > 0 && (
          <div className="mt-7 rounded-card border border-accent/35 bg-paper/[0.08] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-accent">
              For this step
            </p>
            <ul className="mt-2 space-y-1">
              {forThisStep.map((i, n) => (
                <li key={n} className="text-[14px]">
                  <span className="font-semibold">
                    {i.quantity} {i.measurement_type}
                  </span>{" "}
                  {i.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-auto pt-8">
          <div className="flex gap-3">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              aria-label="Previous step"
              className="h-14 w-16 flex-shrink-0 rounded-card border border-accent/35 text-[20px] transition disabled:opacity-30"
            >
              ‹
            </button>
            <button
              onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
              disabled={step >= steps.length - 1}
              className="h-14 flex-1 rounded-card bg-accent text-[15px] font-semibold text-primary transition disabled:opacity-30"
            >
              {step >= steps.length - 1 ? "Last step" : "Next step ›"}
            </button>
          </div>

          <div className="mt-4 flex gap-1.5">
            {steps.map((s, i) => (
              <span
                key={s.step_number}
                className={`h-1.5 flex-1 rounded-full transition ${
                  i <= step ? "bg-accent" : "bg-paper/20"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
