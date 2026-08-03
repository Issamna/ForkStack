# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ForkStack is a personal recipe app: a FastAPI backend running as a single AWS Lambda (behind API Gateway), a React (Vite) frontend, and AWS CDK (Python) as the infrastructure-as-code layer. Auth is **Clerk**. Features span recipes (CRUD, URL import, PDF export, tags), meal planning, and shopping-list generation.

## Repository layout

- `src/` — FastAPI backend (the Lambda deployment package). This is a self-rooted Python package: modules import each other as top-level (`from services import ...`, `from api import app`), so **the backend runs with `src/` as the working directory / import root**, not the repo root.
- `infrastructure/` — CDK stack definitions (`app_stack.py` = backend, `frontend_stack.py` = frontend hosting).
- `app.py` + `cdk.json` — CDK app entrypoint (`python3 app.py`).
- `web/` — React 19 + Vite frontend (TypeScript, Tailwind, Clerk for auth). Pages in `web/src/pages/`, the typed fetch layer in `web/src/lib/api.ts`. `/` is the **public** marketing landing page (`LandingPage.tsx`, Clerk modal sign-in); everything else sits behind `RequireAuth`. Clerk's `signInUrl`/`path`/`fallbackRedirectUrl` are origin-relative, so they're all prefixed with `import.meta.env.BASE_URL` — a bare `/sign-in` breaks on GitHub Pages, which serves the app from `/ForkStack/`.

## Commands

### Backend (run from `src/`)
```bash
cd src
python -m pytest                       # run all tests
python -m pytest tests/unit/test_recipies.py            # single file
python -m pytest tests/unit/test_recipies.py::TestRecipeAPI::test_create_recipe   # single test
```
Tests mock the DynamoDB tables (`@patch("services.<name>.table")`). Auth is bypassed in tests: `conftest.py` overrides `get_current_user` to read the `sub` from an unverified token, and `tests/helpers.auth(sub)` builds the header — so tests never contact Clerk.

Backend dependencies for the Lambda runtime live in `src/requirements.txt`; `requirements.txt` (repo root) is for the CDK toolchain + dev/test.

### Frontend (run from `web/`)
```bash
npm install
npm run dev              # Vite dev server on http://localhost:5173
npm run build           # production build (base /ForkStack/) -> dist/
npm run build:cloudfront # base / build -> dist-cloudfront/ (for FrontendStack)
```
`web/.env` (gitignored) holds local dev config; `web/.env.production` (committed — the Clerk publishable key is public) holds the deploy build's Clerk key + API base. Requires a Clerk publishable key (`VITE_CLERK_PUBLISHABLE_KEY`).

### Running the whole app locally
```bash
./dev-local.sh                      # DynamoDB Local (docker) + the API on :8000
./dev-local.sh --seed user_xxx      # ...and reset + seed dummy data for that user
cd web && npm run dev               # frontend on :5173, already pointed at :8000
```
`web/.env` sets `VITE_API_BASE=http://localhost:8000`, so the dev frontend expects a **local** backend. `dev-local.sh` points boto3 at DynamoDB Local via `AWS_ENDPOINT_URL_DYNAMODB` and sets every table env var explicitly — the service defaults disagree (`recipe_service` defaults to `RecipesTable`, the others to singular names), so relying on them half-works. **Running `uvicorn` without those env vars reads and writes the real AWS tables.**

Auth is still real Clerk verification against the dev instance (which permits localhost), so seeded data must be owned by *your* Clerk user id or the app shows an empty cookbook — get it with `window.Clerk.user.id` in the browser console. `src/scripts/seed_local.py` refuses any non-localhost endpoint, so it can't scatter dummy recipes through production. DynamoDB Local runs `-inMemory`: stopping the container wipes everything, which is the point.

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

### Auth (Clerk)
Auth is **Clerk**. The frontend uses Clerk for sign-in/up; the backend verifies Clerk's session JWT. `dependencies.get_current_user` fetches Clerk's public keys from its JWKS endpoint (`CLERK_ISSUER/.well-known/jwks.json`, cached), validates the RS256 signature + issuer + expiry + `azp`, and returns the Clerk user id (`sub`) — that id is the `owner_id`/`user_id` on all app data. **No shared secret**: verification uses public keys only (the Clerk *secret* key is not needed and not stored). Config: `CLERK_ISSUER`, `CLERK_AUTHORIZED_PARTIES` (env). Ownership is still enforced per-route by comparing `owner_id` to the caller (plus `is_shareable` on recipes). There is no UserTable, no password handling, and no `/users/login`|register|change-password — Clerk owns all of that; the only `/users` route is `DELETE /me`, which cascades app-data deletion.

### Meal plan & shopping list (the non-obvious domain logic)
- **Meal plan** (`meal_plan_service.py`): one DynamoDB item per user holds *all* weeks, keyed by the week's start-date string (`YYYY-MM-DD`, validated by regex). `weeks[week]` is a list of entries.
- **Shopping list** (`shopping_list_service.py`): `/generate` walks the meal plan for a week, pulls each referenced recipe's ingredients, **scales quantities by servings**, and **aggregates** by canonical `(name, unit)`. It preserves prior per-item `checked`/`removed` state and any user-added `custom` items across regeneration. Ingredient normalization lives in `utils/ingredients.py` (canonical name/unit), `utils/quantity.py` (parse/format quantities & servings), and `utils/categories.py` (grocery-aisle categorization, applied server-side on every save).

