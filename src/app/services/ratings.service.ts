import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Rating } from '../models/share.model';

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
 * Whole-group ratings. Any signed-in caller can rate a track; the rating is
 * keyed on the shared `trackKey` (utils/track-display.ts::trackKey) so every
 * share of the same song rolls into one aggregate.
 *
 * Backs `POST /ratings/set` with `{ trackKey, rating }`; the enriched aggregate
 * (`avg`, `count`, `myRating`) rides back on each share via `GET /shares/list`.
 * The route is gated by the native Cognito authorizer — the jwt.interceptor
 * attaches the caller's ID token automatically.
 */
@Injectable({ providedIn: 'root' })
export class RatingsService {
  private readonly baseUrl = `${environment.apiBaseUrl}/ratings`;

  constructor(private http: HttpClient) {}

  /** POST /ratings/set — set the caller's rating (1..5) for a track group.
   * Returns the updated whole-group aggregate for that track. */
  set(trackKey: string, rating: number): Observable<Rating> {
    return this.http
      .post<ApiEnvelope<Rating>>(`${this.baseUrl}/set`, { trackKey, rating })
      .pipe(map((res) => res.data));
  }
}
