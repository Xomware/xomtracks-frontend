import { Component } from '@angular/core';
import { CognitoService } from '../../services/cognito.service';

/**
 * The app home at route `''`.
 *
 * Signed in: the Playlists home is the primary screen — the two rolling
 * playlists front and centre (reusing `<app-playlists>`) — with the browse
 * feed tucked into a sticky slide-out panel (`<app-feed-panel>`).
 *
 * Signed out: the public landing pitch (`<app-landing>`).
 *
 * The auth switch waits on `isReady$` so the first paint never flashes the
 * wrong screen before the session settles.
 */
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  constructor(public cognito: CognitoService) {}
}
