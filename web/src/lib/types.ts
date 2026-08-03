export interface Ingredient {
  name: string;
  quantity: string;
  measurement_type: string;
}

export interface InstructionStep {
  step_number: number;
  text: string;
}

export interface Recipe {
  recipe_id: string;
  title: string;
  ingredients: Ingredient[];
  instructions: InstructionStep[];
  is_shareable: boolean;
  owner_id?: string;
  import_source_url?: string;
  recipe_tags?: string[];
  servings?: number | null;
  /** Total time in minutes. Often absent — always render conditionally. */
  total_time?: number | null;
  /** S3 object key of an uploaded photo; null means use a placeholder. */
  image_key?: string | null;
  /** Short-lived presigned URL, minted per response. Never send this back. */
  image_url?: string | null;
}

export interface PhotoUpload {
  image_key: string;
  url: string;
  fields: Record<string, string>;
}

export interface MealEntry {
  id: string;
  recipe_id?: string | null;
  title: string;
  tags?: string[];
  day?: string | null;
  meal?: string | null;
  who?: string | null;
  eat_out: boolean;
  servings?: number | null;
}

export interface ShoppingItem {
  name: string;
  unit: string;
  quantity: string;
  sources: string[];
  checked: boolean;
  custom?: boolean;
  removed?: boolean;
  category?: string;
}

export interface ShoppingList {
  week: string;
  items: ShoppingItem[];
}

export interface Tag {
  id: string;
  name: string;
}
