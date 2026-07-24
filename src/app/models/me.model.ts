/**
 * Types for the "link your number" / attribution feature, mirroring the
 * xomtracks-backend `/me/*` routes (lambdas/me_*). A signed-in group member
 * links their phone so they see + are attributed for their own shares.
 */

import { Share, TimeWindow } from './share.model';

/**
 * Where the caller sits in the admin-approval link flow:
 *   none    — no request yet; show the phone-entry form.
 *   pending — a request is in, awaiting an admin.
 *   linked  — approved; their shares are attributed to them.
 */
export type LinkStatus = 'none' | 'pending' | 'linked';

/** GET /me/get — the caller's link status + attributed share count. */
export interface MeInfo {
  email: string;
  /** The admin-approval link state — drives the Profile link section. */
  linkStatus: LinkStatus;
  /** Convenience mirror of `linkStatus === 'linked'`. */
  linked: boolean;
  linkedHandles: string[];
  /** How many shares are attributed to the caller (shown once linked). */
  shareCount: number;
  /**
   * Whether the caller has connected their Spotify account (Phase 2 OAuth).
   * OPTIONAL: `/me/get` does not expose this yet — until it does, the Profile
   * falls back to a client-side connected flag set after a successful callback.
   */
  spotifyConnected?: boolean;
}

/** POST /me/link-phone — acknowledgement of a link REQUEST (admin approves). */
export interface LinkRequestResult {
  /** Always 'pending' on a fresh request — approval happens in the portal. */
  status: 'pending';
  /** The created request's id (echoed by the admin portal). */
  requestId: string;
}

/** GET /me/shares — the caller's own shares (the "Mine" feed). */
export interface MySharesResponse {
  shares: Share[];
  linked: boolean;
  linkedHandles: string[];
  window: TimeWindow;
  count: number;
}
