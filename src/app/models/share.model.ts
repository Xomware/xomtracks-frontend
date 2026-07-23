/**
 * Mirrors the xomtracks-backend `Share` record returned by
 * `GET /shares/list` (lambdas/common/models.py::Share). Only the fields the
 * browse feed reads are typed here; the API may return more.
 */

export type Direction = 'in' | 'out';
export type TimeWindow = 'week' | 'month' | '6mo' | 'all';
export type Platform = 'spotify' | 'soundcloud' | 'apple';
export type MatchStatus = 'pending' | 'matched' | 'unmatched' | 'manual';

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
