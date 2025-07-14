// src/app/login/login.component.ts
import { Component } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  username = '';
  password = '';
  error: string | null = null;
  rememberMe = false;
  private expiredHandled = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.route.queryParams.subscribe((params) => {
      if (params['expired'] && !this.expiredHandled) {
        this.error = 'Your session has expired. Please log in again.';
        this.expiredHandled = true; // ✅ prevent future expired message

        this.router.navigate([], {
          replaceUrl: true,
          queryParams: { expired: null },
          queryParamsHandling: 'merge',
        });
      }
    });
  }

  onInputChange() {
    this.error = null;
  }

  onSubmit() {
    this.error = null;
    this.expiredHandled = true;
    this.auth.login(this.username, this.password, this.rememberMe).subscribe(
      () => this.router.navigate(['/']),
      (err) => (this.error = err?.error?.detail || 'Login failed'),
    );
  }
}
