/**
 * Clerk URL helper.
 *
 * Clerk resolves every URL prop against the *origin*, not the router basename.
 * GitHub Pages serves the app from '/ForkStack/', so a bare '/recipes' sends
 * the user to issamna.github.io/recipes -- off the app, a 404. Every Clerk
 * `*Url` / `path` prop must go through this.
 *
 * react-router's own `to=` props are basename-relative and must NOT use it.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function appUrl(path: string): string {
  return `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
}
