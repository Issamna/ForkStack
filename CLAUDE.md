# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ForkStack is a personal recipe app: a FastAPI backend running as a single AWS Lambda (behind API Gateway), an Angular frontend, and AWS CDK (Python) as the infrastructure-as-code layer. Features span recipes (CRUD, URL import, PDF export, tags), users/auth, meal planning, and shopping-list generation.

## Repository layout

- `src/` — FastAPI backend (the Lambda deployment package). This is a self-rooted Python package: modules import each other as top-level (`from services import ...`, `from api import app`), so **the backend runs with `src/` as the working directory / import root**, not the repo root.
- `infrastructure/` — CDK stack definitions (`app_stack.py` = backend, `frontend_stack.py` = frontend hosting).
- `app.py` + `cdk.json` — CDK app entrypoint (`python3 app.py`).
- `forkstack-frontend/` — Angular 16 app (this is the real frontend; the React dependencies in the **root** `package.json` are vestigial and unused).

## Commands

### Backend (run from `src/`)
```bash
cd src
python -m pytest                       # run all tests
python -m pytest tests/unit/test_recipies.py            # single file
python -m pytest tests/unit/test_recipies.py::TestRecipeAPI::test_create_recipe   # single test
```
Tests mock the DynamoDB tables (`@patch("services.<name>.table")`) and mint real JWTs via `create_access_token`. `tests/conftest.py` sets `JWT_SECRET_KEY=test-secret` so no AWS calls are needed.

Backend dependencies for the Lambda runtime live in `src/requirements.txt`; `requirements.txt` (repo root) is for the CDK toolchain + dev/test.

### Frontend (run from `forkstack-frontend/`)
```bash
npm install
npm start          # ng serve, dev server on http://localhost:4200
npm run build      # production build -> dist/
npm test           # Karma/Jasmine
```

### Infrastructure (run from repo root)
```bash
cdk ls             # AppStack, FrontendStack
cdk synth
cdk deploy AppStack
cdk diff
```

## Architecture

### Backend request flow
`api.py` builds the FastAPI app and mounts one router per domain under a prefix: `/recipes`, `/users`, `/tags`, `/ingredients`, `/meal-plan`, `/shopping-list`. `Mangum(app)` (exported as `handler`) adapts it to Lambda; API Gateway is a catch-all proxy (`proxy=True`), so all routing happens inside FastAPI.

Each service module (`src/services/*.py`) owns its own `boto3` DynamoDB table handle, read from an env var with a local-dev default (e.g. `os.environ.get("RECIPE_TABLE", "RecipeTable")`). These env vars are injected by `app_stack.py`. There is no ORM — items are plain dicts written with `put_item`.

### Auth
JWT bearer tokens (HS256). `dependencies.get_current_user` is the shared FastAPI dependency that decodes the token and returns the `user_id`; nearly every route depends on it. The signing key resolves via `utils/auth.get_jwt_secret()`: `JWT_SECRET_KEY` env var (local) → else the Secrets Manager secret named by `JWT_SECRET_ARN` (deployed). There is intentionally **no insecure default** — missing config raises. Passwords are hashed with `passlib` (`utils/security.py`). Ownership/authorization is enforced per-route by comparing `owner_id` to the caller (plus an `is_shareable` flag on recipes).

### Secrets
`utils/secrets.py` resolves any secret by env-var-holding-the-ARN, and caches values per-process (safe because a Lambda execution environment is reused). Both the JWT key and the reCAPTCHA v3 secret follow this pattern. reCAPTCHA enforcement is gated by the `ENFORCE_RECAPTCHA` env var (currently `"false"`).

### Meal plan & shopping list (the non-obvious domain logic)
- **Meal plan** (`meal_plan_service.py`): one DynamoDB item per user holds *all* weeks, keyed by the week's start-date string (`YYYY-MM-DD`, validated by regex). `weeks[week]` is a list of entries.
- **Shopping list** (`shopping_list_service.py`): `/generate` walks the meal plan for a week, pulls each referenced recipe's ingredients, **scales quantities by servings**, and **aggregates** by canonical `(name, unit)`. It preserves prior per-item `checked`/`removed` state and any user-added `custom` items across regeneration. Ingredient normalization lives in `utils/ingredients.py` (canonical name/unit), `utils/quantity.py` (parse/format quantities & servings), and `utils/categories.py` (grocery-aisle categorization, applied server-side on every save).

### Recipe URL import
`utils/parser.py` (`recipe_scraper`) fetches an external page and parses it (`recipe-scrapers` + BeautifulSoup fallback). Because it makes an outbound HTTP request, the Lambda timeout is raised to 29s (aligned to the API Gateway integration cap) — keep this in mind when touching import code. PDF export is `utils/pdf.py` (reportlab), returned as base64 from `/recipes/{id}/pdf`.

## CDK stacks

- **AppStack** — DynamoDB tables (User, Recipe, RecipeTag, Ingredient, MealPlan, ShoppingList), the `PythonFunction` Lambda built from `src/` (index `api.py`, handler `handler`, Python 3.12), Secrets Manager secrets (JWT, reCAPTCHA), and a proxy `LambdaRestApi`. Note tables have differing removal policies: Ingredient/MealPlan/ShoppingList are `RETAIN`, User is `DESTROY`. Table env vars + `ALLOWED_ORIGINS` (CORS) are set here.
- **FrontendStack** — S3 + CloudFront hosting mirror, deployed from `forkstack-frontend/dist-cloudfront` (base-href `/`), with 403/404 → `/index.html` SPA fallback.

## Frontend deployment

The primary frontend deploy is **GitHub Pages** via `.github/workflows/` (builds with base-href `/ForkStack/`, publishes to the `gh-pages` branch, copies `index.html`→`404.html` for SPA deep links). CloudFront (FrontendStack) is a secondary mirror built with base-href `/`. The frontend targets the deployed API Gateway URL hard-coded in the Angular services' `apiUrl` (e.g. `recipe.service.ts`, `auth.service.ts`) — update those when the API endpoint changes.

## Gotchas

- Because service modules bind their table handle at import time, tests patch the module-level `table` object, not `boto3`.
- List/search/login/dedupe use `table.scan()` + in-memory filtering rather than queries/indexes. All scans go through `utils/db.scan_all` (follows `LastEvaluatedKey`); a raw `table.scan().get("Items")` would silently truncate past 1 MB, so use the helper. GSIs on `username`/`email`/`owner_id` are still a worthwhile follow-up for performance.
- The frontend API base URL lives in `forkstack-frontend/src/environments/environment.ts` (`apiBase`); services build endpoints from it. `AuthInterceptor` attaches the bearer token globally, so services don't set `Authorization` themselves.
- `src/scripts/` (USDA ingredient importers) are one-off backfill tooling, not part of the request path. They read `USDA_API_KEY`/`FORKSTACK_API_URL` from the env.
