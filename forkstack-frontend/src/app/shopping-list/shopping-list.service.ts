import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ShoppingItem {
  name: string;
  unit: string;
  quantity: string;
  sources: string[];
  checked: boolean;
  custom?: boolean;
  removed?: boolean;
  category?: string;
}

interface ShoppingList {
  week: string;
  items: ShoppingItem[];
}

@Injectable({ providedIn: 'root' })
export class ShoppingListService {
  private apiUrl = `${environment.apiBase}/shopping-list`;

  constructor(private http: HttpClient) {}

  generate(week: string): Observable<ShoppingList> {
    return this.http.post<ShoppingList>(
      `${this.apiUrl}/generate?week=${week}`,
      {},
    );
  }

  get(week: string): Observable<ShoppingList> {
    return this.http.get<ShoppingList>(`${this.apiUrl}?week=${week}`);
  }

  save(week: string, items: ShoppingItem[]): Observable<ShoppingList> {
    return this.http.put<ShoppingList>(`${this.apiUrl}?week=${week}`, { items });
  }
}
