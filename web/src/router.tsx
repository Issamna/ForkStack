import { createBrowserRouter } from "react-router-dom";
import Layout from "./App";
import RequireAuth from "./components/RequireAuth";
import CookModePage from "./pages/CookModePage";
import LandingPage from "./pages/LandingPage";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import RecipesPage from "./pages/RecipesPage";
import RecipeDetailPage from "./pages/RecipeDetailPage";
import RecipeFormPage from "./pages/RecipeFormPage";
import MealPlanPage from "./pages/MealPlanPage";
import ShoppingListPage from "./pages/ShoppingListPage";
import AccountPage from "./pages/AccountPage";

// '/ForkStack' in production, '' in dev (see vite.config base).
const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

export const router = createBrowserRouter(
  [
    // Public: the pitch. Signed-in visitors are redirected to /recipes by the
    // page itself, so the marketing shell never wraps the app.
    { path: "/", element: <LandingPage /> },
    { path: "/sign-in/*", element: <SignInPage /> },
    { path: "/sign-up/*", element: <SignUpPage /> },
    // Cook mode is deliberately outside the shell: full-bleed dark panel with
    // its own back link, no app header competing for the screen.
    {
      path: "/recipes/:id/cook",
      element: (
        <RequireAuth>
          <CookModePage />
        </RequireAuth>
      ),
    },
    {
      element: (
        <RequireAuth>
          <Layout />
        </RequireAuth>
      ),
      children: [
        { path: "/recipes", element: <RecipesPage /> },
        { path: "/recipes/new", element: <RecipeFormPage /> },
        { path: "/recipes/:id", element: <RecipeDetailPage /> },
        { path: "/recipes/:id/edit", element: <RecipeFormPage /> },
        { path: "/meal-plan", element: <MealPlanPage /> },
        { path: "/shopping-list", element: <ShoppingListPage /> },
        { path: "/account", element: <AccountPage /> },
      ],
    },
  ],
  { basename },
);
