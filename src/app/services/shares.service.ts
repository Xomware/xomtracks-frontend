import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Direction, SharesListResponse, TimeWindow } from '../models/share.model';

/**
 * Every xomtracks-backend response is wrapped in the org-wide
 * `{ data, error, meta }` envelope (lambdas/common/utility_helpers.py::
 * success_response) -- `data` holds the actual payload.
 */
interface ApiEnvelope<T> {
  data: T;
  error: { message: string; status: number } | null;
  meta: Record<string, unknown>;
}

/**
 * Reads the cross-conversation share feed. Maps to xomtracks-backend's
 * `shares_list` handler (`GET /shares/list?direction=&window=`), an authed
 * route gated by the native Cognito authorizer.
 */
@Injectable({ providedIn: 'root' })
export class SharesService {
  private readonly baseUrl = `${environment.apiBaseUrl}/shares`;

  constructor(private http: HttpClient) {}

  /** GET /shares/list -- authed. Returns the shares for one direction within
   * a time window, newest-first (the backend sorts). */
  list(direction: Direction, window: TimeWindow): Observable<SharesListResponse> {
    const params = new HttpParams().set('direction', direction).set('window', window);
    return this.http
      .get<ApiEnvelope<SharesListResponse>>(`${this.baseUrl}/list`, { params })
      .pipe(map((res) => res.data));
  }
}
