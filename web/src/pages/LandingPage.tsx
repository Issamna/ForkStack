import { SignInButton, SignUpButton, useAuth } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";

const base = import.meta.env.BASE_URL;

const FEATURES = [
  {
    title: "Save it once, find it forever",
    body: "Paste a link and ForkStack pulls out the ingredients and the steps. Or type it in yourself. Add your own photo, or let us pick one.",
    icon: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </>
    ),
  },
  {
    title: "Plan the week in a minute",
    body: "Drop recipes onto days. Cooking for four instead of two? Change the servings and everything scales with it.",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </>
    ),
  },
  {
    title: "Shop without thinking",
    body: "One list from the whole week's plan — duplicate ingredients added together, everything sorted by aisle, ticked off as you go.",
    icon: (
      <>
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </>
    ),
  },
];

export default function LandingPage() {
  const { isLoaded, isSignedIn } = useAuth();

  // Render the pitch while Clerk boots rather than flashing an empty page;
  // only bounce once we actually know there's a session.
  if (isLoaded && isSignedIn) return <Navigate to="/recipes" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <img
            src={`${base}assets/logo.png`}
            alt=""
            className="h-9 w-9 sm:h-10 sm:w-10"
          />
          <span className="text-xl font-bold text-textgray sm:text-2xl">
            fork-stack
          </span>
        </div>
        <SignInButton mode="modal" fallbackRedirectUrl="/recipes">
          <button className="rounded-lg px-3 py-2 text-sm font-semibold text-textgray transition hover:bg-black/5 sm:text-base">
            Sign in
          </button>
        </SignInButton>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        {/* Hero */}
        <section className="py-14 text-center sm:py-24">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-sage">
            A minimal recipe book
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight text-primary sm:text-6xl">
            The recipes you actually cook, in one place.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-textgray sm:text-lg">
            ForkStack keeps your recipes, plans your week, and hands you the
            shopping list. No feed, no ads, no life story before the
            ingredients — just the food you make.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <SignUpButton mode="modal" fallbackRedirectUrl="/recipes">
              <button className="w-full max-w-xs rounded-lg bg-primary px-7 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-sage sm:w-auto">
                Start your recipe book
              </button>
            </SignUpButton>
            <SignInButton mode="modal" fallbackRedirectUrl="/recipes">
              <button className="w-full max-w-xs rounded-lg border border-gray-300 px-7 py-3.5 text-base font-semibold text-textgray transition hover:border-sage hover:text-sage sm:w-auto">
                I already have one
              </button>
            </SignInButton>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            Free, and private by default.
          </p>
        </section>

        {/* What it does */}
        <section className="grid gap-5 pb-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <svg
                className="mb-4 h-7 w-7 text-sage"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {f.icon}
              </svg>
              <h2 className="mb-2 text-lg font-semibold text-primary">
                {f.title}
              </h2>
              <p className="text-sm leading-relaxed text-textgray">{f.body}</p>
            </div>
          ))}
        </section>

        {/* Positioning */}
        <section className="mx-auto max-w-2xl py-16 text-center sm:py-20">
          <h2 className="text-2xl font-bold text-primary sm:text-3xl">
            Deliberately small
          </h2>
          <p className="mt-4 text-base leading-relaxed text-textgray">
            Most recipe apps want to be a social network. This one is a place to
            put recipes so you can find them again. It stores what you save,
            keeps it yours, and gets out of the way — the digital version of the
            index box on the counter, minus the handwriting.
          </p>
        </section>

        {/* Closing CTA */}
        <section className="mb-16 rounded-2xl bg-primary px-6 py-12 text-center sm:py-14">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Stop losing recipes to browser tabs.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/80 sm:text-base">
            Save the first one in about a minute.
          </p>
          <SignUpButton mode="modal" fallbackRedirectUrl="/recipes">
            <button className="mt-7 w-full max-w-xs rounded-lg bg-accent px-7 py-3.5 text-base font-semibold text-primary transition hover:bg-white sm:w-auto">
              Start your recipe book
            </button>
          </SignUpButton>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-6 text-center text-xs text-gray-500">
        ForkStack — a minimal recipe book.
      </footer>
    </div>
  );
}
