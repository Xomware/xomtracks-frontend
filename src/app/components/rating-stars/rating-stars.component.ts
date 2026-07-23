import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Rating } from '../../models/share.model';

/**
 * Whole-group star rating for a track. Shows the aggregate (avg + count) as a
 * muted "ghost" fill and the caller's own rating as a bright fill; clicking a
 * star sets the caller's rating and emits `rate`. The parent (feed) owns the
 * POST to `/ratings/set` and updates the `rating` input optimistically.
 *
 * Degrades gracefully: when `rating` is absent (backend not deployed yet) the
 * control still renders empty and settable — no errors, avg/count read as 0.
 *
 * Accessible: a labelled radiogroup of star buttons, Enter/Space to set,
 * Left/Right arrows to move between stars, visible focus rings.
 */
@Component({
  selector: 'app-rating-stars',
  templateUrl: './rating-stars.component.html',
  styleUrls: ['./rating-stars.component.scss'],
})
export class RatingStarsComponent {
  /** The whole-group aggregate + caller's own rating. May be null/undefined. */
  @Input() rating: Rating | null | undefined = null;

  /** The track group's key — echoed back on `rate` so the parent can POST. */
  @Input({ required: true }) trackKey!: string;

  /** Visual size. `md` is used in the detail modal, `sm` in feed rows/tiles. */
  @Input() size: 'sm' | 'md' = 'sm';

  /** Disable interaction (e.g. while a set is in flight). */
  @Input() disabled = false;

  /** Whether to show the "avg (count)" summary text beside the stars. */
  @Input() showSummary = true;

  /** Emits the chosen 1..5 rating when a star is activated. */
  @Output() rate = new EventEmitter<number>();

  readonly stars = [1, 2, 3, 4, 5] as const;

  /** Star currently under the pointer (0 = none), for hover preview. */
  hover = 0;

  get myRating(): number {
    return this.rating?.myRating ?? 0;
  }

  get avg(): number {
    return this.rating?.avg ?? 0;
  }

  get count(): number {
    return this.rating?.count ?? 0;
  }

  /** avg rounded to one decimal for the summary label. */
  get avgLabel(): string {
    return this.avg > 0 ? this.avg.toFixed(1) : '—';
  }

  get ariaLabel(): string {
    if (this.myRating) return `Your rating: ${this.myRating} of 5 stars`;
    if (this.count) return `Average rating ${this.avgLabel} of 5, ${this.count} ratings`;
    return 'Not rated yet — rate this track';
  }

  /**
   * Fill state of one star:
   *  - 'on'  bright (the caller's own rating, or the live hover preview)
   *  - 'avg' muted (reflects the aggregate when the caller hasn't rated)
   *  - 'off' empty
   */
  starState(star: number): 'on' | 'avg' | 'off' {
    const active = this.hover || this.myRating;
    if (active) return star <= active ? 'on' : 'off';
    if (this.count > 0) return star <= Math.round(this.avg) ? 'avg' : 'off';
    return 'off';
  }

  starAriaLabel(star: number): string {
    return star === 1 ? '1 star' : `${star} stars`;
  }

  onEnter(star: number): void {
    if (!this.disabled) this.hover = star;
  }

  onLeave(): void {
    this.hover = 0;
  }

  select(star: number): void {
    if (this.disabled) return;
    if (star === this.myRating) return; // no-op re-click
    this.rate.emit(star);
  }

  /** Left/Right (and Up/Down) move focus between star buttons. */
  onKeydown(event: KeyboardEvent, index: number): void {
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(4, index + 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(0, index - 1);
    else return;
    event.preventDefault();
    const group = (event.currentTarget as HTMLElement).closest('.stars');
    const btn = group?.querySelectorAll<HTMLButtonElement>('.star')[next];
    btn?.focus();
  }
}
