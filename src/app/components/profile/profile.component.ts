import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CognitoService } from '../../services/cognito.service';
import { MeService } from '../../services/me.service';
import { SharesService } from '../../services/shares.service';
import { Share } from '../../models/share.model';
import { LinkStatus, MeInfo } from '../../models/me.model';
import { displayTitle, trackKey } from '../../utils/track-display';

type LoadState = 'loading' | 'loaded' | 'error';

/** A named tally (top sharers, top genres) — label + how many. */
export interface CountStat {
  label: string;
  count: number;
}

/** A top-rated track: the representative share plus the caller's own rating. */
export interface RatedTrack {
  share: Share;
  title: string;
  artist: string;
  myRating: number;
}

/**
 * The signed-in caller's profile / home (`/profile`, authed).
 *
 * Stats are computed entirely client-side from the shares they can load — the
 * two browse directions (`GET /shares/list`) plus their own attributed shares
 * (`GET /me/shares`): totals, a shared-with vs shared-by split, their top
 * sharers, top genres, and their highest-rated tracks. Everything degrades: a
 * failing endpoint yields an empty slice rather than blanking the page.
 *
 * This is also where a member REQUESTS to link their phone number, under the
 * admin-approval model. `GET /me/get` returns a `linkStatus` (none / pending /
 * linked) that drives this section: `none` shows the phone-entry form (which
 * POSTs `/me/link-phone` for an admin to approve), `pending` shows a
 * pending-approval notice, and `linked` confirms the link with the caller's
 * attributed share count. An admin acts on the request in the `/admin` portal.
 */
