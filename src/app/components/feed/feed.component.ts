import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { SharesService } from '../../services/shares.service';
import { MeService } from '../../services/me.service';
import { RatingsService } from '../../services/ratings.service';
import { LinkPhoneUiService } from '../../services/link-phone-ui.service';
import {
  Direction,
  Platform,
  Rating,
  Share,
  TIME_WINDOWS,
  TimeWindow,
} from '../../models/share.model';
import {
  displayTitle,
  isMatched,
  openLabel,
  primaryUrl,
  trackKey,
} from '../../utils/track-display';

type LoadState = 'loading' | 'loaded' | 'error';
export type FeedView = 'tile' | 'list';
/**
 * Feed source: the two share directions, "mine" (the caller's own), and
 * "rated" (tracks the caller has rated — a filter over the browse feed).
 */
export type FeedMode = Direction | 'mine' | 'rated';

/** Options for the lighter source control that replaced the big feed tabs. */
export const FEED_SOURCES: ReadonlyArray<{ value: FeedMode; label: string }> = [
  { value: 'in', label: 'Shared with me' },
  { value: 'out', label: 'Shared by me' },
  { value: 'mine', label: 'Mine' },
  { value: 'rated', label: 'My rated' },
];

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
  readonly windows = TIME_WINDOWS;
  readonly sources = FEED_SOURCES;

  /** When hosted inside the slide-out panel: drop the big page heading (the
   * panel supplies its own) and tighten padding. */
  @Input() embedded = false;

  mode: FeedMode = 'in';
  window: TimeWindow = 'month';
  search = '';
  view: FeedView = 'tile';

  /** Selected genre filter, or null for "all genres". */
  genre: string | null = null;

  /** The share whose detail modal is open, or null when closed. */
  selected: Share | null = null;

  /** In "mine" mode: whether the caller has linked a number. null until known. */
  mineLinked: boolean | null = null;

  state: LoadState = 'loading';
  private allShares: Share[] = [];
  private sub?: Subscription;
  private linkedSub?: Subscription;

  /** Bumped on every successful load so the grouping memo invalidates. */
  private dataVersion = 0;
  private groupCache?: {
    key: string;
    reps: Share[];
    countByKey: Map<string, number>;
    sharersByKey: Map<string, string[]>;
  };

  constructor(
    private sharesService: SharesService,
    private meService: MeService,
    private ratingsService: RatingsService,
    private linkUi: LinkPhoneUiService,
  ) {}

  ngOnInit(): void {
    this.restoreView();
    // A successful link should refresh the Mine tab if it's the active view.
    this.linkedSub = this.linkUi.linked$.subscribe(() => {
      if (this.mode === 'mine') this.load();
    });
    this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.linkedSub?.unsubscribe();
  }

  setMode(mode: FeedMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.load();
  }

  /** Open the "Link your number" modal from the Mine-tab prompt. */
  openLink(): void {
    this.linkUi.requestOpen();
  }

  get isMine(): boolean {
    return this.mode === 'mine';
  }

  /** True once we know a mine-mode caller hasn't linked a number yet. */
  get mineUnlinked(): boolean {
    return this.isMine && this.mineLinked === false;
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

    if (this.mode === 'mine') {
      this.sub = this.meService.myShares(this.window).subscribe({
        next: (res) => {
          this.mineLinked = res.linked;
          this.setShares(res.shares ?? []);
          this.state = 'loaded';
        },
        error: () => {
          this.mineLinked = null;
          this.setShares([]);
          this.state = 'error';
        },
      });
      return;
    }

    // "My rated" filters the primary browse feed (shared-with-me) down to the
    // tracks the caller has rated; every other mode maps 1:1 to a direction.
    const direction: Direction = this.mode === 'rated' ? 'in' : this.mode;
    this.sub = this.sharesService.list(direction, this.window).subscribe({
      next: (res) => {
        this.setShares(res.shares ?? []);
        this.state = 'loaded';
      },
      error: () => {
        this.setShares([]);
        this.state = 'error';
      },
    });
  }

  private setShares(shares: Share[]): void {
    this.allShares = shares;
    this.dataVersion++; // invalidate the grouping memo
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

  /**
   * The feed's displayed entries: exact-message dedup first (dedupedShares),
   * then GROUPED by track so the same song shared to several people/dates
   * collapses to ONE entry. Each entry is the most-recent share of its track;
   * `groupCount()` gives the ×N. Narrowed by the search box at the group level
   * (a group shows if any of its underlying shares matches).
   */
  get groupedShares(): Share[] {
    return this.computeGroups().reps;
  }

  /** Number of underlying shares for a track group (the ×N badge). Matches the
   * detail modal's "shared N times" exactly — both count occurrencesOf(). */
  groupCount(share: Share): number {
    return this.computeGroups().countByKey.get(trackKey(share)) ?? 1;
  }

  /** Summarised distinct sharers of a track group ("Tori, Jack +1"), for the
   * shared-with-me direction. Empty for out/mine (sharer is always "you"). */
  sharerSummaryFor(share: Share): string {
    if (this.mode !== 'in') return '';
    return this.summarizeSharers(this.groupSharers(share));
  }

  get matchedCount(): number {
    return this.groupedShares.filter(
      (s) => s.matchStatus === 'matched' || s.matchStatus === 'manual',
    ).length;
  }

  get isFiltered(): boolean {
    return this.search.trim().length > 0;
  }

  /** Non-filtered empty-state copy per feed mode. */
  get emptyText(): string {
    if (this.mode === 'mine') return 'None of your shares are in this window yet.';
    if (this.mode === 'rated') return "You haven't rated any tracks in this window yet.";
    if (this.mode === 'in') return 'No songs shared with you in this window.';
    return 'No songs you shared in this window.';
  }

  // ── Genre filter ──────────────────────────────────────────────────
  /** Distinct, non-empty genres present in the loaded window, sorted. */
  get genres(): string[] {
    const set = new Set<string>();
    for (const s of this.allShares) {
      const g = s.genre?.trim();
      if (g) set.add(g);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  /** The genre control only shows once the backend genre-fetch has populated
   * at least one genre in the current window — otherwise it stays hidden. */
  get genreEnabled(): boolean {
    return this.genres.length > 0;
  }

  setGenre(genre: string | null): void {
    this.genre = genre || null;
    this.dataVersion++; // re-run the grouping/filter memo
  }

  // ── Ratings ───────────────────────────────────────────────────────
  /** The track group's key for a representative share (for the stars control
   * and the `/ratings/set` POST). */
  keyFor(share: Share): string {
    return trackKey(share);
  }

  ratingFor(share: Share): Rating | null | undefined {
    return share.rating;
  }

  /**
   * Set the caller's whole-group rating for a track. Updates every underlying
   * share of the group optimistically (so the ×N breakdown and any other view
   * of the same track reflect immediately), then persists via `/ratings/set`.
   * The server's authoritative aggregate replaces the optimistic one on success;
   * a failure reverts. Ratings never throw into the browse UI.
   */
  onRate(share: Share, value: number): void {
    const key = trackKey(share);
    const group = this.allShares.filter((s) => trackKey(s) === key);
    const before = group.map((s) => (s.rating ? { ...s.rating } : null));

    const optimistic = this.optimisticRating(share.rating, value);
    for (const s of group) s.rating = { ...optimistic };
    this.dataVersion++;

    this.ratingsService.set(key, value).subscribe({
      next: (agg) => {
        for (const s of group) s.rating = { ...agg };
        this.dataVersion++;
      },
      error: () => {
        // Revert — a rating hiccup shouldn't strand the row.
        group.forEach((s, i) => (s.rating = before[i]));
        this.dataVersion++;
      },
    });
  }

  /** Recompute an aggregate as if the caller's rating changed to `value`. */
  private optimisticRating(current: Rating | null | undefined, value: number): Rating {
    const avg = current?.avg ?? 0;
    const count = current?.count ?? 0;
    const my = current?.myRating ?? 0;
    const sum = avg * count - my + value;
    const nextCount = my > 0 ? count : count + 1;
    return {
      avg: nextCount > 0 ? sum / nextCount : value,
      count: nextCount,
      myRating: value,
    };
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

  /** Every underlying share of the selected track, newest-first — the modal's
   * full per-share breakdown (sharer + date). Length == the card's ×N. */
  get selectedOccurrences(): Share[] {
    if (!this.selected) return [];
    return [...this.occurrencesOf(this.selected)].sort(
      (a, b) => (b.messageDate ?? 0) - (a.messageDate ?? 0),
    );
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

  /** List-row sharer: the grouped summary for shared-with-me, else the single
   * sharer. Keeps the row consistent with the tile card. */
  rowSharerLabel(share: Share): string {
    const summary = this.sharerSummaryFor(share);
    return summary || this.sharerLabel(share);
  }

  sharerInitial(share: Share): string {
    return (this.rowSharerLabel(share)[0] ?? '?').toUpperCase();
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
    const key = trackKey(share);
    return this.dedupedShares.filter((s) => trackKey(s) === key);
  }

  /**
   * Build the by-track groups over the exact-message-deduped window, memoised
   * on (dataVersion, search). Returns the representative entries (most-recent
   * share per track, newest-first), the ×N count per track key, and the
   * distinct sharers per track key.
   */
  private computeGroups() {
    const q = this.search.trim().toLowerCase();
    const cacheKey = `${this.dataVersion}|${q}|${this.genre ?? ''}|${this.mode}`;
    if (this.groupCache?.key === cacheKey) return this.groupCache;

    const byKey = new Map<string, Share[]>();
    const order: string[] = [];
    for (const s of this.dedupedShares) {
      const k = trackKey(s);
      let arr = byKey.get(k);
      if (!arr) {
        arr = [];
        byKey.set(k, arr);
        order.push(k);
      }
      arr.push(s);
    }

    const countByKey = new Map<string, number>();
    const sharersByKey = new Map<string, string[]>();
    const reps: Share[] = [];
    for (const k of order) {
      const arr = byKey.get(k)!;
      countByKey.set(k, arr.length);
      // Representative = the most recent share of the track.
      const rep = arr.reduce((a, b) => ((b.messageDate ?? 0) > (a.messageDate ?? 0) ? b : a));
      reps.push(rep);
      // Distinct sharers, in first-seen order.
      const seen = new Set<string>();
      const names: string[] = [];
      for (const sh of arr) {
        const label = this.sharerLabel(sh);
        if (seen.has(label)) continue;
        seen.add(label);
        names.push(label);
      }
      sharersByKey.set(k, names);
    }

    let filteredReps = reps;
    if (q) {
      filteredReps = filteredReps.filter((rep) =>
        (byKey.get(trackKey(rep)) ?? [rep]).some((s) => this.matchesSearch(s, q)),
      );
    }
    // Genre filter — a group shows if any underlying share carries the genre.
    if (this.genre) {
      const g = this.genre;
      filteredReps = filteredReps.filter((rep) =>
        (byKey.get(trackKey(rep)) ?? [rep]).some((s) => s.genre?.trim() === g),
      );
    }
    // "My rated" — only tracks the caller has rated (myRating > 0).
    if (this.mode === 'rated') {
      filteredReps = filteredReps.filter((rep) => (rep.rating?.myRating ?? 0) > 0);
    }
    filteredReps = [...filteredReps].sort((a, b) => (b.messageDate ?? 0) - (a.messageDate ?? 0));

    this.groupCache = { key: cacheKey, reps: filteredReps, countByKey, sharersByKey };
    return this.groupCache;
  }

  private groupSharers(share: Share): string[] {
    return this.computeGroups().sharersByKey.get(trackKey(share)) ?? [];
  }

  private summarizeSharers(names: string[]): string {
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]}, ${names[1]}`;
    return `${names[0]}, ${names[1]} +${names.length - 2}`;
  }

  private matchesSearch(share: Share, q: string): boolean {
    const hay = [
      share.trackTitle,
      share.trackArtist,
      share.albumName,
      share.sharerName,
      share.sharerHandle,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
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
