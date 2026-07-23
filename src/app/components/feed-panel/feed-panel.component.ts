import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
} from '@angular/core';

/**
 * The rolling playlists, tucked into a sticky slide-out. A VERTICAL tab pinned
 * to the right screen edge (a bottom-right FAB on phones) toggles the panel; the
 * playlists (`<app-playlists>`) live inside. The browse feed is the full-page
 * main view now, so the two trade places — this panel is the pan-out companion.
 *
 * Desktop: a right-side panel. Mobile: a bottom sheet — the same markup, driven
 * by CSS media queries so we never cram a side panel onto a phone.
 *
 * Accessible: the panel is a focus-trapped `role="dialog"` (aria-modal), opened
 * from a button with `aria-expanded`/`aria-controls`. Esc and backdrop close it,
 * focus moves into the panel on open and returns to the trigger on close.
 */
@Component({
  selector: 'app-feed-panel',
  templateUrl: './feed-panel.component.html',
  styleUrls: ['./feed-panel.component.scss'],
})
export class FeedPanelComponent {
  open = false;

  @ViewChild('panel') panelRef?: ElementRef<HTMLElement>;

  private previouslyFocused: HTMLElement | null = null;

  toggle(): void {
    this.open ? this.close() : this.openPanel();
  }

  openPanel(): void {
    if (this.open) return;
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this.open = true;
    // Defer so the panel is painted before we move focus into it.
    queueMicrotask(() => this.focusFirst());
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.previouslyFocused?.focus?.();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.close();
  }

  /** Keep Tab focus inside the panel while it's open. */
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.open) return;
    const focusables = this.focusableElements();
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusFirst(): void {
    const focusables = this.focusableElements();
    (focusables[0] ?? this.panelRef?.nativeElement)?.focus?.();
  }

  private focusableElements(): HTMLElement[] {
    const root = this.panelRef?.nativeElement;
    if (!root) return [];
    const selector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
  }
}
