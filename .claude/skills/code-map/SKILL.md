---
name: code-map
description: Map of ForkStack's backend routers/services/models, frontend Angular pages/services, and CDK stacks. Read instead of running find/ls/grep to locate where a feature lives. Update it when adding or moving a router, service, model, page, or table.
---

# Code map

Two apps in one repo: FastAPI backend in `src/` (one Lambda), Angular 16 frontend in `forkstack-frontend/`. CDK (`infrastructure/`) deploys both.
**Maintenance: if you add/move/delete a router, service, model, page, Angular service, or DynamoDB table, update this file in the same PR.**

## Backend (`src/`)

Runs rooted at `src/` — modules import as top-level (`from services import ...`). `api.py` builds the FastAPI app, mounts one router per domain, and exports `handler = Mangum(app)` for Lambda.

| Prefix | Router (`services/`) | Model (`models/`) | Table env var | Notes |
|---|---|---|---|---|
| `/recipes` | `recipe_service.py` | `recipe.py` (`RecipeIn/Out`, `URLIn`, `RecipeTag`) | `RECIPE_TABLE` | CRUD + `/search` + `/{id}/pdf` (base64) + `/parse-url` (URL import) |
| `/users` | `user_service.py` | `user.py`, `token.py` | `USER_TABLE` | register, `/login` (form POST → JWT), `/me` GET/PATCH/DELETE, `/me/change-password` |
| `/tags` | `tag_service.py` | `recipe.py::RecipeTag` | `RECIPE_TAG_TABLE` | list/get/create |
| `/ingredients` | `ingredient_service.py` | `ingredient.py` | `INGREDIENT_TABLE` | CRUD; USDA-seeded |
| `/meal-plan` | `meal_plan_service.py` | `meal_plan.py` | `MEAL_PLAN_TABLE` | GET/PUT by `?week=YYYY-MM-DD` |
| `/shopping-list` | `shopping_list_service.py` | `shopping_list.py` | `SHOPPING_LIST_TABLE` | `/generate`, GET, PUT by `?week=` |

Each service binds its own `boto3` table handle at **import time** (`table = dynamodb.Table(os.environ.get("X_TABLE", "default"))`) — tests patch `services.<name>.table`, not boto3.

### Shared backend pieces
- `dependencies.py` — `get_current_user` (decodes JWT → `user_id`); nearly every route depends on it.
- `utils/db.py` — `scan_all(table, **kwargs)`; every service scan goes through it (a raw `table.scan().get("Items")` silently truncates past 1 MB).
- `utils/auth.py` — `create_access_token`, `get_jwt_secret` (env `JWT_SECRET_KEY` → else Secrets Manager `JWT_SECRET_ARN`; no insecure default).
- `utils/secrets.py` — resolve a secret by env-var-holding-the-ARN, per-process cached.
- `utils/security.py` — passlib `pbkdf2_sha256` hash/verify.
- `utils/recaptcha.py` — v3 verify, gated by `ENFORCE_RECAPTCHA` (currently off).
- `utils/parser.py` — `recipe_scraper(url)` (recipe-scrapers + BeautifulSoup); outbound HTTP, why Lambda timeout is 29s.
- `utils/pdf.py` — `build_recipe_pdf` (reportlab).
- `utils/ingredients.py` (`canonical_name/unit`, `clean_name`), `utils/quantity.py` (`parse_quantity`, `format_quantity`, `parse_servings`), `utils/categories.py` (`categorize` → grocery aisle) — the shopping-list aggregation stack.
- `scripts/` — one-off USDA import / tag backfill tooling (hard-coded keys/URLs; **not** in the request path).

## Frontend (`forkstack-frontend/src/app/`)

Root `AppModule` declares login/register/forgot-password/account/meal-plan/shopping-list; `recipes/` is a **lazy-loaded feature module** (`recipes.module.ts`). Routes in `app-routing.module.ts`; `AuthGuard` protects recipes, account, meal-plan, shopping-list. `AuthInterceptor` attaches the bearer token to every request and logs out on 401.

| Route | Component dir |
|---|---|
| `/` → `/recipes` | — (redirect) |
| `/recipes`, `/recipes/new`, `/recipes/:id`, `/recipes/:id/edit` | `recipes/` (`recipes-routing.module.ts`; detail + `recipe-form/`) |
| `/login`, `/register`, `/forgot-password` | `login/`, `register/`, `forgot-password/` (forgot = stub, no backend) |
| `/account` | `account/` |
| `/meal-plan` | `meal-plan/` |
| `/shopping-list` | `shopping-list/` |

App shell: `app.component.html` (navbar + dropdown menu + `<router-outlet>`).

### Angular services (`app/services/` and feature dirs)
- `services/auth.service.ts` — login/register/me/password/delete; token in `localStorage`; `getUserId`/`isTokenExpired` decode the JWT client-side.
- `services/image-helper.service.ts` — tag image selection.
- `recipes/recipe.service.ts`, `meal-plan/meal-plan.service.ts`, `shopping-list/shopping-list.service.ts` — per-domain HTTP.
- **API base URL** lives in `src/environments/environment.ts` (`apiBase`); every service builds its endpoints from it. `AuthInterceptor` attaches the bearer token globally, so services don't set `Authorization` themselves.

## Infrastructure (`infrastructure/`, entry `app.py`)
- `app_stack.py` — **AppStack**: 6 DynamoDB tables (User=DESTROY; Recipe/RecipeTag default; Ingredient/MealPlan/ShoppingList=RETAIN), `PythonFunction` Lambda from `src/` (`api.py::handler`, py3.12, 29s, 512MB), JWT + reCAPTCHA secrets, proxy `LambdaRestApi`. Table env vars + `ALLOWED_ORIGINS` set here.
- `frontend_stack.py` — **FrontendStack**: S3 + CloudFront, SPA 403/404→index fallback, deploys `forkstack-frontend/dist-cloudfront`.

## Known stubs (don't mistake for live)
- `/forgot-password` has no backend — the component shows a "coming soon" message.
