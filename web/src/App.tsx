import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { UserButton } from "./lib/auth";

const base = import.meta.env.BASE_URL;

const NAV = [
  { to: "/recipes", label: "Recipes" },
  { to: "/meal-plan", label: "Meal plan" },
  { to: "/shopping-list", label: "Shopping list" },
];

/** App shell: warm-index header + routed content. */
export default function Layout() {
  const { pathname } = useLocation();
  // Right-hand actions are per-screen. Only the recipes actions have a route
  // to point at today; meal plan and shopping list keep their in-page controls
  // until those screens are redesigned.
  const onRecipes = pathname.startsWith("/recipes");
  const onMealPlan = pathname.startsWith("/meal-plan");

  return (
    <div className="min-h-screen bg-paper">
      <header className="app-header">
        <Link to="/recipes" className="flex flex-shrink-0 items-center gap-2.5">
          <img
            src={`${base}assets/logo.png`}
            alt=""
            className="h-7 w-7 rounded-[7px]"
          />
          <span className="wordmark hidden sm:inline">fork-stack</span>
        </Link>

        <nav className="flex min-w-0 items-center gap-4 overflow-x-auto sm:gap-5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-link whitespace-nowrap ${isActive ? "nav-link-active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex flex-shrink-0 items-center gap-2">
          {onRecipes && (
            <>
              <Link
                to="/recipes/new?import=1"
                className="pill-outline hidden md:inline-flex"
              >
                Import from URL
              </Link>
              {/* Full label on desktop, 44px icon target on a phone. */}
              <Link to="/recipes/new" className="pill-primary hidden sm:inline-flex">
                + Add recipe
              </Link>
              <Link
                to="/recipes/new"
                aria-label="Add recipe"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-terracotta text-2xl font-semibold leading-none text-white sm:hidden"
              >
                +
              </Link>
            </>
          )}
          {onMealPlan && (
            /* ?add=1 opens the plan's own dialog, which owns the entry state. */
            <>
              <Link
                to="/meal-plan?add=1"
                className="pill-primary hidden sm:inline-flex"
              >
                + Add to plan
              </Link>
              <Link
                to="/meal-plan?add=1"
                aria-label="Add to plan"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-terracotta text-2xl font-semibold leading-none text-white sm:hidden"
              >
                +
              </Link>
            </>
          )}
          {/* The account screen holds cooking preferences, export, delete and
              the bug reporter. Nothing linked to it after the old "redundant"
              Account link was dropped, which left all of that unreachable. */}
          <Link
            to="/account"
            className="nav-button"
            aria-label="Account and settings"
            title="Account and settings"
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
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
          <UserButton
            appearance={{ elements: { avatarBox: { width: 30, height: 30 } } }}
          />
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
