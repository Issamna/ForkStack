---
name: ui-conventions
description: ForkStack React + Tailwind UI patterns — page structure, the custom color palette, shared @apply classes, the api layer, and Clerk auth. Read before writing or editing a page/component instead of re-reading existing ones for style.
---

# UI conventions

React 19 + Vite + TypeScript, Tailwind for styling, Clerk for auth. Function components with hooks. Match what's already in `web/src/` — reuse the shared classes, don't invent new palettes.

## Page structure

Pages live in `web/src/pages/`, one default-exported component each, wired in `web/src/router.tsx`. Standard data-loading shape:

```tsx
const [items, setItems] = useState<Foo[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  api.foo.list().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
}, []);
```

- Loading + empty states are explicit (`loading && ...`, `!loading && items.length === 0 && ...`) — see `RecipesPage`.
- Container widths: recipes list `max-w-6xl`, detail/meal-plan `max-w-4xl`, shopping-list `max-w-2xl`, all `mx-auto px-4 py-8`.
- Prefer local `useState`/`useMemo`; no global store. Cross-render stability where it matters (e.g. deterministic images via `imageForTags(tags, recipeId)`).

## Palette (Tailwind theme — `web/tailwind.config.js`)

Custom named colors — **use these, not raw Tailwind scales**:
- `primary` `#2E4057` · `accent` `#A8C686` (the hover/interactive color) · `sage` `#6C7A61`
- `background` `#FAF9F6` (warm cream page bg) · `textgray` `#4A4A4A` (default text)
- Idiom: neutral `textgray` element → **`hover:` turns it `accent`**. **No dark mode** — don't add `dark:` variants.

## Shared `@apply` classes (`web/src/index.css`)

Prefer these over ad-hoc utility soup: `.navbar`, `.logo-*`, `.add-button` (nav); `.page-wrapper`, `.card-box` (layout); `.heading-primary`, `.heading-secondary`, `.text-subtle` (type); `.form-input`, `.button-primary`, `.pagination-button` (forms); `.recipe-grid`/`.recipe-tile`/`.search-input`, `.meal-card`, `.badge`. Add new reusable patterns here rather than repeating utility strings.

## Data access

All API calls go through `api.<domain>.<method>` in `web/src/lib/api.ts` — never raw `fetch` in a component. It attaches the Clerk token automatically. Adding an endpoint = add the method in `api.ts` (and the shape in `lib/types.ts`). On error it throws `ApiError` with `.status` and `.message` (the backend's `detail`) — surface `.message` to users (e.g. the URL-import error).

## Auth (Clerk)

- `useAuth()` → `userId` (the Clerk user id, = `owner_id` on data). `useUser()` for profile. Ownership-aware UI compares `userId` to `recipe.owner_id`.
- Protected routes are wrapped by `components/RequireAuth.tsx`; don't re-implement guards. Sign-in/up are Clerk's embedded `<SignIn>`/`<SignUp>`; account management is `<UserButton>`/`<UserProfile>` — don't build custom auth forms.

## Modals & forms

Modals are conditional JSX with `fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50` + a white `rounded-lg` panel (see the delete-confirm in `RecipeDetailPage` and the import modal in `RecipeFormPage`). Forms are controlled inputs (`value`/`onChange`), local state, validate on submit.
