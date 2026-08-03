import type {
  MealEntry,
  PhotoUpload,
  Recipe,
  ShoppingItem,
  ShoppingList,
  Tag,
} from "./types";

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  "https://e6q9keyixh.execute-api.us-east-1.amazonaws.com/prod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Clerk attaches a global once loaded; grab a fresh session token per request.
async function authHeader(): Promise<Record<string, string>> {
  const clerk = (window as unknown as { Clerk?: any }).Clerk;
  const token = clerk?.session ? await clerk.session.getToken() : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(await authHeader()),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail: string | undefined;
    try {
      detail = (await res.json())?.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  recipes: {
    list: () => req<Recipe[]>("/recipes"),
    search: (title: string) =>
      req<Recipe[]>(`/recipes/search?title=${encodeURIComponent(title)}`),
    get: (id: string) => req<Recipe>(`/recipes/${id}`),
    create: (r: Omit<Recipe, "recipe_id">) =>
      req<Recipe>("/recipes", { method: "POST", body: JSON.stringify(r) }),
    update: (id: string, r: Omit<Recipe, "recipe_id">) =>
      req<Recipe>(`/recipes/${id}`, { method: "PUT", body: JSON.stringify(r) }),
    remove: (id: string) =>
      req<void>(`/recipes/${id}`, { method: "DELETE" }),
    parseUrl: (url: string) =>
      req<Omit<Recipe, "recipe_id" | "owner_id">>("/recipes/parse-url", {
        method: "POST",
        body: JSON.stringify({ url }),
      }),
    pdf: (id: string) =>
      req<{ filename: string; content_base64: string }>(`/recipes/${id}/pdf`),
    photoUpload: (contentType: string) =>
      req<PhotoUpload>("/recipes/photo-upload", {
        method: "POST",
        body: JSON.stringify({ content_type: contentType }),
      }),
    tags: () => req<Tag[]>("/tags"),
  },
  mealPlan: {
    get: (week: string) =>
      req<{ week: string; entries: MealEntry[] }>(`/meal-plan?week=${week}`),
    save: (week: string, entries: MealEntry[]) =>
      req<{ week: string; entries: MealEntry[] }>(`/meal-plan?week=${week}`, {
        method: "PUT",
        body: JSON.stringify({ entries }),
      }),
  },
  shoppingList: {
    generate: (week: string) =>
      req<ShoppingList>(`/shopping-list/generate?week=${week}`, {
        method: "POST",
        body: "{}",
      }),
    get: (week: string) => req<ShoppingList>(`/shopping-list?week=${week}`),
    save: (week: string, items: ShoppingItem[]) =>
      req<ShoppingList>(`/shopping-list?week=${week}`, {
        method: "PUT",
        body: JSON.stringify({ items }),
      }),
  },
  users: {
    deleteMyData: () => req<void>("/users/me", { method: "DELETE" }),
  },
};
