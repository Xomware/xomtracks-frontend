import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/**
 * The org-wide `{ data, error, meta }` envelope every xomtracks-backend
 * handler returns (utility_helpers.py::success_response).
 */
interface ApiEnvelope<T> {
  data: T;
  error: { message: string; status: number } | null;
  meta: Record<string, unknown>;
}

/** POST /heard/set echoes back the caller's new state for the track. */
export interface HeardState {
  trackKey: string;
  heard: boolean;
}

/**
 * The caller's per-track "heard" flag. Keyed on the shared `trackKey`
 * (utils/track-display.ts::trackKey) so every share of the same song rolls
 * into one state — the same key the ratings + ×N grouping use.
 *
 * Backs `POST /heard/set` with `{ trackKey, heard }`; the flag rides back on
 * each share as `share.heard` via `GET /shares/list`. Gated by the native
 * Cognito authorizer — the jwt.interceptor attaches the caller's ID token.
 */
@Injectable({ providedIn: 'root' })
export class HeardService {
  private readonly baseUrl = `${environment.apiBaseUrl}/heard`;

  constructor(private http: HttpClient) {}

  /** POST /heard/set — mark a track heard/unheard for the caller. */
  set(trackKey: string, heard: boolean): Observable<HeardState> {
    return this.http
      .post<ApiEnvelope<HeardState>>(`${this.baseUrl}/set`, { trackKey, heard })
      .pipe(map((res) => res.data));
  }
}