@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit, OnDestroy {
  state: LoadState = 'loading';

  /** The caller's display email, from the Cognito session. */
  email = '';

  totalShared = 0;
  sharedWithMe = 0;
  sharedByMe = 0;

  topSharers: CountStat[] = [];
  topGenres: CountStat[] = [];
  topRated: RatedTrack[] = [];

  // ── Link-your-number request (admin-approval model) ──────────────
  linkPhone = '';
  /** Server-reported link state, from `GET /me/get`. Drives which link view
   * shows: form (none) / pending notice / linked confirmation. */
  linkStatus: LinkStatus = 'none';
  /** Attributed share count, shown in the `linked` state. */
  linkedShareCount = 0;
  /** True while the `/me/link-phone` POST is in flight. */
  linkSubmitting = false;
  /** True right after a successful submit this session — swaps the copy to the
   * "Request submitted" acknowledgement (vs the persistent "pending"). */
  justSubmitted = false;
  /** Non-empty when the submit failed — shown inline under the form. */
  linkError = '';

  private sub?: Subscription;

  constructor(
    private cognito: CognitoService,
    private meService: MeService,
    private sharesService: SharesService,
  ) {}

  ngOnInit(): void {
    this.email = this.cognito.currentUser?.email ?? '';
    this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  retry(): void {
    this.load();
  }

  /** First letter of the email — the profile avatar glyph. */
  get avatarInitial(): string {
    return (this.email[0] ?? '?').toUpperCase();
  }

  // ── Link request ─────────────────────────────────────────────────
  get linkDigitCount(): number {
    return (this.linkPhone.match(/\d/g) ?? []).length;
  }

  /** US numbers match on the last 10 digits — enable submit once we have them. */
  get canSubmitLinkRequest(): boolean {
    return this.linkDigitCount >= 10 && !this.linkSubmitting && this.linkStatus === 'none';
  }

  /** Show the phone-entry form (no request in flight and not yet requested). */
  get showLinkForm(): boolean {
    return this.linkStatus === 'none' && !this.justSubmitted;
  }

  /** Show the pending-approval notice (server said pending, or we just sent). */
  get showLinkPending(): boolean {
    return this.linkStatus === 'pending' || this.justSubmitted;
  }

  /** Show the linked confirmation. */
  get showLinkLinked(): boolean {
    return this.linkStatus === 'linked';
  }

  /** The requested number, lightly formatted for the acknowledgement. */
  get requestedNumber(): string {
    const digits = this.linkPhone.replace(/\D/g, '').slice(-10);
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return this.linkPhone.trim();
  }

  submitLinkRequest(): void {
    if (!this.canSubmitLinkRequest) return;
    this.linkSubmitting = true;
    this.linkError = '';
    this.meService.linkPhone(this.linkPhone).subscribe({
      next: () => {
        this.linkSubmitting = false;
        this.justSubmitted = true;
        this.linkStatus = 'pending';
      },
      error: () => {
        this.linkSubmitting = false;
        this.linkError = "Couldn't submit your request. Please try again.";
      },
    });
  }

  load(): void {
    this.state = 'loading';
    this.sub?.unsubscribe();

    const emptyMe: MeInfo = {
      email: this.email,
      linkStatus: 'none',
      linked: false,
      linkedHandles: [],
      shareCount: 0,
    };

    this.sub = forkJoin({
      me: this.meService.get().pipe(catchError(() => of(emptyMe))),
      inShares: this.sharesService
        .list('in', 'all')
        .pipe(catchError(() => of({ shares: [] as Share[] }))),
      outShares: this.sharesService
        .list('out', 'all')
        .pipe(catchError(() => of({ shares: [] as Share[] }))),
      mine: this.meService
        .myShares('all')
        .pipe(catchError(() => of({ shares: [] as Share[] }))),
    }).subscribe({
      next: ({ me, inShares, outShares, mine }) => {
        this.applyMe(me);
        this.computeStats(inShares.shares ?? [], outShares.shares ?? [], mine.shares ?? []);
        this.state = 'loaded';
      },
      error: () => {
        this.state = 'error';
      },
    });
  }

  /** Fold the `/me/get` result into the link section (unless we just submitted
   * this session — keep the local "pending" acknowledgement in that case). */
  private applyMe(me: MeInfo): void {
    if (me.email) this.email = me.email;
    this.linkedShareCount = me.shareCount ?? 0;
    if (!this.justSubmitted) {
      this.linkStatus = me.linkStatus ?? 'none';
    }
  }

  trackByLabel(_index: number, stat: CountStat): string {
    return stat.label;
  }

  trackByRated(_index: number, track: RatedTrack): string {
    return trackKey(track.share);
  }

  hasArt(share: Share): boolean {
    return !!share.albumArtUrl;
  }

  // ── Internals ────────────────────────────────────────────────────
  /** Build every derived stat from the three share sources. */
  private computeStats(inShares: Share[], outShares: Share[], mine: Share[]): void {
    this.sharedWithMe = this.distinctTrackCount(inShares);
    // "Shared by me" prefers the attributed Mine feed (linked handles), falling
    // back to the out-direction browse feed when nothing is attributed yet.
    const byMe = mine.length ? mine : outShares;
    this.sharedByMe = this.distinctTrackCount(byMe);
    this.totalShared = this.sharedWithMe + this.sharedByMe;

    // Top sharers come from the shared-with-me direction (the only one with a
    // counterparty — outbound shares are all "you").
    this.topSharers = this.tally(
      inShares.map((s) => s.sharerName?.trim() || s.sharerHandle?.trim() || 'Unknown'),
    ).slice(0, 5);

    // Top genres: flatten every share's `genres` array across all sources.
    const genreSource = [...inShares, ...byMe];
    const genreLabels = genreSource.flatMap((s) =>
      (s.genres ?? []).map((g) => g?.trim()).filter((g): g is string => !!g),
    );
    this.topGenres = this.tally(genreLabels).slice(0, 8);

    this.topRated = this.computeTopRated(genreSource);
  }

  /** Distinct-track count for a slice, so a song shared five times counts once. */
  private distinctTrackCount(shares: Share[]): number {
    const seen = new Set<string>();
    for (const s of shares) seen.add(trackKey(s));
    return seen.size;
  }

  /** Count occurrences of each label, sorted by count desc then label asc. */
  private tally(labels: string[]): CountStat[] {
    const counts = new Map<string, number>();
    for (const label of labels) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  /** The caller's highest-rated tracks (myRating > 0), one row per track. */
  private computeTopRated(shares: Share[]): RatedTrack[] {
    const best = new Map<string, RatedTrack>();
    for (const share of shares) {
      const myRating = share.rating?.myRating ?? 0;
      if (myRating <= 0) continue;
      const key = trackKey(share);
      const existing = best.get(key);
      if (!existing || myRating > existing.myRating) {
        best.set(key, {
          share,
          title: displayTitle(share),
          artist: share.trackArtist?.trim() || '',
          myRating,
        });
      }
    }
    return [...best.values()]
      .sort(
        (a, b) =>
          b.myRating - a.myRating ||
          (b.share.messageDate ?? 0) - (a.share.messageDate ?? 0),
      )
      .slice(0, 5);
  }
}
