export const BASE_URL = 'https://www.joyn.de';
export const BASE_URL_API = 'https://api.joyn.de/graphql';
export const BASE_URL_AUTH = 'https://auth.joyn.de/auth/anonymous';
export const BASE_URL_IMG = 'https://img.joyn.de';
export const BASE_URL_ALGOLIA = 'https://ffqrv35svv-dsn.algolia.net/1/indexes/*/queries';
export const ALGOLIA_APP_ID = 'FFQRV35SVV';

export const PLATFORM = 'Joyn';
export const PLATFORM_CLAIMTYPE = 3;

// Use desktop Chrome User-Agent to match browser behavior and avoid fingerprinting detection
export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// URL Patterns
export const REGEX_EPISODE_URL = /^https:\/\/(?:www\.)?joyn\.de\/serien\/[a-zA-Z0-9-]+\/[0-9]+-[0-9]+-[a-zA-Z0-9-]+$/i;
export const REGEX_MOVIE_URL = /^https:\/\/(?:www\.)?joyn\.de\/filme\/[a-zA-Z0-9-]+$/i;
export const REGEX_SERIES_URL = /^https:\/\/(?:www\.)?joyn\.de\/serien\/[a-zA-Z0-9-]+$/i;
export const REGEX_LIVE_TV_URL = /^https:\/\/(?:www\.)?joyn\.de\/play\/live-tv(\?channel_id=[0-9]+)?$/i;
export const REGEX_CHANNEL_URL = /^https:\/\/(?:www\.)?joyn\.de\/mediatheken\/[a-zA-Z0-9-]+$/i;

export const SEARCH_CAPABILITIES = {
  types: [Type.Feed.Mixed],
  sorts: ['Most Recent', 'Most Viewed'],
  filters: []
};

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': USER_AGENT,
  'Origin': BASE_URL,
  'Referer': `${BASE_URL}/`,
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};
