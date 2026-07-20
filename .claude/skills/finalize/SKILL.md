---
name: finalize
description: Ship checklist for ForkStack — checks, docs to sync, commit and deploy flow for the FastAPI backend and React frontend. Run when a change is code-complete.
---

# Finalizing a change

Work through in order. Commands assume repo root unless noted.

## 1. Checks

Backend (from `src/`):
```bash
cd src && python -m pytest -q
```
Frontend (from `web/`) — for any frontend change:
```bash
npm run build         # tsc -b + vite build must succeed (catches TS/type errors)
```
Infra — for any `infrastructure/` or `src/` change that affects deploy:
```bash
cdk synth             # from repo root; template must build
cdk diff AppStack     # sanity-check the delta
```

## 2. Verify at runtime

Use the `verify` skill. Backend-logic-only changes: pytest is enough. Anything user-facing: run `npm run dev` (Vite) and drive the flow in the browser, confirm the write persisted on reload.

## 3. Sync docs (same commit)

- **`CLAUDE.md`** — non-obvious behavior/conventions the next agent needs.
- **`code-map` skill** (`.claude/skills/code-map/SKILL.md`) — any new/moved router, service, model, React page, `lib/api` method, or DynamoDB table.
- **`ui-conventions` skill** — only if you introduced a new shared class or pattern.
- `README.md` — only if setup/architecture changed materially.

## 4. Branch & commit

This repo's history is currently linear on `main`, but **don't commit straight to `main`** — branch first (per the environment rules), commit, and let the owner decide how it lands.

```bash
git checkout -b <short-branch>
git add -A && git commit   # imperative subject; end body with the Co-Authored-By trailer
```

Match the existing commit-message voice: short imperative subject, feature-scoped (e.g. "Shopping list: group items by grocery aisle").

## 5. Deploy — the owner's call

Two independent deploy paths; **don't trigger either without the owner asking**:

- **Frontend** auto-deploys to **GitHub Pages** via `.github/workflows/deploy-frontend.yml` on push to `main` (builds with base-href `/ForkStack/`, publishes `gh-pages`). CloudFront (FrontendStack) is a separate manual `cdk deploy FrontendStack`.
- **Backend** deploys only via `cdk deploy AppStack` (manual). No CI for it.

`gh` is **not installed** here and there is no PR-based CI, so "open a PR / wait for checks" isn't the flow unless the owner sets `gh` up. Push the branch and hand off; the owner merges to `main` (which ships the frontend) and runs `cdk deploy` for the backend when ready.

## 6. After deploy

If `cdk deploy AppStack` recreated the API Gateway (new `execute-api` URL), update `VITE_API_BASE` in `web/.env.production` (and the fallback in `web/src/lib/api.ts`) and rebuild/redeploy the frontend. A proxy `LambdaRestApi` keeps its URL across code-only Lambda updates, so this is only a concern on stack replacement.
