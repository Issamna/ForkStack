import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";

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
