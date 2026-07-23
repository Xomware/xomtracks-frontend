import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AdminService } from '../../services/admin.service';
import { LinkRequest } from '../../models/admin.model';

/** loading → the initial fetch; forbidden → a 403 (caller isn't an admin). */
type LoadState = 'loading' | 'loaded' | 'error' | 'forbidden';

/**
 * The admin phone-link approval portal (`/admin`, authed).
 *
 * Lists the pending link requests from `GET /admin/requests` and lets an admin
 * approve or deny each (optimistic — the row leaves the list immediately, and
 * is restored if the call fails). The backend 403s non-admins, so a 403 on the
 * initial load flips the whole page to a "not authorized" notice rather than
 * exposing anything; the header only surfaces the entry to admins in the first
 * place (AdminService.hasAccess()).
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss'],
})
export class AdminComponent implements OnInit, OnDestroy {
  state: LoadState = 'loading';
  requests: LinkRequest[] = [];

  /** Request ids with an approve/deny call in flight (disables their buttons). */
  pendingIds = new Set<string>();

  /** Non-empty when an approve/deny failed — a dismissible inline notice. */
  actionError = '';

  private sub?: Subscription;

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  load(): void {
    this.state = 'loading';
    this.actionError = '';
    this.sub?.unsubscribe();
    this.sub = this.adminService.requests().subscribe({
      next: (requests) => {
        this.requests = requests;
        this.state = 'loaded';
      },
      error: (err: HttpErrorResponse) => {
        this.state = err?.status === 403 ? 'forbidden' : 'error';
      },
    });
  }

  retry(): void {
    this.load();
  }

  isPending(req: LinkRequest): boolean {
    return this.pendingIds.has(req.requestId);
  }

  approve(req: LinkRequest): void {
    this.act(req, 'approve');
  }

  deny(req: LinkRequest): void {
    this.act(req, 'deny');
  }

  trackByRequest(_index: number, req: LinkRequest): string {
    return req.requestId;
  }

  /** Display name for a request — the saved name, else the requester's email. */
  displayName(req: LinkRequest): string {
    return req.savedName?.trim() || req.requesterEmail || 'Unknown member';
  }

  createdLabel(req: LinkRequest): string {
    const raw = req.createdAt;
    const ms = typeof raw === 'number' ? raw * 1000 : Date.parse(String(raw));
    if (!ms || Number.isNaN(ms)) return '';
    return new Date(ms).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // ── Internals ────────────────────────────────────────────────────
  /** Optimistically drop the row, then approve/deny; restore it on failure. */
  private act(req: LinkRequest, kind: 'approve' | 'deny'): void {
    if (this.isPending(req)) return;
    this.actionError = '';

    const index = this.requests.findIndex((r) => r.requestId === req.requestId);
    const removed = index >= 0 ? this.requests[index] : req;
    if (index >= 0) this.requests = this.requests.filter((r) => r.requestId !== req.requestId);
    this.pendingIds.add(req.requestId);

    const call =
      kind === 'approve'
        ? this.adminService.approve(req.requestId)
        : this.adminService.deny(req.requestId);

    call.subscribe({
      next: () => {
        this.pendingIds.delete(req.requestId);
      },
      error: () => {
        this.pendingIds.delete(req.requestId);
        // Restore the row at its original position so the queue is unchanged.
        if (index >= 0) {
          const next = [...this.requests];
          next.splice(Math.min(index, next.length), 0, removed);
          this.requests = next;
        }
        this.actionError = `Couldn't ${kind} that request. Please try again.`;
      },
    });
  }
}
