const KNOWN_TAGS = [
  "breakfast",
  "appetizer",
  "beverage",
  "dessert",
  "dinner",
  "lunch",
  "main course",
  "salad",
  "sandwich",
  "side",
  "snack",
  "soup",
];
const GENERIC = ["generic1.png", "generic2.png", "generic3.png", "generic4.png"];
const base = import.meta.env.BASE_URL;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Pick a tag-appropriate placeholder image, deterministically: the same recipe
 * always maps to the same image (seeded by recipe id), so grids don't flicker.
 */
export function imageForTags(
  tags: string[] | undefined | null,
  seed?: string,
): string {
  const key = seed || (tags || []).join("|");
  const h = hash(key);
  const available = (tags || []).filter((t) =>
    KNOWN_TAGS.includes(t.toLowerCase()),
  );
  if (available.length) {
    const chosen = available[h % available.length];
    return `${base}assets/tag_images/${chosen.toLowerCase()}.png`;
  }
  return `${base}assets/tag_images/generic/${GENERIC[h % GENERIC.length]}`;
}

/**
 * The image to show for a recipe: the user's own photo when they uploaded one,
 * otherwise the deterministic tag placeholder.
 */
export function recipeImage(recipe: {
  image_url?: string | null;
  recipe_tags?: string[] | null;
  recipe_id?: string;
}): string {
  return (
    recipe.image_url || imageForTags(recipe.recipe_tags, recipe.recipe_id)
  );
}
