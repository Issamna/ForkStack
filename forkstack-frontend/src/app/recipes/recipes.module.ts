import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecipesComponent } from './recipes.component';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RecipeDetailComponent } from './recipe-detail/recipe-detail.component';
import { RecipeFormComponent } from './recipe-form/recipe-form.component';

@NgModule({
  declarations: [RecipesComponent, RecipeDetailComponent, RecipeFormComponent],
  imports: [
    CommonModule,
    RouterModule.forChild([
      { path: '', component: RecipesComponent },
      { path: 'new', component: RecipeFormComponent },
      { path: ':id', component: RecipeDetailComponent },
      { path: ':id/edit', component: RecipeFormComponent },
    ]),
    FormsModule,
    HttpClientModule,
  ],
})
export class RecipesModule {}
