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
  // Canonical, indexed by JS Date.getDay() (0 = Sunday .. 6 = Saturday).
  readonly allDays: DayDef[] = [
    { key: 'sun', label: 'Sunday' },
    { key: 'mon', label: 'Monday' },
    { key: 'tue', label: 'Tuesday' },
    { key: 'wed', label: 'Wednesday' },
    { key: 'thu', label: 'Thursday' },
    { key: 'fri', label: 'Friday' },
    { key: 'sat', label: 'Saturday' },
  ];
  readonly meals = ['breakfast', 'lunch', 'dinner', 'snack'];

  // Day the week starts on (0 = Sunday .. 6 = Saturday); user preference.
  weekStartDow = this.readWeekStartPref();

  entries: MealEntry[] = [];
  recipes: Recipe[] = [];
  loading = true;
  weekStart: Date = this.weekStartOf(new Date(), this.weekStartDow);

  // Day rows, ordered from the chosen start day.
  get days(): DayDef[] {
    return Array.from(
      { length: 7 },
      (_, i) => this.allDays[(this.weekStartDow + i) % 7],
    );
  }

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
  newServings: number | null = null;

  constructor(
    private mealPlan: MealPlanService,
    private recipeService: RecipeService,
    public imageHelper: ImageHelperService,
  ) {}

  ngOnInit(): void {
    this.loadWeek();
    this.recipeService.getAll().subscribe((data) => (this.recipes = data));
  }

  loadWeek(): void {
    this.loading = true;
    this.mealPlan.get(this.weekIso).subscribe({
      next: (res) => {
        this.entries = res.entries || [];
        this.loading = false;
      },
      error: () => {
        this.entries = [];
        this.loading = false;
      },
    });
  }

  // --- Week navigation ---
  readWeekStartPref(): number {
    const v = parseInt(localStorage.getItem('mp_week_start') ?? '', 10);
    return Number.isInteger(v) && v >= 0 && v <= 6 ? v : 1; // default Monday
  }

  setWeekStart(dow: number): void {
    this.weekStartDow = dow;
    localStorage.setItem('mp_week_start', String(dow));
    // Re-align the week we're viewing to the new start day, then reload.
    this.weekStart = this.weekStartOf(this.weekStart, dow);
    this.loadWeek();
  }

  weekStartOf(d: Date, startDow: number): Date {
    const x = new Date(d);
    const diff = (x.getDay() - startDow + 7) % 7;
    x.setDate(x.getDate() - diff);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  get weekIso(): string {
    const d = this.weekStart;
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  dayDate(index: number): Date {
    const d = new Date(this.weekStart);
    d.setDate(d.getDate() + index);
    return d;
  }

  get weekLabel(): string {
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${fmt(this.weekStart)} – ${fmt(this.dayDate(6))}`;
  }

  get isThisWeek(): boolean {
    return (
      this.weekStart.getTime() ===
      this.weekStartOf(new Date(), this.weekStartDow).getTime()
    );
  }

  isToday(index: number): boolean {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return this.dayDate(index).getTime() === t.getTime();
  }

  shiftWeek(deltaWeeks: number): void {
    const d = new Date(this.weekStart);
    d.setDate(d.getDate() + deltaWeeks * 7);
    this.weekStart = d;
    this.loadWeek();
  }

  goToThisWeek(): void {
    this.weekStart = this.weekStartOf(new Date(), this.weekStartDow);
    this.loadWeek();
  }

  clearWeek(): void {
    if (!this.entries.length) return;
    if (!confirm('Clear all meals planned for this week?')) return;
    this.entries = [];
    this.save();
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
    this.newServings = null;
    this.showAdd = true;
  }

  selectRecipe(r: Recipe): void {
    this.selectedRecipe = r;
    this.newServings = r.servings ?? null;
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
        servings: this.newServings || null,
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
    this.mealPlan.save(this.weekIso, this.entries).subscribe();
  }

  thumb(entry: MealEntry): string {
    return this.imageHelper.getImageForTags(entry.tags);
  }

  mealLabel(meal: string | null | undefined): string {
    return meal ? meal.charAt(0).toUpperCase() + meal.slice(1) : '';
  }
}
