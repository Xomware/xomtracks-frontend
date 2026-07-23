/**
 * Mirrors the xomtracks-backend `Share` record returned by
 * `GET /shares/list` (lambdas/common/models.py::Share). Only the fields the
 * browse feed reads are typed here; the API may return more.
 */

export type Direction = 'in' | 'out';
export type TimeWindow = 'week' | 'month' | '6mo' | 'all';
export type Platform = 'spotify' | 'soundcloud' | 'apple';
export type MatchStatus = 'pending' | 'matched' | 'unmatched' | 'manual';

/**
 * Whole-group rating aggregate + the caller's own rating for a track.
 * Enriched onto each share by `GET /shares/list` (backend extension in
 * flight). Absent when the backend hasn't shipped it yet — the UI degrades
 * to an empty, settable control in that case (see RatingStarsComponent).
 */
export interface Rating {
  /** Mean of all ratings for the track group. 0 when no ratings yet. */
  avg: number;
  /** How many ratings the group has. 0 when unrated. */
  count: number;
  /** The caller's own rating (1..5). 0 when the caller hasn't rated. */
  myRating: number;
}

export interface Share {
  shareId: string;
  messageGuid: string;
  direction: Direction;
  platform: Platform;
  sourceUrl: string;
  messageDate: number; // unix epoch seconds

  sharerHandle?: string | null;
  sharerName?: string | null;
  chatId?: string | null;

  trackTitle?: string | null;
  trackArtist?: string | null;
  albumName?: string | null;
  albumArtUrl?: string | null;

  resolvedSpotifyId?: string | null;
  resolvedSpotifyUri?: string | null;
  matchStatus: MatchStatus;
  matchConfidence?: number | null;
  createdAt: string;

  /** Artist genres, once the backend genre-fetch has populated them (e.g.
   * `['tech house', 'house']`). The genre filter flattens these across the
   * feed; while every share's list is empty the control stays hidden. */
  genres?: string[] | null;

  /** Whole-group rating aggregate + the caller's own rating. Optional until
   * the backend enriches `/shares/list`; the UI degrades gracefully. */
  rating?: Rating | null;
}

export interface SharesListResponse {
  shares: Share[];
  direction: Direction;
  window: TimeWindow;
  count: number;
}

export const TIME_WINDOWS: ReadonlyArray<{ value: TimeWindow; label: string }> = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: '6mo', label: '6 months' },
  { value: 'all', label: 'All time' },
];

export const DIRECTIONS: ReadonlyArray<{ value: Direction; label: string }> = [
  { value: 'in', label: 'Shared with me' },
  { value: 'out', label: 'Shared by me' },
];
