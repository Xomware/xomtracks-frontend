import { Platform, Share } from '../models/share.model';

const PLATFORM_LABELS: Record<Platform, string> = {
  spotify: 'Spotify',
  soundcloud: 'SoundCloud',
  apple: 'Apple Music',
};

export function platformLabel(platform: Platform): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

/** A share is "matched" (has a usable Spotify id) when matched or manually set. */
export function isMatched(share: Share): boolean {
  return (
    !!share.resolvedSpotifyId &&
    (share.matchStatus === 'matched' || share.matchStatus === 'manual')
  );
}

/**
 * Human title falling back to a slug parsed from the source URL when metadata
 * hasn't resolved yet (common for fresh SoundCloud shares). Last resort is a
 * generic label so the row is never blank.
 */
export function displayTitle(share: Share): string {
  const explicit = share.trackTitle?.trim();
  if (explicit) return explicit;
  const slug = slugFromUrl(share.sourceUrl);
  return slug || 'Untitled track';
}

/** Best outbound URL: the Spotify track when matched, else the original share. */
export function primaryUrl(share: Share): string {
  if (isMatched(share)) return `https://open.spotify.com/track/${share.resolvedSpotifyId}`;
  return share.sourceUrl;
}

/** Label for the outbound action, platform-aware for unmatched shares. */
export function openLabel(share: Share): string {
  if (isMatched(share)) return 'Play on Spotify';
  switch (share.platform) {
    case 'soundcloud':
      return 'Open on SoundCloud';
    case 'apple':
      return 'Open in Apple Music';
    case 'spotify':
      return 'Open on Spotify';
    default:
      return 'Open original';
  }
}

/** Turn the last path segment of a URL into a Title Cased label. */
function slugFromUrl(url?: string | null): string {
  if (!url) return '';
  try {
    const path = new URL(url).pathname;
    const last = path.split('/').filter(Boolean).pop() ?? '';
    const cleaned = decodeURIComponent(last)
      .replace(/\.\w+$/, '')
      .replace(/[-_]+/g, ' ')
      .trim();
    if (!cleaned) return '';
    return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return '';
  }
}
