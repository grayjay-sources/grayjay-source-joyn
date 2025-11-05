let config: Config;

const state = {
  authToken: '',
  authTokenExpiration: 0,
  userId: '',
  algoliaApiKey: '',
  algoliaApiKeyExpiration: 0
};

import {
  BASE_URL,
  BASE_URL_API,
  BASE_URL_AUTH,
  BASE_URL_ALGOLIA,
  ALGOLIA_APP_ID,
  SEARCH_CAPABILITIES,
  PLATFORM,
  REGEX_EPISODE_URL,
  REGEX_SERIES_URL,
  REGEX_MOVIE_URL,
  REGEX_LIVE_TV_URL,
  REGEX_CHANNEL_URL
} from './constants';

import {
  LANDING_PAGE_QUERY,
  LIVE_LANE_QUERY,
  NAVIGATION_QUERY,
  GET_ME_STATE_QUERY,
  HERO_LANE_QUERY,
  RESUME_LANE_QUERY,
  WATCH_NEXT_QUERY,
  SEASON_QUERY,
  MORE_LIKE_THIS_QUERY,
  RESUME_POSITIONS_QUERY,
  ALGOLIA_API_KEY_QUERY,
  LIVE_CHANNELS_AND_EPG_QUERY,
  LIVESTREAM_OVERVIEW_BY_BRAND_QUERY,
  LIVESTREAM_QUERY,
  PAGE_LIVE_PLAYER_QUERY
} from './gqlQueries';

import {
  applyCommonHeaders,
  log,
  generateUUID,
  getAssetIdFromUrl,
  getSeriesSlugFromUrl
} from './util';

import {
  JoynAssetToGrayjayVideo,
  JoynBrandToGrayjayChannel,
  JoynLiveChannelToGrayjayChannel
} from './Mappers';

import {
  JoynVideoPager,
  JoynChannelPager,
  JoynSearchPager
} from './Pagers';

//Source Methods
source.enable = function (conf, settings, saveStateStr) {
  config = conf ?? {};
  log('Plugin enabled');
  
  // Load saved state if available
  if (saveStateStr) {
    try {
      const savedState = JSON.parse(saveStateStr);
      state.authToken = savedState.authToken || '';
      state.authTokenExpiration = savedState.authTokenExpiration || 0;
      state.userId = savedState.userId || '';
      state.algoliaApiKey = savedState.algoliaApiKey || '';
      state.algoliaApiKeyExpiration = savedState.algoliaApiKeyExpiration || 0;
    } catch (e) {
      log('Failed to parse saved state: ' + e);
    }
  }
  
  // Get anonymous token if needed
  if (!isTokenValid()) {
    refreshAnonymousToken();
  }
};

source.disable = function () {
  log('Plugin disabled');
};

source.saveState = function () {
  return JSON.stringify({
    authToken: state.authToken,
    authTokenExpiration: state.authTokenExpiration,
    userId: state.userId,
    algoliaApiKey: state.algoliaApiKey,
    algoliaApiKeyExpiration: state.algoliaApiKeyExpiration
  });
};

source.getHome = function (continuationToken) {
  log('getHome called');
  
  try {
    const variables = {
      path: '/neu-beliebt',
      variation: 'Default'
    };
    
    const [error, data] = executeGqlQuery({
      ...LANDING_PAGE_QUERY,
      variables
    });
    
    if (error) {
      throw new ScriptException('Failed to get home: ' + error.status);
    }
    
    // Parse the landing page data
    const videos: PlatformVideo[] = [];
    
    if (data && data.page && data.page.blocks) {
      for (const block of data.page.blocks) {
        if (block.assets && Array.isArray(block.assets)) {
          for (const asset of block.assets) {
            try {
              const video = JoynAssetToGrayjayVideo(config.id, asset);
              videos.push(video);
            } catch (e) {
              log('Failed to map asset: ' + e);
            }
          }
        }
        
        // Also check for nested lanes
        if (block.lanes && Array.isArray(block.lanes)) {
          for (const lane of block.lanes) {
            if (lane.assets && Array.isArray(lane.assets)) {
              for (const asset of lane.assets) {
                try {
                  const video = JoynAssetToGrayjayVideo(config.id, asset);
                  videos.push(video);
                } catch (e) {
                  log('Failed to map lane asset: ' + e);
                }
              }
            }
          }
        }
      }
    }
    
    log(`Mapped ${videos.length} videos from home`);
    
    // For now, no pagination
    return new VideoPager(videos, false, {});
  } catch (e) {
    log('Error in getHome: ' + e);
    throw e;
  }
};

source.searchSuggestions = function (query) {
  // Joyn doesn't have a public search suggestions API
  return [];
};

