import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { SharesService } from '../../services/shares.service';
import {
  DIRECTIONS,
  Direction,
  Share,
  TIME_WINDOWS,
  TimeWindow,
} from '../../models/share.model';

type LoadState = 'loading' | 'loaded' | 'error';

/**
 * The browse feed (authed). Two directions (shared with me / by me) ×
 * time-window control (week / month / 6mo / all). Small scale, so we load
 * the whole window from `GET /shares/list` and filter/search client-side.
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

  state: LoadState = 'loading';
  private allShares: Share[] = [];
  private sub?: Subscription;

  constructor(private sharesService: SharesService) {}

  ngOnInit(): void {
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

  retry(): void {
    this.load();
  }

  clearSearch(): void {
    this.search = '';
  }

  load(): void {
    this.state = 'loading';
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

  /** Client-side title/artist/album search over the loaded window. */
  get shares(): Share[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.allShares;
    return this.allShares.filter((s) => {
      const hay = [s.trackTitle, s.trackArtist, s.albumName, s.sharerName, s.sharerHandle]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  get matchedCount(): number {
    return this.allShares.filter(
      (s) => s.matchStatus === 'matched' || s.matchStatus === 'manual',
    ).length;
  }

  get isFiltered(): boolean {
    return this.search.trim().length > 0;
  }

  trackByShareId(_index: number, share: Share): string {
    return share.shareId;
  }

  /** Skeleton placeholders while loading. */
  readonly skeletons = Array.from({ length: 10 });
}
