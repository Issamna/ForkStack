import { Component, OnInit } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-account',
  templateUrl: './account.component.html',
})
export class AccountComponent implements OnInit {
  username = '';
  email = '';

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  loading = true;
  confirmingDelete = false;

  profileMessage: string | null = null;
  profileError: string | null = null;
  passwordMessage: string | null = null;
  passwordError: string | null = null;
  deleteError: string | null = null;

  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    this.auth.getMe().subscribe({
      next: (u) => {
        this.username = u.username;
        this.email = u.email;
        this.loading = false;
      },
      error: () => {
        this.profileError = 'Could not load your account.';
        this.loading = false;
      },
    });
  }

  saveProfile(): void {
    this.profileMessage = null;
    this.profileError = null;
    this.auth
      .updateProfile({ username: this.username, email: this.email })
      .subscribe({
        next: () => (this.profileMessage = 'Profile updated.'),
        error: (err) =>
          (this.profileError = err?.error?.detail || 'Update failed.'),
      });
  }

  changePassword(): void {
    this.passwordMessage = null;
    this.passwordError = null;
    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = 'New passwords do not match.';
      return;
    }
    this.auth
      .changePassword({
        current_password: this.currentPassword,
        new_password: this.newPassword,
      })
      .subscribe({
        next: () => {
          this.passwordMessage = 'Password changed.';
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
        },
        error: (err) =>
          (this.passwordError = err?.error?.detail || 'Change failed.'),
      });
  }

  deleteAccount(): void {
    this.deleteError = null;
    this.auth.deleteAccount().subscribe({
      next: () => this.auth.logout(),
      error: (err) =>
        (this.deleteError = err?.error?.detail || 'Delete failed.'),
    });
  }
}
