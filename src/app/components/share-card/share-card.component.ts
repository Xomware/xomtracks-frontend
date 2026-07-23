import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Share } from '../../models/share.model';
import {
  displayTitle,
  isMatched,
  openLabel,
  platformLabel,
  primaryUrl,
} from '../../utils/track-display';

/**
 * Presentational card for a single share. Renders cover art + metadata, opens
 * the detail modal when its trigger is activated, and — for shares with no
 * Spotify match (SoundCloud / Apple / unresolved) — surfaces a prominent link
 * straight to the original `sourceUrl` so a card is never a dead end.
 */
@Component({
  selector: 'app-share-card',
  templateUrl: './share-card.component.html',
  styleUrls: ['./share-card.component.scss'],
})
export class ShareCardComponent {
  @Input({ required: true }) share!: Share;

  /** Emitted when the card's trigger is activated so the feed opens the modal. */
  @Output() open = new EventEmitter<Share>();

  /** Toggled true when the <img> fails, so the template swaps to the
   * fallback cover without leaving a broken image. */
  artFailed = false;

  activate(): void {
    this.open.emit(this.share);
  }

  get platformLabel(): string {
    return platformLabel(this.share.platform);
  }

  get hasArt(): boolean {
    return !!this.share.albumArtUrl && !this.artFailed;
  }

  get title(): string {
    return displayTitle(this.share);
  }

  get artist(): string {
    return this.share.trackArtist?.trim() || '';
  }

  /** Only unmatched shares get an inline outbound link; matched tracks play
   * from inside the modal. */
  get showOpenLink(): boolean {
    return !isMatched(this.share);
  }

  get openUrl(): string {
    return primaryUrl(this.share);
  }

  get openLinkLabel(): string {
    return openLabel(this.share);
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
