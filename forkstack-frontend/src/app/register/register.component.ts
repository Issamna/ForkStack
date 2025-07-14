import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ReCaptchaV3Service } from 'ng-recaptcha';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  registerForm: FormGroup;
  submitting = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private fb: FormBuilder,
    private recaptchaV3Service: ReCaptchaV3Service,
    private authService: AuthService,
    private router: Router,
  ) {
    this.registerForm = this.fb.group({
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  onSubmit(): void {
    if (this.registerForm.invalid) return;

    this.submitting = true;
    this.errorMessage = '';

    this.recaptchaV3Service.execute('register').subscribe({
      next: (token: string) => {
        const payload = {
          ...this.registerForm.value,
          captcha_token: token,
        };

        this.authService.register(payload).subscribe({
          next: () => {
            this.successMessage =
              '🎉 Registration successful! Redirecting to login...';
            this.submitting = false;
            setTimeout(() => this.router.navigate(['/login']), 2000);
          },
          error: (err) => {
            this.errorMessage = err?.error?.detail || 'Registration failed';
            this.submitting = false;
          },
        });
      },
      error: () => {
        this.errorMessage = 'CAPTCHA failed';
        this.submitting = false;
      },
    });
  }
}
