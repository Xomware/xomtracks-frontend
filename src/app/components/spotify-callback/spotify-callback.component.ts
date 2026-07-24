import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SpotifyService } from '../../services/spotify.service';

type CallbackState = 'exchanging' | 'success' | 'error';

/**
 * Spotify OAuth redirect landing (`/callback`) — the registered redirect URI
 * `https://xomtracks.xomware.com/callback`.
 *
 * Spotify bounces the browser back here with `?code` + `?state` (or `?error`
 * when the user declines). We verify the state against the value stashed
 * before the redirect, POST { code, state } to `/auth/spotify-callback` to
 * complete the connection, then route back to the Profile. All three states —
 * exchanging / success / error — are surfaced with a `role="status"` /
 * `role="alert"` live region.
 */
@Component({
  selector: 'app-spotify-callback',
  templateUrl: './spotify-callback.component.html',
  styleUrls: ['./spotify-callback.component.scss'],
})
export class SpotifyCallbackComponent implements OnInit, OnDestroy {
  state: CallbackState = 'exchanging';
  errorMessage = '';

  private timer?: ReturnType<typeof setTimeout>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private spotify: SpotifyService,
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const code = params.get('code');
    const state = params.get('state');
    const oauthError = params.get('error');

    // The user declined consent, or Spotify returned an explicit error.
    if (oauthError) {
      this.fail(
        oauthError === 'access_denied'
          ? 'You declined access. Spotify was not connected.'
          : `Spotify returned an error (${oauthError}).`,
      );
      return;
    }

    if (!code || !state) {
      this.fail('This link is missing its authorization details. Please try connecting again.');
      return;
    }

    // Defensive CSRF check — the backend validates state authoritatively, but a
    // local mismatch means the redirect didn't originate from this browser.
    const expected = this.spotify.consumeState();
    if (expected && expected !== state) {
      this.fail("Couldn't verify this request. Please start the connection again.");
      return;
    }

    this.spotify.callback(code, state).subscribe({
      next: () => {
        this.spotify.markConnected();
        this.state = 'success';
        // Give the success confirmation a beat, then return to the Profile.
        this.timer = setTimeout(() => this.router.navigateByUrl('/profile'), 1800);
      },
      error: (err) => {
        const backendMessage = err?.error?.error?.message as string | undefined;
        this.fail(backendMessage || "Couldn't finish connecting Spotify. Please try again.");
      },
    });
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  private fail(message: string): void {
    this.errorMessage = message;
    this.state = 'error';
  }
}
