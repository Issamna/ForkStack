import { Component, OnInit } from '@angular/core';
import { RecipeService, Recipe } from './recipe.service';
import { ImageHelperService } from '../services/image-helper.service';
import { AuthService } from '../services/auth.service';

interface RecipeWithImage extends Recipe {
  imageSrc: string;
}

type Tab = 'mine' | 'discover';

@Component({
  selector: 'app-recipes',
  templateUrl: './recipes.component.html',
  styleUrls: ['./recipes.component.scss'],
})
export class RecipesComponent implements OnInit {
  allRecipes: RecipeWithImage[] = [];
  recipes: RecipeWithImage[] = []; // active tab + search
  filtered: RecipeWithImage[] = []; // current page
  page = 1;
  pageSize = 12;
  search = '';
  tab: Tab = 'mine';
  userId: string | null = null;
  loading = true;

  constructor(
    private recipeService: RecipeService,
    public imageHelper: ImageHelperService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.userId = this.auth.getUserId();
    this.loadAll();
  }

  loadAll(): void {
    this.loading = true;
    this.recipeService.getAll().subscribe((data) => {
      this.allRecipes = data.map((recipe) => ({
        ...recipe,
        imageSrc: this.imageHelper.getImageForTags(recipe.recipe_tags),
      }));
      this.loading = false;
      this.applyFilters();
    });
  }

  setTab(tab: Tab): void {
    if (this.tab === tab) return;
    this.tab = tab;
    this.search = '';
    this.applyFilters();
  }

  searchRecipes(): void {
    this.applyFilters();
  }

  applyFilters(): void {
    const base =
      this.tab === 'mine'
        ? this.allRecipes.filter((r) => r.owner_id === this.userId)
        : this.allRecipes.filter(
            (r) => r.is_shareable && r.owner_id !== this.userId,
          );

    const q = this.search.trim().toLowerCase();
    this.recipes = q
      ? base.filter((r) => r.title.toLowerCase().includes(q))
      : base;

    this.page = 1;
    this.updateFiltered();
  }

  updateFiltered(): void {
    const start = (this.page - 1) * this.pageSize;
    this.filtered = this.recipes.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.recipes.length / this.pageSize));
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page++;
      this.updateFiltered();
    }
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page--;
      this.updateFiltered();
    }
  }
}
