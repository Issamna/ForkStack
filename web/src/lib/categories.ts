/** Grocery aisles, in the order you walk a shop. Assigned server-side. */
export const CATEGORY_ORDER = [
  "produce",
  "meat",
  "dairy",
  "bakery",
  "pantry",
  "spices",
  "frozen",
  "beverages",
  "household",
  "other",
];

export const CATEGORY_LABELS: Record<string, string> = {
  produce: "Produce",
  meat: "Meat & Seafood",
  dairy: "Dairy & Eggs",
  bakery: "Bakery",
  pantry: "Pantry",
  spices: "Spices & Seasonings",
  frozen: "Frozen",
  beverages: "Beverages",
  household: "Household",
  other: "Other",
};

export function categoryLabel(key?: string | null): string {
  return CATEGORY_LABELS[key || "other"] ?? "Other";
}
