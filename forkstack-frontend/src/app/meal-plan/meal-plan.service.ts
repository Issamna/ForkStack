import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MealEntry {
  id: string;
  recipe_id?: string | null;
  title: string;
  tags?: string[];
  day?: string | null; // 'mon'..'sun' or null = anytime this week
  meal?: string | null; // 'breakfast' | 'lunch' | 'dinner' | 'snack'
  who?: string | null;
  eat_out: boolean;
}

@Injectable({ providedIn: 'root' })
export class MealPlanService {
  private apiUrl =
    'https://e6q9keyixh.execute-api.us-east-1.amazonaws.com/prod/meal-plan';

  constructor(private http: HttpClient) {}

  get(): Observable<{ entries: MealEntry[] }> {
    return this.http.get<{ entries: MealEntry[] }>(this.apiUrl);
  }

  save(entries: MealEntry[]): Observable<{ entries: MealEntry[] }> {
    return this.http.put<{ entries: MealEntry[] }>(this.apiUrl, { entries });
  }
}
