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

  /** Number of underlying shares of this track (for the ×N badge). 1 = no badge. */
  @Input() shareCount = 1;

  /** Grouped sharer summary ("Tori, Jack +1") for shared-with-me; when set it
   * replaces the single-sharer name. Empty falls back to the one sharer. */
  @Input() sharerSummary = '';

  /** The track group's key, for the whole-group rating control. */
  @Input() trackKey = '';

  /** The caller's "heard" state for this track (drives the toggle + dim). */
  @Input() heard = false;

  /** Emitted when the card's trigger is activated so the feed opens the modal. */
  @Output() open = new EventEmitter<Share>();

  /** Emitted with a 1..5 value when the caller sets a rating from the card. */
  @Output() rate = new EventEmitter<number>();

  /** Emitted when the caller toggles the heard state from the card. */
  @Output() toggleHeard = new EventEmitter<void>();

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

  /** Displayed sharer: the grouped summary when present, else the one sharer. */
  get sharerDisplay(): string {
    return this.sharerSummary.trim() || this.sharer;
  }

  get sharerInitial(): string {
    return (this.sharerDisplay[0] ?? '?').toUpperCase();
  }

  /** Show the ×N badge only when the track was shared more than once. */
  get showCount(): boolean {
    return this.shareCount > 1;
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
