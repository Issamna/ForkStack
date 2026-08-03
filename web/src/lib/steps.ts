const PREP_WORDS = new Set([
  "fresh", "dried", "smoked", "ground", "grated", "diced", "chopped", "minced",
  "sliced", "crushed", "peeled", "large", "small", "medium", "boneless",
  "skinless", "ripe", "raw", "cooked", "frozen", "canned", "tinned", "whole",
  "clove", "cloves", "stick", "sticks", "sprig", "sprigs", "extra", "virgin",
  "plain", "caster", "unsalted", "salted", "optional", "roughly", "finely",
]);

/** Words of an ingredient name that actually identify it. */
function identifyingWords(name: string): string[] {
  return name
    .toLowerCase()
    // "(diced)" is preparation, not identity -- and it lands *after* the noun,
    // so trimming it is what makes "onion (diced)" find "the onion".
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !PREP_WORDS.has(w))
    .map((w) => w.replace(/s$/, ""))
    .filter((w) => w.length > 2);
}

/**
 * Best guess at which ingredients a step uses, as indices into `ingredients`.
 *
 * Only ever a *suggestion*: the recipe form seeds its per-step chips with this
 * and the cook curates them, and cook mode prefers the saved list whenever a
 * recipe has one. It exists to save typing, not to be right.
 *
 * Matching is on whole words, so "oil" doesn't match "b(oil)", and on any
 * identifying word, so "smoked paprika" finds "paprika" and "chicken breast"
 * finds "chicken". The cost is that generic second words can attach to the
 * wrong ingredient -- "cayenne pepper" will match "black pepper". That is the
 * right way round for a suggestion the user can delete.
 */
export function suggestIngredientsForStep(
  ingredients: { name: string }[],
  stepText: string,
): number[] {
  const haystack = ` ${stepText.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim()} `;
  return ingredients.reduce<number[]>((hits, ing, index) => {
    const words = identifyingWords(ing.name);
    const found = words.some(
      (w) => haystack.includes(` ${w} `) || haystack.includes(` ${w}s `),
    );
    if (found) hits.push(index);
    return hits;
  }, []);
}
