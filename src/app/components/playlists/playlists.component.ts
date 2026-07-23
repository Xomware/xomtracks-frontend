import { Component, Input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  ROLLING_PLAYLISTS,
  RollingPlaylist,
  spotifyEmbedUrl,
  spotifyPlaylistUrl,
} from '../../config/playlists.config';

interface PlaylistView extends RollingPlaylist {
  embedUrl: SafeResourceUrl;
  openUrl: string;
}

/**
 * The Playlists destination. Surfaces Xomtracks' live, rolling Spotify
 * playlists via the official embed iframe — which renders cover + tracklist +
 * play button and lets users save / like / share natively on Spotify. A plain
 * "Open in Spotify" link is provided per playlist as a no-iframe fallback.
 */
@Component({
  selector: 'app-playlists',
  templateUrl: './playlists.component.html',
  styleUrls: ['./playlists.component.scss'],
})
export class PlaylistsComponent {
  /** When hosted inside the slide-out panel, drop the section heading (the
   * panel supplies its own) and tighten the outer padding. */
  @Input() embedded = false;

  readonly playlists: PlaylistView[];

  constructor(sanitizer: DomSanitizer) {
    // Embed URLs point only at open.spotify.com — trusted, so we bypass
    // Angular's resource-url guard to let them load in the iframe.
    this.playlists = ROLLING_PLAYLISTS.map((p) => ({
      ...p,
      embedUrl: sanitizer.bypassSecurityTrustResourceUrl(spotifyEmbedUrl(p.id)),
      openUrl: spotifyPlaylistUrl(p.id),
    }));
  }
}
