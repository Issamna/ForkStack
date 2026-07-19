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
