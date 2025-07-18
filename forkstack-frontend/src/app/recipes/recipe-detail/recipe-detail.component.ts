import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RecipeService, Recipe } from '../recipe.service';
import { AuthService } from '../../services/auth.service';
import { ImageHelperService } from '../../services/image-helper.service';

@Component({
  selector: 'app-recipe-detail',
  templateUrl: './recipe-detail.component.html',
  styleUrls: ['./recipe-detail.component.scss'],
})
export class RecipeDetailComponent implements OnInit {
  recipe?: Recipe;
  showConfirm = false;

  constructor(
    private route: ActivatedRoute,
    private recipeService: RecipeService,
    private router: Router,
    private auth: AuthService,
    public imageHelper: ImageHelperService,
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
    this.showConfirm = true;
  }

  confirmDelete(): void {
    if (!this.recipe) return;
    this.recipeService.delete(this.recipe.recipe_id).subscribe(() => {
      this.router.navigate(['/recipes']);
    });
  }

  isOwner(): boolean {
    const currentUserId = this.auth.getUserId();
    return this.recipe?.owner_id === currentUserId;
  }
}
