import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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
  import_source_url?: string;
  recipe_tags?: string[];
  servings?: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class RecipeService {
  private apiUrl = `${environment.apiBase}/recipes`;

  // The Authorization header is attached globally by AuthInterceptor, and
  // HttpClient sets Content-Type: application/json for object bodies, so no
  // per-request headers are needed here.
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

  update(
    recipe_id: string,
    recipe: Omit<Recipe, 'recipe_id'>,
  ): Observable<Recipe> {
    return this.http.put<Recipe>(`${this.apiUrl}/${recipe_id}`, recipe);
  }

  delete(recipe_id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${recipe_id}`);
  }

  parseUrl(url: string): Observable<Omit<Recipe, 'recipe_id' | 'owner_id'>> {
    return this.http.post<Omit<Recipe, 'recipe_id' | 'owner_id'>>(
      `${this.apiUrl}/parse-url`,
      { url },
    );
  }

  downloadPdf(
    id: string,
  ): Observable<{ filename: string; content_base64: string }> {
    return this.http.get<{ filename: string; content_base64: string }>(
      `${this.apiUrl}/${id}/pdf`,
    );
  }

  getTags(): Observable<{ id: string; name: string }[]> {
    return this.http.get<{ id: string; name: string }[]>(
      `${environment.apiBase}/tags`,
    );
  }
}
