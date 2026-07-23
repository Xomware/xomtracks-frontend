/**
 * Types for the admin phone-link approval portal, mirroring the
 * xomtracks-backend `/admin/*` routes. Every route 403s non-admins (the
 * portal probes `GET /admin/requests` and hides itself on 403).
 */

/** One pending link request awaiting an admin decision. */
export interface LinkRequest {
  requestId: string;
  /** The signed-in member who asked to link a number. */
  requesterEmail: string;
  /** The phone number they want attributed to them. */
  phone: string;
  /** The name the group has saved for that number, when known. */
  savedName?: string | null;
  /** When the request was created (ISO or epoch — display-only). */
  createdAt: string | number;
}

/** GET /admin/requests — the pending link-request queue. */
export interface AdminRequestsResponse {
  requests: LinkRequest[];
}
