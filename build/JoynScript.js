'use strict';

const BASE_URL = 'https://www.joyn.de';
const BASE_URL_API = 'https://api.joyn.de/graphql';
const BASE_URL_AUTH = 'https://auth.joyn.de/auth/anonymous';
const BASE_URL_ALGOLIA = 'https://ffqrv35svv-dsn.algolia.net/1/indexes/*/queries';
const ALGOLIA_APP_ID = 'FFQRV35SVV';
const PLATFORM = 'Joyn';
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36';
// URL Patterns
const REGEX_EPISODE_URL = /^https:\/\/(?:www\.)?joyn\.de\/serien\/[a-zA-Z0-9-]+\/[0-9]+-[0-9]+-[a-zA-Z0-9-]+$/i;
const REGEX_MOVIE_URL = /^https:\/\/(?:www\.)?joyn\.de\/filme\/[a-zA-Z0-9-]+$/i;
const REGEX_SERIES_URL = /^https:\/\/(?:www\.)?joyn\.de\/serien\/[a-zA-Z0-9-]+$/i;
const REGEX_LIVE_TV_URL = /^https:\/\/(?:www\.)?joyn\.de\/play\/live-tv(\?channel_id=[0-9]+)?$/i;
const REGEX_CHANNEL_URL = /^https:\/\/(?:www\.)?joyn\.de\/mediatheken\/[a-zA-Z0-9-]+$/i;
const SEARCH_CAPABILITIES = {
    types: [Type.Feed.Mixed],
    sorts: ['Most Recent', 'Most Viewed'],
    filters: []
};
const DEFAULT_HEADERS = {
    'User-Agent': USER_AGENT,
    'Origin': BASE_URL,
    'Referer': `${BASE_URL}/`
};

// Joyn uses persisted queries with SHA256 hashes
// These are the query hashes observed from the network requests
const LANDING_PAGE_QUERY = {
    operationName: 'LandingPageClient',
    persistedQuery: {
        version: 1,
        sha256Hash: '82586002cd18fa09ea491e5be192c10ed0b392b77d8a47f6e11b065172cfc894'
    }
};
const LIVE_LANE_QUERY = {
    operationName: 'LiveLane',
    persistedQuery: {
        version: 1,
        sha256Hash: '51659c62d4e4a6628d1e512190a3b0659486478b12be494875bef5a83dcb79ed'
    }
};
const ALGOLIA_API_KEY_QUERY = {
    operationName: 'AlgoliaApiKey',
    persistedQuery: {
        version: 1,
        sha256Hash: '21a962eb1b3f05c32b85cf8d015f1814563af3d4aede35d6e2f211838fdcfb61'
    }
};

function applyCommonHeaders() {
    return { ...DEFAULT_HEADERS };
}
function log(message) {
    console.log(`[Joyn] ${message}`);
}
function getAssetIdFromUrl(url) {
    // Extract last segment from URL (may contain the asset ID)
    // Joyn URLs can be:
    // - /serien/navy-cis-la (series slug)
    // - /serien/navy-cis-la/14-1-game-of-drones-bpidjn4j8opy (episode with ID at end)
    // - /filme/transformers-aufstieg-der-bestien (movie slug)
    const parts = url.split('?')[0].split('/');
    const lastSegment = parts[parts.length - 1];
    // Check if last segment contains an asset ID (starts with b_, d_, c_)
    const assetMatch = lastSegment.match(/([bdc]_[a-z0-9]+)$/i);
    if (assetMatch) {
        return assetMatch[1];
    }
    // Otherwise return the slug
    return lastSegment || null;
}
function getSeriesSlugFromUrl(url) {
    // Extract series slug from URLs like /serien/navy-cis-la or /serien/navy-cis-la/14-1-...
    const match = url.match(/\/serien\/([^\/\?]+)/);
    return match ? match[1] : null;
}
function buildImageUrl(path, profile) {
    if (!path)
        return '';
    if (path.startsWith('http'))
        return path;
    return `https://img.joyn.de/${path}/profile:${profile}.webp`;
}

