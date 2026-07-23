/**
 * Types for the "link your number" / attribution feature, mirroring the
 * xomtracks-backend `/me/*` routes (lambdas/me_*). A signed-in group member
 * links their phone so they see + are attributed for their own shares.
 */

import { Share, TimeWindow } from './share.model';

/** GET /me — the caller's link status. */
export interface MeInfo {
  email: string;
  linked: boolean;
  linkedHandles: string[];
  shareCount: number;
}

/** POST /me/link-phone — result of a link attempt (trust-based). */
export interface LinkPhoneResult {
  /** The normalized last-10-digit handle that was linked. */
  handle: string;
  linkedHandles: string[];
  /** How many existing shares already carry this handle. */
  matchedShareCount: number;
  /** True when matchedShareCount === 0 (linked, but nothing found yet). */
  flagged: boolean;
}

/** GET /me/shares — the caller's own shares (the "Mine" feed). */
export interface MySharesResponse {
  shares: Share[];
  linked: boolean;
  linkedHandles: string[];
  window: TimeWindow;
  count: number;
}
