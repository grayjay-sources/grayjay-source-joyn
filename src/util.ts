import { DEFAULT_HEADERS } from './constants';

export function applyCommonHeaders(): Record<string, string> {
  return { ...DEFAULT_HEADERS };
}

export function log(message: string) {
  console.log(`[Joyn] ${message}`);
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getAssetIdFromUrl(url: string): string | null {
  const match = url.match(/\/([a-z0-9_-]+)$/i);
  return match ? match[1] : null;
}

export function buildImageUrl(path: string, profile: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `https://img.joyn.de/${path}/profile:${profile}.webp`;
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