### Recipe photos
Recipes may carry a user-uploaded photo. DynamoDB stores only `image_key` (the S3 object key); the bucket is private, and `recipe_service._with_photo` mints a short-lived presigned GET as `image_url` on every read — so `image_url` is response-only and must never be written back. Uploads go **browser → S3 directly** via a presigned POST from `POST /recipes/photo-upload` (`utils/photos.py`), keeping image bytes out of the Lambda and out of API Gateway's payload cap; the POST policy enforces content type and a 5 MB ceiling, and `web/src/lib/photoUpload.ts` downscales to 1200px JPEG first. **`image_key` is client-supplied, so `_accepted_key` → `photos.owns_key` verifies it is a key this user could actually have been minted** — the owner prefix *and* the exact uuid4 filename shape. A prefix test alone is insufficient: `recipes/<me>/../<victim>/x.jpg` satisfies it, and although S3 keys are opaque, the presigned URL is an HTTP path that clients may normalise before sending. Don't relax this to a `startswith`; `test_minted_keys_pass_the_ownership_check` pins the generator and validator together. `imageForTags` in `web/src/lib/imageHelper.ts` is now only the fallback; components call `recipeImage(recipe)`.

### Recipe URL import
`utils/parser.py` (`recipe_scraper`) fetches an external page and parses it (`recipe-scrapers` + BeautifulSoup fallback). Because it makes an outbound HTTP request, the Lambda timeout is raised to 29s (aligned to the API Gateway integration cap) — keep this in mind when touching import code. PDF export is `utils/pdf.py` (reportlab), returned as base64 from `/recipes/{id}/pdf`.

## CDK stacks

- **AppStack** — DynamoDB tables (Recipe, RecipeTag, Ingredient, MealPlan, ShoppingList — no UserTable; identity is in Clerk), a private S3 bucket for recipe photos, the `PythonFunction` Lambda built from `src/` (index `api.py`, handler `handler`, Python 3.12), and a proxy `LambdaRestApi` with stage throttling. Ingredient/MealPlan/ShoppingList and the photo bucket are `RETAIN`. Table env vars, `RECIPE_PHOTO_BUCKET`, `CLERK_ISSUER`/`CLERK_AUTHORIZED_PARTIES`, and `ALLOWED_ORIGINS` (CORS) are set here. No Secrets Manager (JWKS verification needs no secret).
- **Every table must be `PAY_PER_REQUEST`.** CDK's default is PROVISIONED 5 RCU + 5 WCU *per table*, which bills 24/7 whether or not anything reads or writes. Five tables at that default sit exactly on the always-free 25+25 ceiling, so adding a sixth silently starts charging for the whole account (this cost ~$5.80 in July 2026). On-demand costs nothing at idle.
- **FrontendStack** — S3 + CloudFront hosting mirror, deployed from `web/dist-cloudfront` (Vite base `/`), with 403/404 → `/index.html` SPA fallback and a security-headers policy (CSP is Report-Only, allows Clerk's Frontend API).

## Frontend deployment

The primary frontend deploy is **GitHub Pages** via `.github/workflows/deploy-frontend.yml` (builds `web/` with Vite base `/ForkStack/`, publishes to the `gh-pages` branch, copies `index.html`→`404.html` for SPA deep links). CloudFront (FrontendStack) is a secondary mirror built with base `/`. The API base URL comes from `VITE_API_BASE` (`web/.env.production` for deploys; `web/src/lib/api.ts` falls back to the deployed API Gateway) — update it there when the API endpoint changes. Clerk **dev** instances work on any origin (localhost + GitHub Pages) with no origin config; a Clerk **production** instance would need a custom domain (CloudFront, not bare GitHub Pages).

## Security invariants (don't regress)

- `api.py` runs with `debug=False` and docs/OpenAPI disabled — don't re-enable in committed code (it leaks internals).
- Auth is Clerk (RS256/JWKS verification in `get_current_user`) — don't reintroduce homegrown passwords/JWTs. Password policy, login enumeration, and token-revocation concerns are Clerk's now.
- `utils/parser._fetch_html` is SSRF-hardened: it validates every hop, **pins the connection to the validated IP** (DNS-rebind protection), and caps the body/content-type. Don't refactor it back to a plain `requests.get(url)`.

## Gotchas

- Because service modules bind their table handle at import time, tests patch the module-level `table` object, not `boto3`.
- List/search/login/dedupe use `table.scan()` + in-memory filtering rather than queries/indexes. All scans go through `utils/db.scan_all` (follows `LastEvaluatedKey`); a raw `table.scan().get("Items")` would silently truncate past 1 MB, so use the helper. GSIs on `username`/`email`/`owner_id` are still a worthwhile follow-up for performance.
- All frontend API calls go through `web/src/lib/api.ts`, which attaches the Clerk session token (`window.Clerk.session.getToken()`) to every request. Response shapes are the interfaces in `web/src/lib/types.ts`.
- `src/scripts/` (USDA ingredient importers) are one-off backfill tooling, not part of the request path. They read `USDA_API_KEY`/`FORKSTACK_API_URL` from the env.
