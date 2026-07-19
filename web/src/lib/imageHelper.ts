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
