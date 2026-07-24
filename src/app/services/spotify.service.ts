import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { SpotifyCallbackData, SpotifyLoginData } from '../models/spotify.model';

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
 * Drives the Phase 2 per-user Spotify OAuth handshake:
 *   POST /auth/spotify-login    -> get the authorize URL (then redirect away)
 *   POST /auth/spotify-callback -> exchange { code, state } after the bounce
 *
 * Both are Cognito-authed; the jwt.interceptor attaches the caller's ID token.
 *
 * The CSRF `state` is stashed in sessionStorage before we redirect so the
 * /callback route can sanity-check the value Spotify echoes back (the backend
 * validates it authoritatively too).
 */
@Injectable({ providedIn: 'root' })
export class SpotifyService {
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;

  /** sessionStorage key for the pre-redirect CSRF state. */
  private static readonly STATE_KEY = 'xt_spotify_state';
  /** localStorage key: a client-side "connected" flag set after a successful
   * callback, so the Profile reflects the connection even though `/me/get`
   * does not (yet) expose Spotify status. See report note. */
  static readonly CONNECTED_KEY = 'xt_spotify_connected';

  constructor(private http: HttpClient) {}

  /** POST /auth/spotify-login — the Spotify authorize URL to redirect to. */
  login(): Observable<SpotifyLoginData> {
    return this.http
      .post<ApiEnvelope<SpotifyLoginData>>(`${this.baseUrl}/spotify-login`, {})
      .pipe(map((res) => res.data));
  }

  /** POST /auth/spotify-callback — finish the connection with { code, state }. */
  callback(code: string, state: string): Observable<SpotifyCallbackData> {
    return this.http
      .post<ApiEnvelope<SpotifyCallbackData>>(`${this.baseUrl}/spotify-callback`, {
        code,
        state,
      })
      .pipe(map((res) => res.data));
  }

  /** Stash the CSRF state before redirecting to Spotify. */
  rememberState(state: string): void {
    try {
      sessionStorage.setItem(SpotifyService.STATE_KEY, state);
    } catch {
      /* storage unavailable — backend still validates state authoritatively */
    }
  }

  /** Read + clear the stashed CSRF state on return from Spotify. */
  consumeState(): string | null {
    try {
      const value = sessionStorage.getItem(SpotifyService.STATE_KEY);
      sessionStorage.removeItem(SpotifyService.STATE_KEY);
      return value;
    } catch {
      return null;
    }
  }

  /** Persist the local connected flag after a successful callback. */
  markConnected(): void {
    try {
      localStorage.setItem(SpotifyService.CONNECTED_KEY, 'true');
    } catch {
      /* storage unavailable — Profile falls back to "not connected" */
    }
  }

  /** Whether we've seen a successful connect on this device. */
  isConnectedLocally(): boolean {
    try {
      return localStorage.getItem(SpotifyService.CONNECTED_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
