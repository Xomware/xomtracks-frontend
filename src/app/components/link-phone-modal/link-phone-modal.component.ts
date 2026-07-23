import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { MeService } from '../../services/me.service';
import { LinkPhoneUiService } from '../../services/link-phone-ui.service';
import { LinkPhoneResult, MeInfo } from '../../models/me.model';

type ModalState = 'loading' | 'form' | 'submitting' | 'success' | 'error';

/**
 * Lightweight "Link your number" flow for signed-in members. Enter a phone
 * number -> POST /me/link-phone -> show "Linked — found N of your shares" (or
 * "no shares found yet"). On open it loads GET /me so an already-linked member
 * sees their current handle(s).
 *
 * Verification is trust-based (the backend links on request); this UI never
 * asks for an OTP. Dialog is focus-trapped, Esc- and backdrop-closable, and
 * restores focus to the trigger on close — mirrors TrackDetailModalComponent.
 */
@Component({
  selector: 'app-link-phone-modal',
  templateUrl: './link-phone-modal.component.html',
  styleUrls: ['./link-phone-modal.component.scss'],
})
export class LinkPhoneModalComponent implements OnInit, AfterViewInit {
  @Output() closed = new EventEmitter<void>();

  @ViewChild('dialog') dialogRef!: ElementRef<HTMLElement>;

  state: ModalState = 'loading';
  phone = '';
  errorMessage = '';
  me: MeInfo | null = null;
  result: LinkPhoneResult | null = null;

  private previouslyFocused: HTMLElement | null = null;

  constructor(
    private meService: MeService,
    private linkUi: LinkPhoneUiService,
  ) {}

  ngOnInit(): void {
    this.loadMe();
  }

  ngAfterViewInit(): void {
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    queueMicrotask(() => this.focusFirst());
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.requestClose();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.requestClose();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
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

  requestClose(): void {
    this.previouslyFocused?.focus?.();
    this.closed.emit();
  }

  /** Whether the submit button should be enabled (needs digits). */
  get canSubmit(): boolean {
    return this.digitCount >= 10 && this.state !== 'submitting';
  }

  get digitCount(): number {
    return (this.phone.match(/\d/g) ?? []).length;
  }

  submit(): void {
    if (!this.canSubmit) return;
    this.state = 'submitting';
    this.errorMessage = '';
    this.meService.linkPhone(this.phone).subscribe({
      next: (res) => {
        this.result = res;
        this.state = 'success';
        this.linkUi.notifyLinked(res);
        queueMicrotask(() => this.focusFirst());
      },
      error: () => {
        this.state = 'error';
        this.errorMessage = 'Could not link that number. Please try again.';
      },
    });
  }

  /** From the error state, go back to the form to retry. */
  backToForm(): void {
    this.state = 'form';
    this.errorMessage = '';
    queueMicrotask(() => this.focusFirst());
  }

  get resultMessage(): string {
    if (!this.result) return '';
    const n = this.result.matchedShareCount;
    if (n === 0) return 'No shares found under this number yet — new ones will show up as you share.';
    return n === 1 ? 'Found 1 of your shares.' : `Found ${n} of your shares.`;
  }

  get alreadyLinkedLabel(): string {
    const handles = this.me?.linkedHandles ?? [];
    if (handles.length === 0) return '';
    const shown = handles.map((h) => this.formatHandle(h));
    return shown.join(', ');
  }

  /** Display a normalized 10-digit handle as (336) 404-2196. */
  formatHandle(handle: string): string {
    if (handle.length === 10) {
      return `(${handle.slice(0, 3)}) ${handle.slice(3, 6)}-${handle.slice(6)}`;
    }
    return handle;
  }

  private loadMe(): void {
    this.state = 'loading';
    this.meService.get().subscribe({
      next: (me) => {
        this.me = me;
        this.state = 'form';
        queueMicrotask(() => this.focusFirst());
      },
      error: () => {
        // Non-fatal: fall back to a blank form (they can still link).
        this.me = null;
        this.state = 'form';
        queueMicrotask(() => this.focusFirst());
      },
    });
  }

  private focusFirst(): void {
    const focusables = this.focusableElements();
    (focusables[0] ?? this.dialogRef?.nativeElement)?.focus?.();
  }

  private focusableElements(): HTMLElement[] {
    const root = this.dialogRef?.nativeElement;
    if (!root) return [];
    const selector =
      'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';
    return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
  }
}
