import { Link, Outlet } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";

const base = import.meta.env.BASE_URL;

/** App shell: navbar + routed content. */
export default function Layout() {
  return (
    <>
      <nav className="navbar">
        <div className="logo-wrapper">
          <Link to="/recipes" className="flex items-center gap-3 transition">
            <img
              src={`${base}assets/logo.png`}
              alt="Forkstack"
              className="logo-image"
            />
            <span className="logo-text">fork-stack</span>
          </Link>
          <Link to="/recipes/new" className="add-button ml-4" title="Add recipe">
            +
          </Link>
          <Link
            to="/meal-plan"
            className="add-button ml-2"
            aria-label="Meal plan"
          >
            <svg
              className="h-7 w-7 sm:h-9 sm:w-9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </Link>
        </div>
        <div className="absolute right-4 top-3 flex items-center gap-4">
          <Link
            to="/shopping-list"
            className="text-sm font-semibold text-textgray hover:text-accent"
          >
            Shopping list
          </Link>
          <Link
            to="/account"
            className="text-sm font-semibold text-textgray hover:text-accent"
          >
            Account
          </Link>
          <UserButton />
        </div>
      </nav>
      <main className="p-4">
        <Outlet />
      </main>
    </>
  );
}
