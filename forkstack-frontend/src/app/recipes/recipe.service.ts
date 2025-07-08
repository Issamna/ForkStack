import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Ingredient {
  name: string;
  quantity: string;
  measurement_type: string;
}

export interface InstructionStep {
  step_number: number;
  text: string;
}

export interface Recipe {
  recipe_id: string;
  title: string;
  ingredients: Ingredient[];
  instructions: InstructionStep[];
}


@Injectable({
  providedIn: 'root'
})
export class RecipeService {
  private apiUrl = 'https://e6q9keyixh.execute-api.us-east-1.amazonaws.com/prod/recipes'; // TODO: replace with real URL

  constructor(private http: HttpClient) {}

  getAll(): Observable<Recipe[]> {
    return this.http.get<Recipe[]>(this.apiUrl);
  }

  search(title: string): Observable<Recipe[]> {
    const params = new HttpParams().set('title', title);
    return this.http.get<Recipe[]>(`${this.apiUrl}/search`, { params });
  }

  getById(id: string): Observable<Recipe> {
    return this.http.get<Recipe>(`${this.apiUrl}/${id}`);
  } 

  create(recipe: Omit<Recipe, 'recipe_id'>): Observable<Recipe> {
    return this.http.post<Recipe>(this.apiUrl, recipe);
  }  

  delete(recipe_id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${recipe_id}`);
  }

  update(recipe_id: string, recipe: Omit<Recipe, 'recipe_id'>): Observable<Recipe> {
    return this.http.put<Recipe>(`${this.apiUrl}/${recipe_id}`, recipe);
  }  
  
}
