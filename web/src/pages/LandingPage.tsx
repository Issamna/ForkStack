import { SignInButton, SignUpButton, useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";
import { imageForTags } from "../lib/imageHelper";
import { appUrl } from "../lib/paths";

const base = import.meta.env.BASE_URL;

/**
 * Public marketing page.
 *
 * The product shots are static markup, deliberately: they are miniatures of the
 * real screens, not live components, so this page never depends on app state or
 * an authenticated API call.
 */
export default function LandingPage() {
  const { isLoaded, isSignedIn } = useAuth();

  // Render the pitch while Clerk boots rather than flashing an empty page;
  // only bounce once we actually know there's a session.
  if (isLoaded && isSignedIn) return <Navigate to="/recipes" replace />;

  return (
    <div className="min-h-screen bg-paper">
      {/* Nav */}
      <header className="mx-auto flex h-[66px] max-w-[1240px] items-center justify-between px-5 sm:px-10">
        <div className="flex items-center gap-2.5">
          <img
            src={`${base}assets/logo.png`}
            alt=""
            className="h-8 w-8 rounded-[7px]"
          />
          <span className="wordmark">fork-stack</span>
        </div>
        <nav className="flex items-center gap-3 sm:gap-5">
          <a
            href="#how-it-works"
            className="hidden text-[14px] font-medium text-muted transition hover:text-primary sm:inline"
          >
            How it works
          </a>
          <SignInButton mode="modal" fallbackRedirectUrl={appUrl("/recipes")}>
            <button className="text-[14px] font-medium text-muted transition hover:text-primary">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal" fallbackRedirectUrl={appUrl("/recipes")}>
            <button className="pill-primary">Start free</button>
          </SignUpButton>
        </nav>
      </header>

      <main className="mx-auto max-w-[1240px] px-5 sm:px-10">
        {/* Hero */}
        <section className="grid items-center gap-11 pt-8 sm:pt-14 lg:grid-cols-2">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-sage">
              A minimal recipe book
            </p>
            <h1 className="mt-4 font-serif text-[38px] font-semibold leading-[1.03] tracking-[-0.022em] text-primary sm:text-[62px]">
              The recipes you actually cook, in one place.
            </h1>
            <p className="mt-5 max-w-[470px] text-[17px] leading-[1.6] text-[#6E675E]">
              fork-stack keeps your recipes, plans your week, and hands you the
              shopping list. No feed, no ads, no life story before the
              ingredients — just the food you make.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <SignUpButton mode="modal" fallbackRedirectUrl={appUrl("/recipes")}>
                <button className="h-[50px] rounded-[26px] bg-terracotta px-7 text-[15px] font-semibold text-white transition hover:brightness-95 sm:h-auto sm:py-3.5">
                  Start your recipe book
                </button>
              </SignUpButton>
              <SignInButton mode="modal" fallbackRedirectUrl={appUrl("/recipes")}>
                <button className="h-[50px] rounded-[26px] border border-field bg-card px-7 text-[15px] font-semibold text-primary transition hover:border-terracotta-line sm:h-auto sm:py-3.5">
                  I already have one
                </button>
              </SignInButton>
            </div>
            <p className="mt-4 text-[13px] text-muted">
              Free, and private by default. Import your first recipe from a URL
              in about a minute.
            </p>
          </div>

          <ProductShot />
        </section>

        {/* Proof cards */}
        <section
          id="how-it-works"
          className="grid gap-[18px] pb-4 pt-14 sm:pt-16 lg:grid-cols-3"
        >
          <ProofCard
            eyebrow="Save"
            heading="Save it once, find it forever"
            body="Paste a link and fork-stack pulls out the ingredients and the steps. Or type it in yourself. Add your own photo, or let us pick one."
          >
            <div className="flex h-9 items-center rounded-pill border border-field bg-card px-3 text-[12px] text-placeholder">
              bbcgoodfood.com/recipes/…
            </div>
            <div className="mt-2.5 flex items-center gap-2.5">
              <span className="rounded-pill bg-accent px-3 py-1 text-[12px] font-semibold text-primary">
                Import
              </span>
              <span className="text-[12px] text-muted">
                ✓ 14 ingredients, 3 steps
              </span>
            </div>
          </ProofCard>

          <ProofCard
            eyebrow="Plan"
            heading="Plan the week in a minute"
            body="Drop recipes onto days. Cooking for four instead of two? Change the servings and everything scales with it."
          >
            <div className="grid grid-cols-4 gap-2">
              <MiniDay day="Mon" label="Pasta" tag="dinner" />
              <MiniDay day="Tue" label="Chili" tag="soup" />
              <div className="rounded-tile border border-terracotta-line bg-terracotta-tint p-1.5">
                <div className="text-[9px] font-bold uppercase tracking-[0.06em] text-muted-2">
                  Wed
                </div>
                <div className="mt-3 text-[9px] font-bold uppercase tracking-[0.05em] text-terracotta">
                  Eating out
                </div>
              </div>
              <div className="flex items-center justify-center rounded-tile border border-dashed border-terracotta-line text-[15px] text-terracotta">
                +
              </div>
            </div>
          </ProofCard>

          <ProofCard
            eyebrow="Shop"
            heading="Shop without thinking"
            body="One list from the whole week's plan — duplicate ingredients added together, everything sorted by aisle, ticked off as you go."
          >
            <div className="eyebrow-terracotta">Produce</div>
            <ul className="mt-1.5 space-y-1.5">
              <MiniRow qty="2 lb" name="sweet potatoes" />
              <MiniRow qty="1" name="shallot" checked />
              <MiniRow qty="2" name="garlic cloves" />
            </ul>
            <p className="mt-2 text-[11px] text-muted-2">
              + 25 more, grouped by aisle
            </p>
          </ProofCard>
        </section>
      </main>

      {/* Manifesto band */}
      <section className="mt-14 bg-primary px-5 py-16 text-center sm:px-10">
        <div className="mx-auto max-w-[820px]">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent">
            Deliberately small
          </p>
          <p className="mt-4 font-serif text-[26px] font-medium leading-[1.32] text-paper sm:text-[34px]">
            Most recipe apps want to be a social network. This one is a place to
            put recipes so you can find them again.
          </p>
          <p className="mt-5 text-[16px] leading-[1.65] text-[#C6CBD3]">
            It stores what you save, keeps it yours, and gets out of the way —
            the digital version of the index box on the counter, minus the
            handwriting.
          </p>
          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[13px] text-accent">
            <li>No feed</li>
            <li>No ads</li>
            <li>Private by default</li>
            <li>Export everything, any time</li>
          </ul>
        </div>
      </section>

      {/* Closing ask */}
      <section className="px-5 py-16 text-center sm:px-10 sm:py-20">
        <h2 className="font-serif text-[30px] font-semibold text-primary sm:text-[44px]">
          Stop losing recipes to browser tabs.
        </h2>
        <p className="mt-3 text-[16px] text-muted">
          Save the first one in about a minute.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <SignUpButton mode="modal" fallbackRedirectUrl={appUrl("/recipes")}>
            <button className="h-[50px] rounded-[26px] bg-terracotta px-7 text-[15px] font-semibold text-white transition hover:brightness-95 sm:h-auto sm:py-3.5">
              Start your recipe book
            </button>
          </SignUpButton>
          <SignInButton mode="modal" fallbackRedirectUrl={appUrl("/recipes")}>
            <button className="h-[50px] rounded-[26px] border border-field bg-card px-7 text-[15px] font-semibold text-primary transition hover:border-terracotta-line sm:h-auto sm:py-3.5">
              Sign in
            </button>
          </SignInButton>
        </div>
      </section>

      <footer className="border-t border-line px-5 py-6 sm:px-10">
        <div className="mx-auto flex max-w-[1240px] items-center gap-2.5">
          <img
            src={`${base}assets/logo.png`}
            alt=""
            className="h-6 w-6 rounded"
          />
          <span className="text-[13px] text-muted">
            fork-stack — a minimal recipe book.
          </span>
        </div>
      </footer>
    </div>
  );
}

function ProofCard({
  eyebrow,
  heading,
  body,
  children,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-line bg-card">
      <div className="flex-1 p-5">
        <p className="eyebrow-terracotta">{eyebrow}</p>
        <h3 className="mt-2 font-serif text-[23px] font-semibold text-primary">
          {heading}
        </h3>
        <p className="mt-2.5 text-[14px] leading-[1.6] text-textgray">{body}</p>
      </div>
      {/* Working detail, pinned to the bottom of every card. */}
      <div className="border-t border-line-soft bg-cardalt p-5">{children}</div>
    </div>
  );
}

function MiniDay({
  day,
  label,
  tag,
}: {
  day: string;
  label: string;
  tag: string;
}) {
  return (
    <div className="rounded-tile border border-line bg-card p-1.5">
      <div className="text-[9px] font-bold uppercase tracking-[0.06em] text-muted-2">
        {day}
      </div>
      <img
        src={imageForTags([tag], tag)}
        alt=""
        className="mt-1 h-7 w-full rounded object-cover"
      />
      <div className="mt-1 truncate font-serif text-[11px] font-semibold text-primary">
        {label}
      </div>
    </div>
  );
}

function MiniRow({
  qty,
  name,
  checked,
}: {
  qty: string;
  name: string;
  checked?: boolean;
}) {
  return (
    <li className="flex items-center gap-2 text-[12px]">
      <span
        className={`flex h-[14px] w-[14px] flex-shrink-0 items-center justify-center rounded-[4px] text-[9px] ${
          checked
            ? "bg-accent text-primary"
            : "border-[1.5px] border-check bg-card"
        }`}
      >
        {checked ? "✓" : ""}
      </span>
      <span className={checked ? "text-muted-2 line-through" : "text-textgray"}>
        <span className={checked ? "" : "font-semibold text-primary"}>
          {qty}
        </span>{" "}
        {name}
      </span>
    </li>
  );
}

/** Miniature of the library screen. Static markup, not the real component. */
function ProductShot() {
  const rows = [
    { title: "Creamy Spicy Chicken Pasta", meta: "35 min · 4", tag: "dinner" },
    { title: "Sweet Potato Fries", meta: "40 min · 4", tag: "side" },
    { title: "White Bean Chili", meta: "45 min · 5", tag: "soup" },
    { title: "Chickpea Sandwich Filling", meta: "15 min · 2", tag: "sandwich" },
    { title: "Shrimp Fried Rice", meta: "25 min · 3", tag: "main course" },
  ];

  return (
    <div className="overflow-hidden rounded-[14px] bg-card shadow-shot">
      {/* Faux title bar */}
      <div className="flex h-[34px] items-center gap-2 border-b border-line px-3">
        <span className="flex gap-1.5">
          {["#E7CFBE", "#EDE4D5", "#F0E8DA"].map((c) => (
            <span
              key={c}
              className="h-[9px] w-[9px] rounded-full"
              style={{ backgroundColor: c }}
            />
          ))}
        </span>
        <span className="text-[11px] text-muted-2">
          fork-stack — your cookbook
        </span>
      </div>

      <div className="grid grid-cols-[200px_1fr]">
        {/* Index column */}
        <div className="border-r border-line bg-cardalt p-2">
          <div className="flex h-7 items-center rounded-pill border border-field bg-card px-2.5 text-[10px] text-placeholder">
            ⌕ Filter 42 recipes
          </div>
          <ul className="mt-2 space-y-0.5">
            {rows.map((r, i) => (
              <li
                key={r.title}
                className={`flex items-center gap-2 rounded-[7px] p-1.5 ${
                  i === 0 ? "border border-terracotta-line bg-terracotta-tint" : ""
                }`}
              >
                <img
                  src={imageForTags([r.tag], r.tag)}
                  alt=""
                  className="h-6 w-6 flex-shrink-0 rounded object-cover"
                />
                <span className="min-w-0">
                  <span className="block truncate font-serif text-[10px] font-semibold leading-tight text-primary">
                    {r.title}
                  </span>
                  <span className="block text-[8px] text-muted-2">
                    {r.meta}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Preview pane */}
        <div>
          <img
            src={imageForTags(["dinner"], "dinner")}
            alt=""
            className="h-[86px] w-full object-cover"
          />
          <div className="border-b border-line-soft p-3">
            <div className="font-serif text-[13px] font-semibold text-primary">
              Easy Creamy Spicy Chicken Pasta
            </div>
            <div className="mt-2 flex gap-1.5">
              <span className="rounded-pill bg-terracotta px-2 py-0.5 text-[9px] font-semibold text-white">
                Add to plan
              </span>
              <span className="rounded-pill border border-field px-2 py-0.5 text-[9px] font-semibold text-primary">
                Cook mode
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-3">
            <div>
              <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-muted-2">
                Ingredients · 12
              </div>
              <ul className="mt-1 space-y-0.5 text-[9px] text-textgray">
                <li>
                  <b className="text-primary">350 g</b> chicken breast
                </li>
                <li>
                  <b className="text-primary">250 g</b> rigatoni
                </li>
                <li>
                  <b className="text-primary">75 g</b> cream cheese
                </li>
                <li>
                  <b className="text-primary">1 tbsp</b> tomato paste
                </li>
              </ul>
              <div className="mt-1.5 rounded border border-plan-line bg-plan-bg px-1.5 py-1 text-[8px] text-sage">
                7 of 12 on your list
              </div>
            </div>
            <div>
              <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-muted-2">
                Method
              </div>
              <ol className="mt-1 space-y-1.5">
                {[
                  "Cook the rigatoni until just shy of al dente.",
                  "Sear the chicken, then add shallot, garlic and paprika.",
                  "Stir through cream cheese and finish with parsley.",
                ].map((t, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full bg-terracotta-tint text-[8px] font-semibold text-terracotta">
                      {i + 1}
                    </span>
                    <span className="text-[9px] leading-[1.45] text-textgray">
                      {t}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
