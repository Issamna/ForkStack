import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RecipeService } from '../recipe.service';

@Component({
  selector: 'app-recipe-form',
  templateUrl: './recipe-form.component.html',
  styleUrls: ['./recipe-form.component.scss']
})
export class RecipeFormComponent implements OnInit {
  title = '';
  ingredients = [{ name: '', quantity: '', measurement_type: '' }];
  instructions = [{ step_number: 1, text: '' }];
  editing = false;
  recipe_id: string | null = null;

  constructor(
    private recipeService: RecipeService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.recipe_id = this.route.snapshot.paramMap.get('id');
    this.editing = !!this.recipe_id;

    if (this.editing && this.recipe_id) {
      this.recipeService.getById(this.recipe_id).subscribe(recipe => {
        this.title = recipe.title;
        this.ingredients = recipe.ingredients;
        this.instructions = recipe.instructions;
      });
    }
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
    this.instructions.forEach((step, i) => step.step_number = i + 1);
  }

  submit(): void {
    const recipeData = {
      title: this.title,
      ingredients: this.ingredients,
      instructions: this.instructions
    };

    const done = () => this.router.navigate(['/recipes']);

    if (this.editing && this.recipe_id) {
      this.recipeService.update(this.recipe_id, recipeData).subscribe(done);
    } else {
      this.recipeService.create(recipeData).subscribe(done);
    }
  }

  
}
