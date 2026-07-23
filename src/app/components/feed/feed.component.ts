import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { SharesService } from '../../services/shares.service';
import { MeService } from '../../services/me.service';
import { LinkPhoneUiService } from '../../services/link-phone-ui.service';
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
/** Feed source: the two share directions, plus "mine" (the caller's own). */
export type FeedMode = Direction | 'mine';

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

  mode: FeedMode = 'in';
  window: TimeWindow = 'month';
  search = '';
  view: FeedView = 'tile';

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

    this.sub = this.sharesService.list(this.mode, this.window).subscribe({
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
    return this.computeGroups().countByKey.get(this.trackKey(share)) ?? 1;
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
    if (this.mode === 'in') return 'No songs shared with you in this window.';
    return 'No songs you shared in this window.';
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
    const key = this.trackKey(share);
    return this.dedupedShares.filter((s) => this.trackKey(s) === key);
  }

  /**
   * Build the by-track groups over the exact-message-deduped window, memoised
   * on (dataVersion, search). Returns the representative entries (most-recent
   * share per track, newest-first), the ×N count per track key, and the
   * distinct sharers per track key.
   */
  private computeGroups() {
    const q = this.search.trim().toLowerCase();
    const cacheKey = `${this.dataVersion}|${q}`;
    if (this.groupCache?.key === cacheKey) return this.groupCache;

    const byKey = new Map<string, Share[]>();
    const order: string[] = [];
    for (const s of this.dedupedShares) {
      const k = this.trackKey(s);
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
      filteredReps = reps.filter((rep) =>
        (byKey.get(this.trackKey(rep)) ?? [rep]).some((s) => this.matchesSearch(s, q)),
      );
    }
    filteredReps = [...filteredReps].sort((a, b) => (b.messageDate ?? 0) - (a.messageDate ?? 0));

    this.groupCache = { key: cacheKey, reps: filteredReps, countByKey, sharersByKey };
    return this.groupCache;
  }

  private groupSharers(share: Share): string[] {
    return this.computeGroups().sharersByKey.get(this.trackKey(share)) ?? [];
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

  /**
   * Identity for "same track" grouping — Spotify id when resolved (robust
   * across URL formats), else the normalised source URL, else title+artist.
   * Used by BOTH the feed grouping and the modal's occurrence count so the
   * card's ×N and the modal's "shared N times" always agree.
   */
  private trackKey(share: Share): string {
    if (share.resolvedSpotifyId) return `sp:${share.resolvedSpotifyId}`;
    const url = this.normalizedUrl(share.sourceUrl);
    if (url) return `url:${url}`;
    const title = (share.trackTitle ?? '').trim().toLowerCase();
    const artist = (share.trackArtist ?? '').trim().toLowerCase();
    return `ta:${title}|${artist}`;
  }

  /** host + path (no query/hash/trailing slash), lowercased — so the same link
   * shared in slightly different forms still groups together. */
  private normalizedUrl(raw?: string | null): string {
    if (!raw) return '';
    try {
      const u = new URL(raw);
      const path = u.pathname.replace(/\/+$/, '');
      return `${u.host}${path}`.toLowerCase();
    } catch {
      return raw.trim().toLowerCase();
    }
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
