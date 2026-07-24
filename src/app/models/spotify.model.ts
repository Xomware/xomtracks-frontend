/**
 * Types for the Phase 2 per-user Spotify OAuth flow, mirroring the
 * xomtracks-backend `/auth/spotify-*` routes:
 *   POST /auth/spotify-login    -> the Spotify authorize URL to redirect to
 *   POST /auth/spotify-callback -> exchange { code, state } to finish linking
 *
 * Both are gated by the native Cognito authorizer; the jwt.interceptor
 * attaches the caller's Cognito ID token automatically.
 */

/** POST /auth/spotify-login — where to send the browser to authorize. */
export interface SpotifyLoginData {
  /** Full Spotify `/authorize` URL, with client_id, scopes, state, etc. */
  authorizeUrl: string;
  /** CSRF token echoed back on the redirect — we stash + verify it. */
  state: string;
  /** The registered redirect URI Spotify will bounce back to (/callback). */
  redirectUri: string;
  /** Scopes the consent screen will request. */
  scopes: string[];
  /** ISO timestamp after which `state` is no longer valid. */
  expiresAt: string;
}

/** POST /auth/spotify-callback — server acknowledgement of a completed link. */
export interface SpotifyCallbackData {
  /** True once the account is connected (backend-defined; optional). */
  connected?: boolean;
  /** The linked Spotify display name / id, when the backend returns it. */
  spotifyUserId?: string;
}