source.getSearchCapabilities = function () {
  return SEARCH_CAPABILITIES;
};

source.search = function (query, type, order, filters, continuationToken) {
  log('search called: ' + query);
  
  try {
    // Get Algolia API key if needed
    if (!isAlgoliaKeyValid()) {
      refreshAlgoliaApiKey();
    }
    
    const page = continuationToken?.page || 0;
    const hitsPerPage = 20;
    
    // Build Algolia search request
    const algoliaRequest = {
      requests: [
        {
          indexName: 'joyn_prod',
          params: `query=${encodeURIComponent(query)}&hitsPerPage=${hitsPerPage}&page=${page}`
        }
      ]
    };
    
    const headers = {
      'x-algolia-application-id': ALGOLIA_APP_ID,
      'x-algolia-api-key': state.algoliaApiKey,
      'Content-Type': 'application/json'
    };
    
    const resp = http.POST(
      BASE_URL_ALGOLIA,
      JSON.stringify(algoliaRequest),
      headers,
      false
    );
    
    if (!resp.isOk) {
      throw new ScriptException('Search failed: ' + resp.code);
    }
    
    const data = JSON.parse(resp.body);
    const hits = data.results?.[0]?.hits || [];
    const nbPages = data.results?.[0]?.nbPages || 0;
    
    log(`Found ${hits.length} results (page ${page + 1} of ${nbPages})`);
    
    // Map hits to videos
    const videos: PlatformVideo[] = hits.map((hit: any) => {
      return JoynAssetToGrayjayVideo(config.id, {
        id: hit.objectID || hit.id,
        title: hit.title || hit.name,
        description: hit.description,
        path: hit.fullPath || hit.path,
        contentType: hit.contentType,
        images: {
          heroPortrait: hit.images?.heroPortrait,
          heroLandscape: hit.images?.heroLandscape,
          artLogo: hit.images?.artLogo
        },
        brand: hit.brand ? {
          id: hit.brand.id,
          name: hit.brand.name,
          logo: hit.brand.logo
        } : undefined
      });
    }).filter((v: PlatformVideo) => v !== null);
    
    const hasMore = (page + 1) < nbPages;
    const context = { query, page, type, order, filters };
    
    return new JoynSearchPager(videos, hasMore, context, page, searchCallback);
  } catch (e) {
    log('Error in search: ' + e);
    throw e;
  }
};

function searchCallback(opts: any) {
  return source.search(opts.query, opts.type, opts.order, opts.filters, { page: opts.page });
}

source.isChannelUrl = function (url) {
  // Channels are brand/mediathek pages and live TV channels
  return REGEX_CHANNEL_URL.test(url) || REGEX_LIVE_TV_URL.test(url);
};

source.isContentDetailsUrl = function (url) {
  // Content details are episodes and movies (NOT series, which are playlists)
  return REGEX_EPISODE_URL.test(url) || REGEX_MOVIE_URL.test(url);
};

source.isPlaylistUrl = function (url) {
  // Series and seasons are playlists
  return REGEX_SERIES_URL.test(url);
};

source.getChannel = function (url) {
  log('getChannel called: ' + url);
  
  try {
    // Handle live TV channels
    if (REGEX_LIVE_TV_URL.test(url)) {
      return getLiveTVChannel(url);
    }
    
    // Handle brand/mediathek channels
    if (REGEX_CHANNEL_URL.test(url)) {
      return getBrandChannel(url);
    }
    
    throw new ScriptException('Unknown channel URL format: ' + url);
  } catch (e) {
    log('Error in getChannel: ' + e);
    throw e;
  }
};

source.getChannelContents = function (url, type, order, filters) {
  log('getChannelContents called: ' + url);
  
  try {
    // For live TV channels, return the current live stream as content
    if (REGEX_LIVE_TV_URL.test(url)) {
      return getLiveTVChannelContents(url);
    }
    
    // For brand/mediathek channels, return their videos
    if (REGEX_CHANNEL_URL.test(url)) {
      return getBrandChannelContents(url, type, order, filters);
    }
    
    throw new ScriptException('Unknown channel URL format: ' + url);
  } catch (e) {
    log('Error in getChannelContents: ' + e);
    throw e;
  }
};

source.getContentDetails = function (url) {
  log('getContentDetails called: ' + url);
  
  try {
    // Extract asset ID from URL
    const assetId = getAssetIdFromUrl(url);
    if (!assetId) {
      throw new ScriptException('Could not extract asset ID from URL: ' + url);
    }
    
    log('Asset ID: ' + assetId);
    
    // For episodes, get episode details
    if (REGEX_EPISODE_URL.test(url)) {
      return getEpisodeDetails(url, assetId);
    } else if (REGEX_MOVIE_URL.test(url)) {
      return getMovieDetails(url, assetId);
    } else {
      throw new ScriptException('Unknown content type for URL: ' + url);
    }
  } catch (e) {
    log('Error in getContentDetails: ' + e);
    throw e;
  }
};

