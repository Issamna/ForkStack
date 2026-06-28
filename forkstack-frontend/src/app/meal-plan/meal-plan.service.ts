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
  servings?: number | null;
}

@Injectable({ providedIn: 'root' })
export class MealPlanService {
  private apiUrl =
    'https://e6q9keyixh.execute-api.us-east-1.amazonaws.com/prod/meal-plan';

  constructor(private http: HttpClient) {}

  get(week: string): Observable<{ week: string; entries: MealEntry[] }> {
    return this.http.get<{ week: string; entries: MealEntry[] }>(
      `${this.apiUrl}?week=${week}`,
    );
  }

  save(
    week: string,
    entries: MealEntry[],
  ): Observable<{ week: string; entries: MealEntry[] }> {
    return this.http.put<{ week: string; entries: MealEntry[] }>(
      `${this.apiUrl}?week=${week}`,
      { entries },
    );
  }
}
