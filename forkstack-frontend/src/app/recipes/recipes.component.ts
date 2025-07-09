import { Component, OnInit } from '@angular/core';
import { RecipeService, Recipe } from './recipe.service';

@Component({
  selector: 'app-recipes',
  templateUrl: './recipes.component.html',
  styleUrls: ['./recipes.component.scss'],
})
export class RecipesComponent implements OnInit {
  recipes: Recipe[] = [];
  filtered: Recipe[] = [];
  page = 1;
  search = '';

  constructor(private recipeService: RecipeService) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.recipeService.getAll().subscribe((data) => {
      this.recipes = data;
      this.updateFiltered();
    });
  }

  searchRecipes(): void {
    if (!this.search.trim()) {
      this.loadAll();
      return;
    }

    this.recipeService.search(this.search).subscribe((data) => {
      this.recipes = data;
      this.page = 1;
      this.updateFiltered();
    });
  }

  updateFiltered(): void {
    const start = (this.page - 1) * 10;
    const end = start + 10;
    this.filtered = this.recipes.slice(start, end);
  }

  nextPage(): void {
    if (this.page * 10 < this.recipes.length) {
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
