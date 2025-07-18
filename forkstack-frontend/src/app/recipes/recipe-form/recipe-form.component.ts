import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RecipeService } from '../recipe.service';

@Component({
  selector: 'app-recipe-form',
  templateUrl: './recipe-form.component.html',
  styleUrls: ['./recipe-form.component.scss'],
})
export class RecipeFormComponent implements OnInit {
  title = '';
  ingredients = [{ name: '', quantity: '', measurement_type: '' }];
  instructions = [{ step_number: 1, text: '' }];
  editing = false;
  recipe_id: string | null = null;
  is_shareable = false;
  recipeUrl = '';
  showParser = false;
  isParsing = false;
  parseError: string | null = null;
  recipe_tags: string[] = [];
  availableTags: { id: string; name: string }[] = [];
  showTagDropdown = false;
  tagSearch = '';

  constructor(
    private recipeService: RecipeService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.recipe_id = this.route.snapshot.paramMap.get('id');
    this.editing = !!this.recipe_id;

    this.recipeService.getTags().subscribe((tags) => {
      this.availableTags = tags;

      // If editing, patch recipe_tags
      if (this.editing && this.recipe_id) {
        this.recipeService.getById(this.recipe_id).subscribe((recipe) => {
          this.title = recipe.title;
          this.ingredients = recipe.ingredients;
          this.instructions = recipe.instructions;
          this.is_shareable = recipe.is_shareable;
          this.recipeUrl = recipe.import_source_url || '';
          this.recipe_tags = recipe.recipe_tags || [];
        });
      }
    });
  }

  addIngredient() {
    this.ingredients.push({ name: '', quantity: '', measurement_type: '' });
  }

  removeIngredient(index: number) {
    this.ingredients.splice(index, 1);
  }

  addInstruction() {
    const nextStep = this.instructions.length + 1;
    this.instructions.push({ step_number: nextStep, text: '' });
  }

  removeInstruction(index: number) {
    this.instructions.splice(index, 1);
    this.reindexInstructions();
  }

  moveInstructionUp(index: number) {
    if (index > 0) {
      const temp = [...this.instructions];
      [temp[index - 1], temp[index]] = [temp[index], temp[index - 1]];
      this.instructions = temp;
      this.reindexInstructions();
    }
  }

  moveInstructionDown(index: number) {
    if (index < this.instructions.length - 1) {
      const temp = [...this.instructions];
      [temp[index + 1], temp[index]] = [temp[index], temp[index + 1]];
      this.instructions = temp;
      this.reindexInstructions();
    }
  }

  reindexInstructions() {
    this.instructions.forEach((step, i) => (step.step_number = i + 1));
  }

  parseRecipeUrl(): void {
    if (!this.recipeUrl) return;
    this.isParsing = true;
    this.parseError = null;

    this.recipeService.parseUrl(this.recipeUrl).subscribe({
      next: (data) => {
        this.title = data.title;
        this.ingredients = data.ingredients || [
          { name: '', quantity: '', measurement_type: '' },
        ];
        this.instructions = data.instructions || [{ step_number: 1, text: '' }];
        this.reindexInstructions();
        this.isParsing = false;
        this.showParser = false;
      },
      error: (err) => {
        console.error('Parse failed', err);
        this.parseError = 'Failed to parse recipe. Try another URL.';
        this.isParsing = false;
      },
    });
  }

  submit(): void {
    const recipeData: any = {
      title: this.title,
      ingredients: this.ingredients,
      instructions: this.instructions,
      is_shareable: this.is_shareable,
      recipe_tags: this.recipe_tags,
    };

    if (!this.editing && this.recipeUrl.trim()) {
      recipeData.import_source_url = this.recipeUrl.trim();
    }

    const done = () => this.router.navigate(['/recipes']);

    if (this.editing && this.recipe_id) {
      this.recipeService.update(this.recipe_id, recipeData).subscribe(done);
    } else {
      this.recipeService.create(recipeData).subscribe(done);
    }
  }

  onTagToggle(tagName: string, isChecked: boolean) {
    if (isChecked && !this.recipe_tags.includes(tagName)) {
      if (this.recipe_tags.length < 5) {
        this.recipe_tags.push(tagName);
      }
    } else {
      this.recipe_tags = this.recipe_tags.filter((tag) => tag !== tagName);
    }
  }

  toggleTagDropdown() {
    this.showTagDropdown = !this.showTagDropdown;
    this.tagSearch = '';
  }

  filteredTags(): { id: string; name: string }[] {
    const search = this.tagSearch.toLowerCase();
    return this.availableTags.filter((tag) =>
      tag.name.toLowerCase().includes(search),
    );
  }
}
