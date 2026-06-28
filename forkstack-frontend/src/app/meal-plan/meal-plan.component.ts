import { Component, OnInit } from '@angular/core';
import { MealPlanService, MealEntry } from './meal-plan.service';
import { RecipeService, Recipe } from '../recipes/recipe.service';
import { ImageHelperService } from '../services/image-helper.service';

interface DayDef {
  key: string;
  label: string;
}

@Component({
  selector: 'app-meal-plan',
  templateUrl: './meal-plan.component.html',
})
export class MealPlanComponent implements OnInit {
  readonly days: DayDef[] = [
    { key: 'mon', label: 'Monday' },
    { key: 'tue', label: 'Tuesday' },
    { key: 'wed', label: 'Wednesday' },
    { key: 'thu', label: 'Thursday' },
    { key: 'fri', label: 'Friday' },
    { key: 'sat', label: 'Saturday' },
    { key: 'sun', label: 'Sunday' },
  ];
  readonly meals = ['breakfast', 'lunch', 'dinner', 'snack'];

  entries: MealEntry[] = [];
  recipes: Recipe[] = [];
  loading = true;

  // Add modal state
  showAdd = false;
  addMode: 'recipe' | 'item' = 'recipe';
  recipeSearch = '';
  selectedRecipe: Recipe | null = null;
  quickLabel = '';
  newDay = '';
  newMeal = '';
  newWho = '';
  newEatOut = false;

  constructor(
    private mealPlan: MealPlanService,
    private recipeService: RecipeService,
    public imageHelper: ImageHelperService,
  ) {}

  ngOnInit(): void {
    this.mealPlan.get().subscribe({
      next: (res) => {
        this.entries = res.entries || [];
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
    this.recipeService.getAll().subscribe((data) => (this.recipes = data));
  }

  entriesFor(dayKey: string | null): MealEntry[] {
    return this.entries.filter((e) => (e.day || null) === dayKey);
  }

  get anytime(): MealEntry[] {
    return this.entriesFor(null);
  }

  filteredRecipes(): Recipe[] {
    const q = this.recipeSearch.trim().toLowerCase();
    const list = q
      ? this.recipes.filter((r) => r.title.toLowerCase().includes(q))
      : this.recipes;
    return list.slice(0, 50);
  }

  openAdd(day: string | null = null): void {
    this.addMode = 'recipe';
    this.recipeSearch = '';
    this.selectedRecipe = null;
    this.quickLabel = '';
    this.newDay = day || '';
    this.newMeal = '';
    this.newWho = '';
    this.newEatOut = false;
    this.showAdd = true;
  }

  canAdd(): boolean {
    return this.addMode === 'recipe'
      ? !!this.selectedRecipe
      : this.quickLabel.trim().length > 0;
  }

  confirmAdd(): void {
    if (!this.canAdd()) return;
    const base = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Date.now().toString(36) + Math.random().toString(36).slice(2),
      day: this.newDay || null,
      meal: this.newMeal || null,
      who: this.newWho.trim() || null,
      eat_out: this.newEatOut,
    };
    let entry: MealEntry;
    if (this.addMode === 'recipe' && this.selectedRecipe) {
      entry = {
        ...base,
        recipe_id: this.selectedRecipe.recipe_id,
        title: this.selectedRecipe.title,
        tags: this.selectedRecipe.recipe_tags || [],
      };
    } else {
      entry = { ...base, title: this.quickLabel.trim(), tags: [] };
    }
    this.entries = [...this.entries, entry];
    this.showAdd = false;
    this.save();
  }

  removeEntry(id: string): void {
    this.entries = this.entries.filter((e) => e.id !== id);
    this.save();
  }

  moveTo(entry: MealEntry, day: string | null): void {
    entry.day = day;
    this.save();
  }

  private save(): void {
    this.mealPlan.save(this.entries).subscribe();
  }

  thumb(entry: MealEntry): string {
    return this.imageHelper.getImageForTags(entry.tags);
  }

  mealLabel(meal: string | null | undefined): string {
    return meal ? meal.charAt(0).toUpperCase() + meal.slice(1) : '';
  }
}
