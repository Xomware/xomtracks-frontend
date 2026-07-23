import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { CognitoService } from './services/cognito.service';
import { LinkPhoneUiService } from './services/link-phone-ui.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'xomtracks-frontend';

  /** Whether the "Link your number" modal is mounted. Hosted here so both the
   * header entry and the feed's "Mine" prompt can open the single instance. */
  showLinkModal = false;

  private openSub?: Subscription;

  constructor(
    public cognito: CognitoService,
    private linkUi: LinkPhoneUiService,
  ) {}

  ngOnInit(): void {
    this.openSub = this.linkUi.open$.subscribe(() => (this.showLinkModal = true));
  }

  ngOnDestroy(): void {
    this.openSub?.unsubscribe();
  }

  openLinkModal(): void {
    this.showLinkModal = true;
  }

  closeLinkModal(): void {
    this.showLinkModal = false;
  }

  signOut(): void {
    this.cognito.signOut().subscribe({
      error: () => {
        /* sign-out is best-effort — a network blip shouldn't strand the UI */
      },
    });
  }
}
