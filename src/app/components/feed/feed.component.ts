import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { SharesService } from '../../services/shares.service';
import {
  DIRECTIONS,
  Direction,
  Platform,
  Share,
  TIME_WINDOWS,
  TimeWindow,
} from '../../models/share.model';
import {
  displayTitle,
  isMatched,
  openLabel,
  primaryUrl,
} from '../../utils/track-display';

type LoadState = 'loading' | 'loaded' | 'error';
export type FeedView = 'tile' | 'list';

const VIEW_STORAGE_KEY = 'xt.feed.view';

const PLATFORM_LABELS: Record<Platform, string> = {
  spotify: 'Spotify',
  soundcloud: 'SoundCloud',
  apple: 'Apple Music',
};

/**
 * The browse feed (authed). Two directions (shared with me / by me) ×
 * time-window control (week / month / 6mo / all). Small scale, so we load
 * the whole window from `GET /shares/list` and filter/search client-side.
 *
 * Renders either a cover-art tile grid or a dense, chart-like list; the choice
 * persists in localStorage. Clicking any row/card opens a detail modal.
 */
@Component({
  selector: 'app-feed',
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss'],
})
export class FeedComponent implements OnInit, OnDestroy {
  readonly directions = DIRECTIONS;
  readonly windows = TIME_WINDOWS;

  direction: Direction = 'in';
  window: TimeWindow = 'month';
  search = '';
  view: FeedView = 'tile';

  /** The share whose detail modal is open, or null when closed. */
  selected: Share | null = null;

  state: LoadState = 'loading';
  private allShares: Share[] = [];
  private sub?: Subscription;

  constructor(private sharesService: SharesService) {}

  ngOnInit(): void {
    this.restoreView();
    this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  setDirection(direction: Direction): void {
    if (this.direction === direction) return;
    this.direction = direction;
    this.load();
  }

  setWindow(window: TimeWindow): void {
    if (this.window === window) return;
    this.window = window;
    this.load();
  }

  setView(view: FeedView): void {
    if (this.view === view) return;
    this.view = view;
    this.persistView();
  }

  retry(): void {
    this.load();
  }

  clearSearch(): void {
    this.search = '';
  }

  openDetail(share: Share): void {
    this.selected = share;
  }

  closeDetail(): void {
    this.selected = null;
  }

  load(): void {
    this.state = 'loading';
    this.selected = null;
    this.sub?.unsubscribe();
    this.sub = this.sharesService.list(this.direction, this.window).subscribe({
      next: (res) => {
        this.allShares = res.shares ?? [];
        this.state = 'loaded';
      },
      error: () => {
        this.allShares = [];
        this.state = 'error';
      },
    });
  }

  /**
   * Client-side dedup fallback (a backend dedup is landing in parallel). Drops
   * only exact same-message repeats — keyed on `messageGuid`, else a composite
   * of resolved Spotify id + sharer + timestamp. The same track shared by a
   * different person or on a different date has a different key and still
   * appears separately.
   */
  get dedupedShares(): Share[] {
    const seen = new Set<string>();
    const out: Share[] = [];
    for (const s of this.allShares) {
      const key = this.dedupKey(s);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }

  /** Deduped window, narrowed by the client-side search box. */
  get shares(): Share[] {
    const base = this.dedupedShares;
    const q = this.search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((s) => {
      const hay = [s.trackTitle, s.trackArtist, s.albumName, s.sharerName, s.sharerHandle]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  get matchedCount(): number {
    return this.dedupedShares.filter(
      (s) => s.matchStatus === 'matched' || s.matchStatus === 'manual',
    ).length;
  }

  get isFiltered(): boolean {
    return this.search.trim().length > 0;
  }

  /** How many times the selected track appears across the deduped window. */
  get selectedSharedTimes(): number {
    if (!this.selected) return 0;
    return this.occurrencesOf(this.selected).length;
  }

  /** Distinct sharers of the selected track other than the selected share's. */
  get selectedOtherSharers(): string[] {
    if (!this.selected) return [];
    const self = this.sharerLabel(this.selected);
    const names: string[] = [];
    const seen = new Set<string>();
    for (const s of this.occurrencesOf(this.selected)) {
      const label = this.sharerLabel(s);
      if (label === self || seen.has(label)) continue;
      seen.add(label);
      names.push(label);
    }
    return names;
  }

  platformLabel(platform: Platform): string {
    return PLATFORM_LABELS[platform] ?? platform;
  }

  rowTitle(share: Share): string {
    return displayTitle(share);
  }

  showOpenLink(share: Share): boolean {
    return !isMatched(share);
  }

  openUrl(share: Share): string {
    return primaryUrl(share);
  }

  openLinkLabel(share: Share): string {
    return openLabel(share);
  }

  rowArtist(share: Share): string {
    return share.trackArtist?.trim() || '—';
  }

  sharerLabel(share: Share): string {
    if (share.direction === 'out') return 'You';
    return share.sharerName?.trim() || share.sharerHandle?.trim() || 'Unknown';
  }

  sharerInitial(share: Share): string {
    return (this.sharerLabel(share)[0] ?? '?').toUpperCase();
  }

  relativeDate(share: Share): string {
    const ms = (share.messageDate ?? 0) * 1000;
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

  hasArt(share: Share): boolean {
    return !!share.albumArtUrl;
  }

  trackByShareId(_index: number, share: Share): string {
    return share.shareId;
  }

  /** Skeleton placeholders while loading. */
  readonly skeletons = Array.from({ length: 10 });

  // ── Internals ───────────────────────────────────────────────────
  private occurrencesOf(share: Share): Share[] {
    const key = this.trackKey(share);
    return this.dedupedShares.filter((s) => this.trackKey(s) === key);
  }

  /** Identity for "same track" grouping — Spotify id when matched, else a
   * normalised title+artist so unmatched dupes still cluster. */
  private trackKey(share: Share): string {
    if (share.resolvedSpotifyId) return `sp:${share.resolvedSpotifyId}`;
    const title = (share.trackTitle ?? '').trim().toLowerCase();
    const artist = (share.trackArtist ?? '').trim().toLowerCase();
    return `ta:${title}|${artist}`;
  }

  /** Identity for "same message" dedup — never collapses distinct shares. */
  private dedupKey(share: Share): string {
    if (share.messageGuid) return `g:${share.messageGuid}`;
    const track = share.resolvedSpotifyId ?? share.sourceUrl ?? 'x';
    const sharer = share.sharerHandle ?? share.sharerName ?? 'x';
    return `c:${track}|${sharer}|${share.messageDate ?? 0}`;
  }

  private restoreView(): void {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === 'tile' || stored === 'list') this.view = stored;
    } catch {
      /* localStorage can throw in private mode — default view is fine. */
    }
  }

  private persistView(): void {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, this.view);
    } catch {
      /* non-fatal — the toggle still works for this session. */
    }
  }
}
