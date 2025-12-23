import { DEFAULT_HEADERS, BASE_URL } from './constants';

export function applyCommonHeaders(): Record<string, string> {
  return { ...DEFAULT_HEADERS };
}

export function log(message: string) {
  const logMessage = `[Joyn] ${message}`;
  console.log(logMessage);
  // Use bridge.log if available to ensure logs are captured by OnLog event
  if (typeof bridge !== 'undefined' && bridge.log) {
    bridge.log(logMessage);
  }
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getAssetIdFromUrl(url: string): string | null {
  // Extract last segment from URL (may contain the asset ID)
  // Joyn URLs can be:
  // - /serien/navy-cis-la (series slug)
  // - /serien/navy-cis-la/14-1-game-of-drones-bpidjn4j8opy (episode with ID at end)
  // - /filme/transformers-aufstieg-der-bestien (movie slug)
  // - /video/a187b70f0353fe8ac21634308404195e (direct video ID)
  
  // Handle /video/ URLs - extract the video ID directly
  const videoMatch = url.match(/\/video\/([a-zA-Z0-9_-]+)/i);
  if (videoMatch) {
    return videoMatch[1];
  }
  
  const parts = url.split('?')[0].split('/');
  const lastSegment = parts[parts.length - 1];
  
  // Check if last segment contains an asset ID (starts with b_, d_, c_, a_)
  const assetMatch = lastSegment.match(/([abdc]_[a-z0-9]+)$/i);
  if (assetMatch) {
    return assetMatch[1];
  }
  
  // Otherwise return the slug
  return lastSegment || null;
}

export function getSeriesSlugFromUrl(url: string): string | null {
  // Extract series slug from URLs like /serien/navy-cis-la or /serien/navy-cis-la/14-1-...
  const match = url.match(/\/serien\/([^\/\?]+)/);
  return match ? match[1] : null;
}

export function buildImageUrl(path: string | undefined | null, profile: string): string {
  if (!path) return '';
  // Handle case where path might be an object (extract string value)
  let pathStr: string;
  if (typeof path === 'string') {
    pathStr = path;
  } else if (path && typeof path === 'object' && 'toString' in path) {
    pathStr = String(path);
  } else {
    pathStr = String(path || '');
  }
  if (!pathStr) return '';
  if (pathStr.startsWith('http')) return pathStr;
  return `https://img.joyn.de/${pathStr}/profile:${profile}.webp`;
}

export function parseISO8601Duration(duration: string): number {
  if (!duration) return 0;
  
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  return hours * 3600 + minutes * 60 + seconds;
}