const JoynAssetToGrayjayVideo = (pluginId, asset) => {
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
        ? new PlatformAuthorLink(new PlatformID(PLATFORM, asset.brand.name || '', pluginId, 3), asset.brand.name || '', `${BASE_URL}/mediatheken/${asset.brand.name}`, asset.brand.logo ? buildImageUrl(asset.brand.logo, 'nextgen-web-brand-150x') : '', 0)
        : new PlatformAuthorLink(new PlatformID(PLATFORM, 'joyn', pluginId, 3), 'Joyn', BASE_URL, '', 0);
    // Parse date
    const uploadDate = asset.publicationDate
        ? Math.floor(new Date(asset.publicationDate).getTime() / 1000)
        : 0;
    const video = {
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

class JoynVideoPager extends VideoPager {
    cb;
    constructor(results, hasMore, context, cb) {
        super(results, hasMore, context);
        this.cb = cb;
    }
    nextPage() {
        this.context.page += 1;
        return this.cb(this.context);
    }
}
class JoynChannelPager extends ChannelPager {
    cb;
    constructor(results, hasMore, context, cb) {
        super(results, hasMore, context);
        this.cb = cb;
    }
    nextPage() {
        this.context.page += 1;
        return this.cb(this.context);
    }
}
class JoynSearchPager extends VideoPager {
    cb;
    constructor(results, hasMore, params, page, cb) {
        super(results, hasMore, { params, page });
        this.cb = cb;
    }
    nextPage() {
        this.context.page += 1;
        const opts = {
            query: this.context.params.query,
            type: this.context.params.type,
            order: this.context.params.order,
            filters: this.context.params.filters,
            page: this.context.page,
        };
        return this.cb(opts);
    }
}

let config;
const state = {
    authToken: '',
    authTokenExpiration: 0,
    userId: '',
    algoliaApiKey: '',
    algoliaApiKeyExpiration: 0
};
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
        }
        catch (e) {
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
        const videos = [];
        if (data && data.page && data.page.blocks) {
            for (const block of data.page.blocks) {
                if (block.assets && Array.isArray(block.assets)) {
                    for (const asset of block.assets) {
                        try {
                            const video = JoynAssetToGrayjayVideo(config.id, asset);
                            videos.push(video);
                        }
                        catch (e) {
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
                                }
                                catch (e) {
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
    }
    catch (e) {
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
        const resp = http.POST(BASE_URL_ALGOLIA, JSON.stringify(algoliaRequest), headers, false);
        if (!resp.isOk) {
            throw new ScriptException('Search failed: ' + resp.code);
        }
        const data = JSON.parse(resp.body);
        const hits = data.results?.[0]?.hits || [];
        const nbPages = data.results?.[0]?.nbPages || 0;
        log(`Found ${hits.length} results (page ${page + 1} of ${nbPages})`);
        // Map hits to videos
        const videos = hits.map((hit) => {
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
        }).filter((v) => v !== null);
        const hasMore = (page + 1) < nbPages;
        const context = { query, page, type, order, filters };
        return new JoynSearchPager(videos, hasMore, context, page, searchCallback);
    }
    catch (e) {
        log('Error in search: ' + e);
        throw e;
    }
};
function searchCallback(opts) {
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
    }
    catch (e) {
        log('Error in getChannel: ' + e);
        throw e;
    }
};
source.getChannelContents = function (url, type, order, filters) {
    log('getChannelContents called: ' + url);
    throw new ScriptException('Not implemented yet');
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
        }
        else if (REGEX_MOVIE_URL.test(url)) {
            return getMovieDetails(url, assetId);
        }
        else {
            throw new ScriptException('Unknown content type for URL: ' + url);
        }
    }
    catch (e) {
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
    }
    catch (e) {
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
function isTokenValid() {
    const currentTime = Date.now();
    return state.authToken && state.authTokenExpiration > currentTime;
}
function isAlgoliaKeyValid() {
    const currentTime = Date.now();
    return state.algoliaApiKey && state.algoliaApiKeyExpiration > currentTime;
}
function refreshAnonymousToken() {
    try {
        const resp = http.POST(BASE_URL_AUTH, JSON.stringify({}), applyCommonHeaders(), false);
        if (!resp.isOk) {
            throw new ScriptException('Failed to get anonymous token: ' + resp.code);
        }
        const data = JSON.parse(resp.body);
        state.authToken = data.accessToken || '';
        state.userId = data.userId || '';
        // Token expires in 24 hours
        state.authTokenExpiration = Date.now() + (24 * 60 * 60 * 1000);
        log('Anonymous token refreshed');
    }
    catch (e) {
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
        }
        else {
            throw new ScriptException('No Algolia API key in response');
        }
    }
    catch (e) {
        log('Error refreshing Algolia key: ' + e);
    }
}
function executeGqlQuery(requestOptions) {
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
        }
        catch (parseError) {
            return [{
                    code: 'PARSE_ERROR',
                    status: 'Failed to parse response',
                    operationName: requestOptions.operationName,
                    error: String(parseError)
                }, null];
        }
        if (body.errors) {
            const message = body.errors.map((e) => e.message).join(', ');
            return [{
                    code: 'GQL_ERROR',
                    status: message,
                    operationName: requestOptions.operationName,
                    errors: body.errors
                }, body.data || null];
        }
        return [null, body.data];
    }
    catch (error) {
        return [{
                code: 'EXCEPTION',
                status: error instanceof Error ? error.message : String(error),
                operationName: requestOptions.operationName
            }, null];
    }
}
// Helper Functions for Channels
function getLiveTVChannel(url) {
    log('getLiveTVChannel for: ' + url);
    // Extract channel_id from URL if present
    const channelIdMatch = url.match(/channel_id=([0-9]+)/);
    channelIdMatch ? channelIdMatch[1] : '';
    // Query live lane to get live channels
    const [error, data] = executeGqlQuery({
        ...LIVE_LANE_QUERY,
        variables: {
            blockId: '266996:d50d6f558ab31ad3169c8afa1930f7b3'
        }
    });
    if (error) {
        throw new ScriptException('Failed to get live channels: ' + error.status);
    }
    // TODO: Parse live channel data and find the requested channel
    throw new ScriptException('Live TV channel parsing not yet implemented');
}
function getBrandChannel(url) {
    log('getBrandChannel for: ' + url);
    // TODO: Query for brand/mediathek details
    throw new ScriptException('Brand channel not yet implemented');
}
// Helper Functions for Content Details
function getEpisodeDetails(url, assetId) {
    log('getEpisodeDetails for: ' + assetId);
    // TODO: Query for episode metadata and video sources
    throw new ScriptException('Episode details not yet implemented');
}
function getMovieDetails(url, assetId) {
    log('getMovieDetails for: ' + assetId);
    // TODO: Query for movie metadata and video sources
    throw new ScriptException('Movie details not yet implemented');
}
// Helper Functions for Playlists
function getSeriesPlaylist(url) {
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
