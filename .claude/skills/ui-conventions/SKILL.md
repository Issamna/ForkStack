---
name: ui-conventions
description: ForkStack Angular + Tailwind UI patterns — component skeleton, the custom color palette, the shared @apply utility classes, services/auth wiring. Read before writing or editing any component instead of re-reading existing ones for style.
---

# UI conventions

Angular 16, module-based (NgModules, not standalone components), Tailwind for styling. Match what's already here — reuse the shared classes, don't invent new palettes.

## Component skeleton

Components are class-based with an external template (`templateUrl`) and usually an external `.scss`. Standard data-loading shape:

```ts
export class FooComponent implements OnInit {
  items: Foo[] = [];
  loading = true;

  constructor(private fooService: FooService, private auth: AuthService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.fooService.getAll().subscribe((data) => {
      this.items = data;
      this.loading = false;
    });
  }
}
```

- Components subscribe to service Observables directly (no async pipe convention established; template `*ngIf`/`*ngFor` throughout).
- Feature areas that warrant their own module + lazy route follow the `recipes/` pattern (`recipes.module.ts` + `recipes-routing.module.ts`); simple pages are declared in the root `AppModule`.
- New root-declared components must be added to `AppModule.declarations`.

## Palette (Tailwind theme — `tailwind.config.js`)

Custom named colors — **use these, not raw Tailwind color scales**:
- `primary` `#2E4057` (deep slate blue) · `accent` `#A8C686` (sage green, the hover/interactive color) · `sage` `#6C7A61`
- `background` `#FAF9F6` (warm cream page bg) · `textgray` `#4A4A4A` (default text)
- The interaction idiom is: neutral `textgray` element → **`hover:` turns it `accent`**. Follow it.
- **There is no dark mode.** Don't add `dark:` variants.

## Shared `@apply` classes (`src/styles/_forkstack.scss`)

Prefer these semantic classes over ad-hoc utility soup. Available:
- Layout: `.page-wrapper`, `.card-box`, `.card-box`
- Headings: `.heading-primary`, `.heading-secondary`, `.text-subtle`
- Forms/buttons: `.form-input`, `.button-primary`, `.pagination-button`
- Nav (app shell): `.navbar`, `.logo-*`, `.add-button`, `.nav-button`, `.dropdown-menu`, `.dropdown-item`, `.tooltip`
- Recipes: `.recipe-grid`, `.recipe-tile`, `.recipe-image`, `.recipe-title`, `.search-bar`, `.search-input`, `.search-icon-button`
- Meal plan: `.meal-card`, `.badge`

If a new reusable pattern emerges, add a class here rather than repeating utility strings across templates.

## Data access & auth

- One Angular service per domain (`recipe.service.ts`, `auth.service.ts`, `meal-plan.service.ts`, `shopping-list.service.ts`). API calls go through the service, never raw `HttpClient` in a component.
- **`AuthInterceptor` already attaches the bearer token to every request** and logs out on 401 — you do **not** need to add `Authorization` headers manually (some older services still do via `authHeaders()`; don't copy that, rely on the interceptor).
- Token lives in `localStorage['access_token']`; `AuthService.getUserId()`/`isTokenExpired()` decode the JWT client-side. Ownership-aware UI reads `auth.getUserId()` and compares to `recipe.owner_id`.
- The "shared cookbook" model is real: recipe list has **Mine / Discover** tabs — Discover shows other users' `is_shareable` recipes (read-only, no edit/delete controls).
- **API base URL is hard-coded per service.** Until an `environment.ts` exists, a new service must repeat the `https://…/prod` base — and any endpoint change touches every service. Flag this rather than silently adding a 5th copy if you can centralize it.

## Forms

Two styles coexist: template-driven (`FormsModule`, `[(ngModel)]`) in simpler pages and reactive (`ReactiveFormsModule`, `FormBuilder`) in auth pages. Match the file you're editing; don't convert one to the other as a side effect.
