/**
 * The two live, rolling Spotify playlists Xomtracks keeps in sync. These IDs
 * are stable and long-lived, so they're safe to ship as a frontend constant.
 *
 * NOTE: if the backend ever rotates these (e.g. a `GET /playlists` endpoint
 * that returns the current ids per user), swap this constant for that call —
 * the component only depends on the `RollingPlaylist` shape below.
 */
export interface RollingPlaylist {
  /** Spotify playlist id (the path segment after /playlist/). */
  id: string;
  /** Heading shown above the embed. */
  title: string;
  /** One-line description of what the playlist rolls up. */
  blurb: string;
}

export const ROLLING_PLAYLISTS: ReadonlyArray<RollingPlaylist> = [
  {
    id: '1EovEoa2MJO7tX4qPEvnsr',
    title: 'Shared With Me — Last Month',
    blurb: 'Everything sent your way over the past month.',
  },
  {
    id: '12rO1QHPLvJ4L3Gehi7PPX',
    title: 'Shared By Me — Last Month',
    blurb: 'Everything you shared out over the past month.',
  },
];

/** Spotify iframe embed URL for a playlist id. */
export function spotifyEmbedUrl(id: string): string {
  return `https://open.spotify.com/embed/playlist/${id}`;
}

/** Public "open in Spotify" URL for a playlist id. */
export function spotifyPlaylistUrl(id: string): string {
  return `https://open.spotify.com/playlist/${id}`;
}
