import { Component, HostListener } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { CognitoService } from './services/cognito.service';
import { AdminService } from './services/admin.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'xomtracks-frontend';

  /** Whether the top-right account dropdown (username -> Profile / Sign out) is open. */
  accountMenuOpen = false;

  /**
   * True only for admins — probes `GET /admin/requests` once the caller is
   * signed in (403 → false), so the "Admin" menu entry never shows to
   * non-admins. Signed-out users skip the probe entirely.
   */
  readonly isAdmin$: Observable<boolean>;

  constructor(
    public cognito: CognitoService,
    private adminService: AdminService,
  ) {
    this.isAdmin$ = this.cognito.user$.pipe(
      switchMap((user) => (user ? this.adminService.hasAccess() : of(false))),
    );
  }

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
