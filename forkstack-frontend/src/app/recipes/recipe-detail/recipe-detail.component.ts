import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RecipeService, Recipe } from '../recipe.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-recipe-detail',
  templateUrl: './recipe-detail.component.html',
  styleUrls: ['./recipe-detail.component.scss'],
})
export class RecipeDetailComponent implements OnInit {
  recipe?: Recipe;

  constructor(
    private route: ActivatedRoute,
    private recipeService: RecipeService,
    private router: Router,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.recipeService.getById(id).subscribe((data) => {
        this.recipe = data;
      });
    }
  }

  deleteRecipe(): void {
    if (!this.recipe) return;
    const confirmed = confirm(`Delete "${this.recipe.title}"?`);
    if (confirmed) {
      this.recipeService.delete(this.recipe.recipe_id).subscribe(() => {
        this.router.navigate(['/recipes']);
      });
    }
  }

  isOwner(): boolean {
    const currentUserId = this.auth.getUserId();
    return this.recipe?.owner_id === currentUserId;
  }
}
