import { Component, Input } from '@angular/core';
import { Platform, Share } from '../../models/share.model';

const PLATFORM_LABELS: Record<Platform, string> = {
  spotify: 'Spotify',
  soundcloud: 'SoundCloud',
  apple: 'Apple Music',
};

/**
 * Presentational card for a single share. Renders cover art + metadata, and
 * degrades honestly when a share is unmatched (no Spotify equivalent) or
 * still pending — showing the raw platform/link instead of a broken cover.
 */
@Component({
  selector: 'app-share-card',
  templateUrl: './share-card.component.html',
  styleUrls: ['./share-card.component.scss'],
})
export class ShareCardComponent {
  @Input({ required: true }) share!: Share;

  /** Toggled true when the <img> fails, so the template swaps to the
   * fallback cover without leaving a broken image. */
  artFailed = false;

  get platformLabel(): string {
    return PLATFORM_LABELS[this.share.platform] ?? this.share.platform;
  }

  get hasArt(): boolean {
    return !!this.share.albumArtUrl && !this.artFailed;
  }

  get title(): string {
    return this.share.trackTitle?.trim() || 'Unrecognised track';
  }

  get artist(): string {
    return this.share.trackArtist?.trim() || '';
  }

  /** The best outbound link: Spotify when resolved, else the original share URL. */
  get primaryUrl(): string {
    if (this.share.resolvedSpotifyId) {
      return `https://open.spotify.com/track/${this.share.resolvedSpotifyId}`;
    }
    return this.share.sourceUrl;
  }

  get primaryLinkLabel(): string {
    return this.share.resolvedSpotifyId ? 'Open in Spotify' : `Open on ${this.platformLabel}`;
  }

  get sharer(): string {
    const name = this.share.sharerName?.trim();
    const handle = this.share.sharerHandle?.trim();
    if (this.share.direction === 'out') return 'You';
    return name || handle || 'Unknown';
  }

  get sharerInitial(): string {
    return (this.sharer[0] ?? '?').toUpperCase();
  }

  get statusChip(): { label: string; kind: string } | null {
    switch (this.share.matchStatus) {
      case 'matched':
      case 'manual':
        return null; // matched is the happy path — no chip needed
      case 'unmatched':
        return { label: 'Not on Spotify', kind: 'unmatched' };
      case 'pending':
        return { label: 'Matching…', kind: 'pending' };
      default:
        return null;
    }
  }

  get dateLabel(): string {
    const ms = (this.share.messageDate ?? 0) * 1000;
    if (!ms) return '';
    const then = new Date(ms);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    const sameYear = then.getFullYear() === now.getFullYear();
    return then.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' }),
    });
  }

  onArtError(): void {
    this.artFailed = true;
  }
}
