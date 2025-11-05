export const BASE_URL = 'https://www.joyn.de';
export const BASE_URL_API = 'https://api.joyn.de/graphql';
export const BASE_URL_AUTH = 'https://auth.joyn.de/auth/anonymous';
export const BASE_URL_IMG = 'https://img.joyn.de';

export const PLATFORM = 'Joyn';
export const PLATFORM_CLAIMTYPE = 3;

export const USER_AGENT = 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36';

// URL Patterns
export const REGEX_VIDEO_URL = /^https:\/\/(?:www\.)?joyn\.de\/(serien|filme)\/[a-zA-Z0-9-]+$/i;
export const REGEX_SERIES_URL = /^https:\/\/(?:www\.)?joyn\.de\/serien\/[a-zA-Z0-9-]+$/i;
export const REGEX_MOVIE_URL = /^https:\/\/(?:www\.)?joyn\.de\/filme\/[a-zA-Z0-9-]+$/i;
export const REGEX_CHANNEL_URL = /^https:\/\/(?:www\.)?joyn\.de\/play\/live-tv\/[a-zA-Z0-9-]+$/i;

export const SEARCH_CAPABILITIES = {
  types: [Type.Feed.Mixed],
  sorts: ['Most Recent', 'Most Viewed'],
  filters: []
};

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': USER_AGENT,
  'Origin': BASE_URL,
  'Referer': `${BASE_URL}/`
};
