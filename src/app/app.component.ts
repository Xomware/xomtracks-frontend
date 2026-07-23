import { Component, HostListener } from '@angular/core';
import { CognitoService } from './services/cognito.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'xomtracks-frontend';

  /** Whether the top-right account dropdown (username -> Profile / Sign out) is open. */
  accountMenuOpen = false;

  constructor(public cognito: CognitoService) {}

  toggleAccountMenu(event: MouseEvent): void {
    // Stop the document:click handler below from immediately re-closing it.
    event.stopPropagation();
    this.accountMenuOpen = !this.accountMenuOpen;
  }

  /** Any click outside the menu closes it. */
  @HostListener('document:click')
  closeAccountMenu(): void {
    this.accountMenuOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.accountMenuOpen = false;
  }

  signOut(): void {
    this.accountMenuOpen = false;
    this.cognito.signOut().subscribe({
      error: () => {
        /* sign-out is best-effort — a network blip shouldn't strand the UI */
      },
    });
  }
}
