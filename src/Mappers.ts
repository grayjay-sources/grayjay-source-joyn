import { PLATFORM, BASE_URL, BASE_URL_IMG } from './constants';
import { buildImageUrl, parseISO8601Duration } from './util';

export interface JoynAsset {
  id?: string;
  title?: string;
  description?: string;
  duration?: number;
  images?: {
    heroLandscape?: string;
    heroPortrait?: string;
    artLogo?: string;
  };
  brand?: {
    name?: string;
    logo?: string;
  };
  path?: string;
  contentType?: string;
  publicationDate?: string;
  availableUntil?: string;
}

export interface JoynBrand {
  id?: string;
  name?: string;
  logo?: string;
}

export const JoynAssetToGrayjayVideo = (
  pluginId: string,
  asset: JoynAsset,
): PlatformVideo => {
  const videoId = asset.id || '';
  const title = asset.title || 'Untitled';
  const duration = asset.duration || 0;
  
  // Build thumbnail from heroLandscape or heroPortrait
  const thumbnail = asset.images?.heroLandscape 
    ? buildImageUrl(asset.images.heroLandscape, 'nextgen-web-livestill-503x283')
    : asset.images?.heroPortrait
    ? buildImageUrl(asset.images.heroPortrait, 'nextgen-web-heroportrait-243x365')
    : '';
  
  // Build video URL
  const url = asset.path 
    ? `${BASE_URL}${asset.path}`
    : `${BASE_URL}/video/${videoId}`;
  
  // Create author link from brand
  const author = asset.brand 
    ? new PlatformAuthorLink(
        new PlatformID(PLATFORM, asset.brand.name || '', pluginId, 3),
        asset.brand.name || '',
        `${BASE_URL}/mediatheken/${asset.brand.name}`,
        asset.brand.logo ? buildImageUrl(asset.brand.logo, 'nextgen-web-brand-150x') : '',
        0
      )
    : new PlatformAuthorLink(
        new PlatformID(PLATFORM, 'joyn', pluginId, 3),
        'Joyn',
        BASE_URL,
        '',
        0
      );
  
  // Parse date
  const uploadDate = asset.publicationDate 
    ? Math.floor(new Date(asset.publicationDate).getTime() / 1000)
    : 0;
  
  const video: PlatformVideoDef = {
    id: new PlatformID(PLATFORM, videoId, pluginId, 3),
    name: title,
    thumbnails: new Thumbnails([new Thumbnail(thumbnail, 0)]),
    author,
    uploadDate,
    duration,
    viewCount: 0,
    url,
    isLive: false,
  };
  
  return new PlatformVideo(video);
};

export const JoynBrandToGrayjayChannel = (
  pluginId: string,
  brand: JoynBrand,
  url?: string,
): PlatformChannel => {
  const channelId = brand.id || brand.name || '';
  const channelName = brand.name || 'Unknown';
  const thumbnail = brand.logo 
    ? buildImageUrl(brand.logo, 'nextgen-web-brand-150x')
    : '';
  
  const channelUrl = url || `${BASE_URL}/mediatheken/${brand.name}`;
  
  return new PlatformChannel({
    id: new PlatformID(PLATFORM, channelId, pluginId, 3),
    name: channelName,
    thumbnail,
    banner: '',
    subscribers: 0,
    description: '',
    url: channelUrl,
    urlAlternatives: [channelUrl],
    links: {},
  });
};

export const JoynLiveChannelToGrayjayChannel = (
  pluginId: string,
  liveChannel: any,
): PlatformChannel => {
  const channelId = liveChannel.id || '';
  const channelName = liveChannel.name || 'Unknown Channel';
  const thumbnail = liveChannel.images?.logo
    ? buildImageUrl(liveChannel.images.logo, 'nextgen-web-brand-150x')
    : '';
  
  const channelUrl = `${BASE_URL}/play/live-tv/${liveChannel.path || channelId}`;
  
  return new PlatformChannel({
    id: new PlatformID(PLATFORM, channelId, pluginId, 3),
    name: channelName,
    thumbnail,
    banner: '',
    subscribers: 0,
    description: liveChannel.description || '',
    url: channelUrl,
    urlAlternatives: [channelUrl],
    links: {},
  });
};
