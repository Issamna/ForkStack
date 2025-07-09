import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

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
  is_shareable: boolean;
  owner_id?: string;
}

@Injectable({
  providedIn: 'root',
})
export class RecipeService {
  private apiUrl =
    'https://e6q9keyixh.execute-api.us-east-1.amazonaws.com/prod/recipes';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  private authHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  getAll(): Observable<Recipe[]> {
    return this.http.get<Recipe[]>(this.apiUrl, {
      headers: this.authHeaders(),
    });
  }

  search(title: string): Observable<Recipe[]> {
    const params = new HttpParams().set('title', title);
    return this.http.get<Recipe[]>(`${this.apiUrl}/search`, {
      headers: this.authHeaders(),
      params,
    });
  }

  getById(id: string): Observable<Recipe> {
    return this.http.get<Recipe>(`${this.apiUrl}/${id}`, {
      headers: this.authHeaders(),
    });
  }

  create(recipe: Omit<Recipe, 'recipe_id'>): Observable<Recipe> {
    return this.http.post<Recipe>(this.apiUrl, recipe, {
      headers: this.authHeaders(),
    });
  }

  update(
    recipe_id: string,
    recipe: Omit<Recipe, 'recipe_id'>,
  ): Observable<Recipe> {
    return this.http.put<Recipe>(`${this.apiUrl}/${recipe_id}`, recipe, {
      headers: this.authHeaders(),
    });
  }

  delete(recipe_id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${recipe_id}`, {
      headers: this.authHeaders(),
    });
  }
}
