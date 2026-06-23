import { Component, HostListener } from '@angular/core';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent {
  menuOpen = false;

  constructor(public authService: AuthService) {}

  toggleMenu(event: MouseEvent) {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  // Close the dropdown on any click elsewhere (or after selecting an item).
  @HostListener('document:click')
  closeMenu() {
    this.menuOpen = false;
  }

  logout() {
    this.authService.logout();
  }
}
