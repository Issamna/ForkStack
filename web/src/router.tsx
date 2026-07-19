import { createBrowserRouter, Navigate } from "react-router-dom";
import Layout from "./App";
import RequireAuth from "./components/RequireAuth";
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
    { path: "/sign-in/*", element: <SignInPage /> },
    { path: "/sign-up/*", element: <SignUpPage /> },
    {
      element: (
        <RequireAuth>
          <Layout />
        </RequireAuth>
      ),
      children: [
        { path: "/", element: <Navigate to="/recipes" replace /> },
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
