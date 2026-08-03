import { normalizeName } from "./quantity";

/**
 * The ingredients a method step actually mentions.
 *
 * The API has no step-to-ingredient mapping, so this reads the words already in
 * the step rather than inventing a relationship. Matching is on whole words:
 * a plain substring test makes "oil" match "b(oil)", "egg" match "(egg)plant"
 * and "pea" match "(pea)nuts".
 *
 * `normalizeName` strips one trailing "s" from each side, so "garlic clove"
 * still finds "garlic cloves". Irregular plurals ("tomato" vs "tomatoes") are
 * missed -- a miss shows fewer ingredients, which is a far better failure than
 * confidently listing the wrong ones.
 */
export function ingredientsForStep<T extends { name: string }>(
  ingredients: T[],
  stepText: string,
): T[] {
  const haystack = ` ${normalizeName(stepText)} `;
  return ingredients.filter((i) => {
    const name = normalizeName(i.name);
    if (name.length <= 2) return false;
    return haystack.includes(` ${name} `) || haystack.includes(` ${name}s `);
  });
}
