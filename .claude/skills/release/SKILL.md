---
name: release
description: Work a batch of fixes/improvements on a shared branch with the owner — triage a list, branch, fix one item at a time with per-item commits and checkpoints, then hand off. Adapted for ForkStack (no gh/issue tracker; the batch comes from a written list).
---

# Release batch

A collaborative batch-fix flow for knocking out several small changes together. ForkStack has **no `gh` and no issue tracker**, so the batch comes from a list the owner gives you (or the "Current issues" catalog in the analysis) — not from `gh issue list`. The owner may push their own commits to the same branch while you work; treat the branch as shared.

## 1. Assemble & triage the batch

Take the list of items (owner-provided, or from `CLAUDE.md` / the recommendations doc). For each, tell the owner:
- What it actually changes (behavior, not just a label)
- Backend / frontend / infra, and a rough size (small/medium/large)
- Whether it belongs in a batch at all — **carve out** large features, DynamoDB schema/table changes, secret rotation, or anything needing an AWS deploy decision; those get their own branch and their own conversation.

## 2. Agree scope and branch

Confirm which items are in and who takes what. Then:

```bash
git checkout main && git pull && git checkout -b fix/<short-name>
```

Create a task per item (`TaskCreate`) so progress is visible; mark any the owner is doing themselves as theirs.

## 3. Work loop — one item at a time

For each item (owner's priority order, else smallest first):

1. **`git pull` first** — the owner may have pushed. Never rebase or force-push a shared branch.
2. Locate the code with the `code-map` skill; match style with `ui-conventions` for UI work.
3. Implement. Run `pytest` (backend) / `npm run build` (frontend); drive anything user-facing with the `verify` skill.
4. Commit just this item's changes — imperative subject, the standard Co-Authored-By trailer.
5. Checkpoint: tell the owner what changed and how it was verified, mark the task completed, continue unless redirected.

If an item turns out bigger than expected, stop, say so, and propose splitting it out rather than bloating the batch.

## 4. Ship the batch

When the agreed items are done:

1. `git pull`, then run the `finalize` skill — full checks and docs sync (CLAUDE.md, code-map) covering **all** changes on the branch, including the owner's commits.
2. Push the branch and hand off. Since there's no PR CI and merging ships the frontend (GitHub Pages on `main`) and may need a `cdk deploy` for the backend, **merge and deploy are the owner's call** — summarize what's on the branch and what deploying entails, don't merge to `main` or deploy yourself.
