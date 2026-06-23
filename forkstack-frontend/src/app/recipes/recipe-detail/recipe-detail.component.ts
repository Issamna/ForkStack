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
  adding = false;
  downloadingPdf = false;

  constructor(
    private route: ActivatedRoute,
    private recipeService: RecipeService,
    private router: Router,
    private auth: AuthService,
    public imageHelper: ImageHelperService,
  ) {}

  ngOnInit(): void {
    // Subscribe (not snapshot) so detail -> detail navigation (e.g. after
    // forking a shared recipe) reloads the newly-selected recipe.
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (!id) return;
      this.adding = false;
      this.recipe = undefined;
      this.recipeService.getById(id).subscribe((data) => {
        this.recipe = data;
      });
    });
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

  downloadPdf(): void {
    if (!this.recipe || this.downloadingPdf) return;
    this.downloadingPdf = true;
    this.recipeService.downloadPdf(this.recipe.recipe_id).subscribe({
      next: (res) => {
        const binary = atob(res.content_base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingPdf = false;
      },
      error: () => (this.downloadingPdf = false),
    });
  }

  addToCookbook(): void {
    if (!this.recipe || this.adding) return;
    this.adding = true;
    const { recipe_id, owner_id, ...rest } = this.recipe;
    this.recipeService.create({ ...rest, is_shareable: false }).subscribe({
      next: (created) => this.router.navigate(['/recipes', created.recipe_id]),
      error: () => (this.adding = false),
    });
  }
}
