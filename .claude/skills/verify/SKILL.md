---
name: verify
description: How to run and drive ForkStack to observe a change working — backend tests (pytest), running the React app locally, and Chrome automation. Read before claiming a change works.
---

# Verifying changes in the running app

Choose by what changed: backend logic → pytest (mocked DynamoDB); anything user-facing → the React app + Chrome.

## Backend logic → pytest (from `src/`)

```bash
cd src
python -m pytest                 # all
python -m pytest tests/unit/test_shopping_list.py -q
python -m pytest tests/unit/test_recipies.py::TestRecipeAPI::test_create_recipe
```

Tests use `TestClient(app)` and **patch the module-level table handle** (`@patch("services.recipe_service.table")`) — assert against `mock_table.put_item`/`get_item`, not a real DB. Auth is bypassed: `conftest.py` overrides `get_current_user` (reads `sub` from an unverified token), and `tests/helpers.auth(sub)` builds the header — no Clerk contact, no AWS calls. Fast inner loop for parser/quantity/category/shopping-list logic.

## End-to-end → React app + Chrome

```bash
cd web
npm install        # first time only
npm run dev        # Vite → http://localhost:5173
```

`web/.env` sets `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_API_BASE`. Drive with the Chrome extension (`tabs_context_mcp` first, then `navigate`/`computer`/`read_page`). **Sign-in is Clerk and must be done by the user** (entering credentials / creating accounts is off-limits to the agent) — ask them to sign in, then proceed. Get the session token in the signed-in tab via `await window.Clerk.session.getToken()`; note a `javascript_tool` fetch runs in an isolated origin and can hit CORS, so prefer reading the app's own network calls (`read_network_requests`) over manual fetches.

### Full local stack (backend + frontend), when the deployed backend won't do

The deployed backend may lag the code (e.g. mid-migration). To exercise the current backend end-to-end, run it locally against the **real** DynamoDB tables and point the app at it:

```bash
# real table names: aws dynamodb list-tables (they're AppStack-<Table>-<suffix>)
cd src && RECIPE_TABLE=... RECIPE_TAG_TABLE=... INGREDIENT_TABLE=... \
  MEAL_PLAN_TABLE=... SHOPPING_LIST_TABLE=... \
  CLERK_ISSUER=https://<instance>.clerk.accounts.dev \
  CLERK_AUTHORIZED_PARTIES=http://localhost:5173 ALLOWED_ORIGINS=http://localhost:5173 \
  AWS_REGION=us-east-1 uvicorn api:app --port 8000
# then set VITE_API_BASE=http://localhost:8000 in web/.env and restart Vite
```

Needs `uvicorn` (in the venv) and AWS creds (present). Clerk **dev** instances allow localhost with no origin config.

> ⚠️ **This hits real prod DynamoDB.** It's a test dataset, but treat writes as real: prefer read-only checks, clean up anything you create, never bulk-delete. There is no separate staging backend today. Deploying the backend (`cdk deploy AppStack`) is the alternative but it's the owner's call.

## Evidence

- For persistence claims, **reload the page** and re-fetch — React keeps optimistic client state that can mask a failed write.
- Check `read_network_requests` for real status codes (backend errors are 4xx/5xx JSON `{detail: ...}`); `read_console_messages` for JS errors.
- Screenshots via the `computer` tool for UI/layout claims.
- When only backend logic changed and there's no UI surface, pytest is sufficient — don't spin up the browser for a parser tweak.

## CDK / infra changes

`cdk synth` (from repo root) proves the template builds; `cdk diff AppStack` shows what would change. Do **not** `cdk deploy` as part of verification — deployment is the owner's call (see `finalize`).