source.getPlaylist = function (url) {
  log('getPlaylist called: ' + url);
  
  try {
    // Series are playlists containing seasons and episodes
    if (REGEX_SERIES_URL.test(url)) {
      return getSeriesPlaylist(url);
    }
    
    throw new ScriptException('Unknown playlist URL format: ' + url);
  } catch (e) {
    log('Error in getPlaylist: ' + e);
    throw e;
  }
};

source.getChannelCapabilities = function () {
  return {
    types: [Type.Feed.Mixed],
    sorts: [Type.Order.Chronological],
    filters: []
  };
};

// Helper Functions

function isTokenValid(): boolean {
  const currentTime = Date.now();
  return state.authToken && state.authTokenExpiration > currentTime;
}

function isAlgoliaKeyValid(): boolean {
  const currentTime = Date.now();
  return state.algoliaApiKey && state.algoliaApiKeyExpiration > currentTime;
}

function refreshAnonymousToken() {
  try {
    const resp = http.POST(
      BASE_URL_AUTH,
      JSON.stringify({}),
      applyCommonHeaders(),
      false
    );
    
    if (!resp.isOk) {
      throw new ScriptException('Failed to get anonymous token: ' + resp.code);
    }
    
    const data = JSON.parse(resp.body);
    state.authToken = data.accessToken || '';
    state.userId = data.userId || '';
    
    // Token expires in 24 hours
    state.authTokenExpiration = Date.now() + (24 * 60 * 60 * 1000);
    
    log('Anonymous token refreshed');
  } catch (e) {
    log('Error refreshing token: ' + e);
  }
}

function refreshAlgoliaApiKey() {
  try {
    const [error, data] = executeGqlQuery({
      ...ALGOLIA_API_KEY_QUERY,
      variables: {}
    });
    
    if (error) {
      throw new ScriptException('Failed to get Algolia API key: ' + error.status);
    }
    
    if (data && data.algoliaApiKey) {
      state.algoliaApiKey = data.algoliaApiKey.key || '';
      // Parse the validUntil timestamp from the key (it's base64 encoded in the key string)
      // For now, assume it expires in 24 hours
      state.algoliaApiKeyExpiration = Date.now() + (24 * 60 * 60 * 1000);
      log('Algolia API key refreshed');
    } else {
      throw new ScriptException('No Algolia API key in response');
    }
  } catch (e) {
    log('Error refreshing Algolia key: ' + e);
  }
}

function executeGqlQuery(requestOptions: {
  operationName: string;
  persistedQuery: { version: number; sha256Hash: string };
  variables?: any;
}) {
  const headers = applyCommonHeaders();
  
  if (state.authToken) {
    headers['Authorization'] = `Bearer ${state.authToken}`;
  }
  
  // Build query params
  const params = new URLSearchParams();
  params.set('operationName', requestOptions.operationName);
  params.set('enable_user_location', 'true');
  params.set('watch_assistant_variant', 'true');
  
  if (requestOptions.variables) {
    params.set('variables', JSON.stringify(requestOptions.variables));
  }
  
  params.set('extensions', JSON.stringify({
    persistedQuery: requestOptions.persistedQuery
  }));
  
  const url = `${BASE_URL_API}?${params.toString()}`;
  
  try {
    const res = http.GET(url, headers, false);
    
    if (!res.isOk) {
      return [{
        code: res.code,
        status: `HTTP ${res.code}`,
        operationName: requestOptions.operationName,
        body: res.body
      }, null];
    }
    
    let body;
    try {
      body = JSON.parse(res.body);
    } catch (parseError) {
      return [{
        code: 'PARSE_ERROR',
        status: 'Failed to parse response',
        operationName: requestOptions.operationName,
        error: String(parseError)
      }, null];
    }
    
    if (body.errors) {
      const message = body.errors.map((e: any) => e.message).join(', ');
      return [{
        code: 'GQL_ERROR',
        status: message,
        operationName: requestOptions.operationName,
        errors: body.errors
      }, body.data || null];
    }
    
    return [null, body.data];
  } catch (error) {
    return [{
      code: 'EXCEPTION',
      status: error instanceof Error ? error.message : String(error),
      operationName: requestOptions.operationName
    }, null];
  }
}

// Helper Functions for Channels

