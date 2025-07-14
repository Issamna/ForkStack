// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl =
    'https://e6q9keyixh.execute-api.us-east-1.amazonaws.com/prod/users';

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  login(
    username: string,
    password: string,
    remember: boolean,
  ): Observable<any> {
    const body = new URLSearchParams();
    body.set('username', username);
    body.set('password', password);
    body.set('remember_me', remember ? 'true' : 'false');

    return this.http
      .post(`${this.apiUrl}/login`, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .pipe(
        tap((res: any) => {
          localStorage.setItem('access_token', res.access_token);
        }),
      );
  }

  register(data: {
    username: string;
    email: string;
    password: string;
    captcha_token: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}`, data);
  }

  logout(expired = false): void {
    localStorage.removeItem('access_token');
    this.router.navigate(
      ['/login'],
      expired ? { queryParams: { expired: '1' } } : undefined,
    );
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('access_token');
  }

  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp;
      const now = Math.floor(Date.now() / 1000);
      return exp < now;
    } catch {
      return true;
    }
  }

  getUserId(): string | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || null;
    } catch {
      return null;
    }
  }
}
