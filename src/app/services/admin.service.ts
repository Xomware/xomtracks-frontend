import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AdminRequestsResponse, LinkRequest } from '../models/admin.model';

/**
 * The org-wide `{ data, error, meta }` envelope every xomtracks-backend
 * handler returns (utility_helpers.py::success_response).
 */
interface ApiEnvelope<T> {
  data: T;
  error: { message: string; status: number } | null;
  meta: Record<string, unknown>;
}

/**
 * The admin phone-link approval portal (`/admin/*`). Every route 403s
 * non-admins, so access is discovered rather than declared: `hasAccess()`
 * probes `GET /admin/requests` once and caches the boolean — the header uses
 * it to show/hide the "Admin" entry, and the portal falls back to a
 * "not authorized" state on a 403.
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly baseUrl = `${environment.apiBaseUrl}/admin`;

  /** Cached single-shot access probe (see hasAccess). */
  private access$?: Observable<boolean>;

  constructor(private http: HttpClient) {}

  /** GET /admin/requests — the pending link-request queue (admin-only). */
  requests(): Observable<LinkRequest[]> {
    return this.http
      .get<ApiEnvelope<AdminRequestsResponse>>(`${this.baseUrl}/requests`)
      .pipe(map((res) => res.data.requests ?? []));
  }

  /** POST /admin/approve — approve a pending request. */
  approve(requestId: string): Observable<void> {
    return this.http
      .post<ApiEnvelope<unknown>>(`${this.baseUrl}/approve`, { requestId })
      .pipe(map(() => undefined));
  }

  /** POST /admin/deny — deny a pending request. */
  deny(requestId: string): Observable<void> {
    return this.http
      .post<ApiEnvelope<unknown>>(`${this.baseUrl}/deny`, { requestId })
      .pipe(map(() => undefined));
  }

  /**
   * True when the caller is an admin. Probes `GET /admin/requests`; a 403 (or
   * any error) resolves `false`. Cached with `shareReplay` so the header's
   * gate and a later portal visit don't re-hit the endpoint.
   */
  hasAccess(): Observable<boolean> {
    if (!this.access$) {
      this.access$ = this.http
        .get<ApiEnvelope<AdminRequestsResponse>>(`${this.baseUrl}/requests`)
        .pipe(
          map(() => true),
          catchError(() => of(false)),
          shareReplay(1),
        );
    }
    return this.access$;
  }
}
