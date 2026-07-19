---
name: verify
description: How to run and drive ForkStack to observe a change working — backend tests (pytest), running the Angular app locally against the deployed API, and Chrome automation. Read before claiming a change works.
---

# Verifying changes in the running app

There is **no local backend stack** (no uvicorn/moto/docker-compose configured). The backend is verified two ways: unit tests (mocked DynamoDB), and — for end-to-end — the Angular app runs locally and talks to the **deployed** API Gateway. Choose based on what changed.

## Backend logic → pytest (from `src/`)

```bash
cd src
python -m pytest                 # all
python -m pytest tests/unit/test_shopping_list.py -q
python -m pytest tests/unit/test_recipies.py::TestRecipeAPI::test_create_recipe
```

Tests use `TestClient(app)`, mint real JWTs via `create_access_token`, and **patch the module-level table handle** (`@patch("services.recipe_service.table")`) — so assert against `mock_table.put_item` / `get_item` calls, not a real DB. `conftest.py` sets `JWT_SECRET_KEY=test-secret`; no AWS calls happen. This is the fast inner loop for parser/quantity/category/shopping-list logic.

## End-to-end → Angular app + Chrome

The frontend services point at the **production** API Gateway (`https://…/prod`), and `http://localhost:4200` is in the backend's `ALLOWED_ORIGINS`, so:

```bash
cd forkstack-frontend
npm install        # first time only
npm start          # ng serve → http://localhost:4200
```

Then drive it with the Chrome extension (`tabs_context_mcp` first, then `navigate`/`computer`/`read_page`). Log in through the UI to get a real token in `localStorage` (reCAPTCHA is disabled server-side, so a throwaway account can be registered). Probe APIs from the signed-in tab via `javascript_tool` fetch (the token is in `localStorage['access_token']`) — curl can't auth.

> ⚠️ **This hits real prod DynamoDB.** It's currently a test dataset, but treat writes as real: prefer a dedicated test account, clean up recipes/meal-plans/shopping-lists you create, and never bulk-delete. There is no separate staging backend today.

## Evidence

- For persistence claims, **reload the page** and re-fetch — Angular keeps optimistic client state that can mask a failed write.
- Check `read_network_requests` for the actual request/response and status codes; check the browser console (`read_console_messages`) for errors. Lambda/API errors surface as 4xx/5xx JSON `{detail: ...}`.
- Screenshots via the `computer` tool for UI/layout claims.
- When only backend logic changed and there's no UI surface, pytest is sufficient — don't spin up the browser for a parser tweak.

## CDK / infra changes

`cdk synth` (from repo root) proves the template builds; `cdk diff AppStack` shows what would change. Do **not** `cdk deploy` as part of verification — deployment is the owner's call (see `finalize`).
