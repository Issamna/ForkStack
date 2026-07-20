---
name: code-map
description: Map of ForkStack's backend routers/services/models, React frontend pages/lib, and CDK stacks. Read instead of running find/ls/grep to locate where a feature lives. Update it when adding or moving a router, service, model, page, or table.
---

# Code map

Two apps in one repo: FastAPI backend in `src/` (one Lambda), React (Vite) frontend in `web/`. Auth is Clerk. CDK (`infrastructure/`) deploys both.
**Maintenance: if you add/move/delete a router, service, model, React page, `lib/api` method, or DynamoDB table, update this file in the same PR.**

## Backend (`src/`)

Runs rooted at `src/` — modules import as top-level (`from services import ...`). `api.py` builds the FastAPI app, mounts one router per domain, and exports `handler = Mangum(app)` for Lambda.

| Prefix | Router (`services/`) | Model (`models/`) | Table env var | Notes |
|---|---|---|---|---|
| `/recipes` | `recipe_service.py` | `recipe.py` (`RecipeIn/Out`, `URLIn`, `RecipeTag`) | `RECIPE_TABLE` | CRUD + `/search` + `/{id}/pdf` (base64) + `/parse-url` (URL import) |
| `/users` | `user_service.py` | — | — | only `DELETE /me` (cascades app-data deletion). Identity/login/profile are **Clerk**, not here. |
| `/tags` | `tag_service.py` | `recipe.py::RecipeTag` | `RECIPE_TAG_TABLE` | list/get/create |
| `/ingredients` | `ingredient_service.py` | `ingredient.py` | `INGREDIENT_TABLE` | shared **add-only** catalog (list/get/create; no PUT/DELETE); USDA-seeded |
| `/meal-plan` | `meal_plan_service.py` | `meal_plan.py` | `MEAL_PLAN_TABLE` | GET/PUT by `?week=YYYY-MM-DD` |
| `/shopping-list` | `shopping_list_service.py` | `shopping_list.py` | `SHOPPING_LIST_TABLE` | `/generate`, GET, PUT by `?week=` |

Each service binds its own `boto3` table handle at **import time** (`table = dynamodb.Table(os.environ.get("X_TABLE", "default"))`) — tests patch `services.<name>.table`, not boto3.

### Shared backend pieces
- `dependencies.py` — `get_current_user` verifies the **Clerk** RS256 JWT against Clerk's JWKS (`CLERK_ISSUER`, cached) and returns the Clerk user id (`sub`); nearly every route depends on it. No shared secret. (There is no `utils/auth.py`/`security.py`/`recaptcha.py`/`secrets.py` — Clerk replaced homegrown auth.)
- `utils/db.py` — `scan_all(table, **kwargs)`; every service scan goes through it (a raw `table.scan().get("Items")` silently truncates past 1 MB).
- `utils/parser.py` — `recipe_scraper(url)` (recipe-scrapers + BeautifulSoup); outbound HTTP, why Lambda timeout is 29s.
- `utils/pdf.py` — `build_recipe_pdf` (reportlab).
- `utils/ingredients.py` (`canonical_name/unit`, `clean_name`), `utils/quantity.py` (`parse_quantity`, `format_quantity`, `parse_servings`), `utils/categories.py` (`categorize` → grocery aisle) — the shopping-list aggregation stack.
- `scripts/` — one-off USDA import / tag backfill tooling (hard-coded keys/URLs; **not** in the request path).

## Frontend (`web/`, React 19 + Vite + TypeScript + Tailwind)

`web/src/main.tsx` mounts `<ClerkProvider>` (publishable key from `VITE_CLERK_PUBLISHABLE_KEY`) around the router. `web/src/router.tsx` defines routes; `components/RequireAuth.tsx` (Clerk `<SignedIn>`/`<RedirectToSignIn>`) gates the app routes. `web/src/App.tsx` is the shell (navbar: logo, add-recipe, meal-plan, shopping-list icons, Clerk `<UserButton>`).

| Route | Page (`web/src/pages/`) |
|---|---|
| `/` → `/recipes` | — (redirect) |
| `/sign-in/*`, `/sign-up/*` | `SignInPage`, `SignUpPage` (embedded Clerk `<SignIn>`/`<SignUp>`) |
| `/recipes`, `/recipes/new`, `/recipes/:id`, `/recipes/:id/edit` | `RecipesPage`, `RecipeFormPage`, `RecipeDetailPage` |
| `/meal-plan` | `MealPlanPage` |
| `/shopping-list` | `ShoppingListPage` |
| `/account` | `AccountPage` (Clerk `<UserProfile>`; not in nav — reachable via the UserButton) |

### Frontend lib (`web/src/lib/`)
- `api.ts` — the single typed fetch layer (`api.recipes/mealPlan/shoppingList/users`); attaches the Clerk session token (`window.Clerk.session.getToken()`) to every request. Base URL from `VITE_API_BASE` (falls back to the deployed API Gateway).
- `types.ts` — the API contract interfaces (Recipe, MealEntry, ShoppingItem, Tag).
- `imageHelper.ts` — `imageForTags(tags, seed)`, deterministic tag→image pick (seed by recipe id so grids don't flicker).
- Identity comes from Clerk's `useAuth().userId`; ownership-aware UI compares it to `recipe.owner_id`.

## Infrastructure (`infrastructure/`, entry `app.py`)
- `app_stack.py` — **AppStack**: 5 DynamoDB tables (Recipe/RecipeTag default; Ingredient/MealPlan/ShoppingList=RETAIN; no UserTable — identity is Clerk), `PythonFunction` Lambda from `src/` (`api.py::handler`, py3.12, 29s, 512MB), proxy `LambdaRestApi` with stage throttling. `CLERK_ISSUER`/`CLERK_AUTHORIZED_PARTIES` + table env vars + `ALLOWED_ORIGINS` set here. No Secrets Manager.
- `frontend_stack.py` — **FrontendStack**: S3 + CloudFront, SPA 403/404→index fallback, security-headers policy (CSP Report-Only, allows Clerk), deploys `web/dist-cloudfront`.
