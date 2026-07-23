import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LinkPhoneResult, MeInfo, MySharesResponse } from '../models/me.model';
import { TimeWindow } from '../models/share.model';

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
 * Calls the authed `/me/*` routes that back phone->account linking:
 *   GET  /me              -> link status + share count
 *   POST /me/link-phone   -> link a number (trust-based; returns matched count)
 *   GET  /me/shares       -> the caller's own shares (the "Mine" feed)
 *
 * All are gated by the native Cognito authorizer; the jwt.interceptor attaches
 * the caller's Cognito ID token automatically.
 */
@Injectable({ providedIn: 'root' })
export class MeService {
  private readonly baseUrl = `${environment.apiBaseUrl}/me`;

  constructor(private http: HttpClient) {}

  /** GET /me/get — the caller's linked handles + attributed share count.
   * (The api-gateway module supports only 2 path levels, so this is /me/get,
   * not /me — same reason the shares list is /shares/list.) */
  get(): Observable<MeInfo> {
    return this.http
      .get<ApiEnvelope<MeInfo>>(`${this.baseUrl}/get`)
      .pipe(map((res) => res.data));
  }

  /** POST /me/link-phone — link a phone number to the caller's identity. */
  linkPhone(phoneNumber: string): Observable<LinkPhoneResult> {
    return this.http
      .post<ApiEnvelope<LinkPhoneResult>>(`${this.baseUrl}/link-phone`, { phoneNumber })
      .pipe(map((res) => res.data));
  }

  /** GET /me/shares — the caller's own shares within a time window. */
  myShares(window: TimeWindow): Observable<MySharesResponse> {
    const params = new HttpParams().set('window', window);
    return this.http
      .get<ApiEnvelope<MySharesResponse>>(`${this.baseUrl}/shares`, { params })
      .pipe(map((res) => res.data));
  }
}