function getLiveTVChannel(url: string): PlatformChannel {
  log('getLiveTVChannel for: ' + url);
  
  // Extract channel_id from URL if present
  const channelIdMatch = url.match(/channel_id=([0-9]+)/);
  const channelId = channelIdMatch ? channelIdMatch[1] : '';
  
  if (!channelId) {
    throw new ScriptException('No channel_id found in URL: ' + url);
  }
  
  // Query for livestream overview
  const [error, data] = executeGqlQuery({
    ...LIVESTREAM_OVERVIEW_BY_BRAND_QUERY,
    variables: {
      id: channelId
    }
  });
  
  if (error) {
    throw new ScriptException('Failed to get live channel: ' + error.status);
  }
  
  // Parse the channel data
  const brand = data?.brand;
  if (!brand) {
    throw new ScriptException('No brand data in response');
  }
  
  const channel = new PlatformChannel({
    id: new PlatformID(PLATFORM, brand.id || channelId, config.id, 3),
    name: brand.name || 'Unknown Channel',
    thumbnail: brand.logo ? `https://img.joyn.de/${brand.logo}/profile:nextgen-web-brand-150x.webp` : '',
    banner: '',
    subscribers: 0,
    description: brand.description || '',
    url: url,
    urlAlternatives: [url],
    links: {}
  });
  
  log('Mapped live TV channel: ' + brand.name);
  return channel;
}

function getBrandChannel(url: string): PlatformChannel {
  log('getBrandChannel for: ' + url);
  
  // TODO: Query for brand/mediathek details
  throw new ScriptException('Brand channel not yet implemented');
}

function getLiveTVChannelContents(url: string): VideoPager {
  log('getLiveTVChannelContents for: ' + url);
  
  const channelIdMatch = url.match(/channel_id=([0-9]+)/);
  const channelId = channelIdMatch ? channelIdMatch[1] : '';
  
  if (!channelId) {
    return new VideoPager([], false, {});
  }
  
  // Query for livestream data
  const [error, data] = executeGqlQuery({
    ...LIVESTREAM_OVERVIEW_BY_BRAND_QUERY,
    variables: {
      id: channelId
    }
  });
  
  if (error || !data?.brand) {
    log('Failed to get livestream data: ' + (error?.status || 'No data'));
    return new VideoPager([], false, {});
  }
  
  const brand = data.brand;
  const livestreams = brand.livestreams || [];
  
  const videos: PlatformVideo[] = livestreams.map((stream: any) => {
    const currentProgram = stream.currentProgram || {};
    
    return new PlatformVideo({
      id: new PlatformID(PLATFORM, stream.id || '', config.id, 3),
      name: currentProgram.title || brand.name || 'Live',
      thumbnails: new Thumbnails([
        new Thumbnail(
          stream.images?.logo 
            ? `https://img.joyn.de/${stream.images.logo}/profile:nextgen-web-livestill-503x283.webp`
            : '',
          0
        )
      ]),
      author: new PlatformAuthorLink(
        new PlatformID(PLATFORM, brand.id || '', config.id, 3),
        brand.name || '',
        url,
        brand.logo ? `https://img.joyn.de/${brand.logo}/profile:nextgen-web-brand-150x.webp` : '',
        0
      ),
      uploadDate: 0,
      duration: 0,
      viewCount: 0,
      url: `${BASE_URL}/play/live-tv?channel_id=${channelId}`,
      isLive: true
    });
  });
  
  log(`Found ${videos.length} live streams for channel`);
  return new VideoPager(videos, false, {});
}

function getBrandChannelContents(url: string, type: string, order: string, filters: any): VideoPager {
  log('getBrandChannelContents for: ' + url);
  
  // TODO: Query for brand content
  return new VideoPager([], false, {});
}

// Helper Functions for Content Details

function getEpisodeDetails(url: string, assetId: string): PlatformVideoDetails {
  log('getEpisodeDetails for: ' + assetId);
  
  // TODO: Query for episode metadata and video sources
  throw new ScriptException('Episode details not yet implemented');
}

function getMovieDetails(url: string, assetId: string): PlatformVideoDetails {
  log('getMovieDetails for: ' + assetId);
  
  // TODO: Query for movie metadata and video sources
  throw new ScriptException('Movie details not yet implemented');
}

// Helper Functions for Playlists

function getSeriesPlaylist(url: string): PlatformPlaylistDetails {
  log('getSeriesPlaylist for: ' + url);
  
  const seriesSlug = getSeriesSlugFromUrl(url);
  if (!seriesSlug) {
    throw new ScriptException('Could not extract series slug from URL: ' + url);
  }
  
  // TODO: Query for series metadata
  // TODO: Query for all seasons using SEASON_QUERY
  // TODO: Build playlist with all episodes
  throw new ScriptException('Series playlist not yet implemented');
}

log('Joyn plugin loaded');
