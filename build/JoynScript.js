'use strict';

const BASE_URL = 'https://www.joyn.de';
const BASE_URL_API = 'https://api.joyn.de/graphql';
const BASE_URL_AUTH = 'https://auth.joyn.de/auth/anonymous';
const BASE_URL_ALGOLIA = 'https://ffqrv35svv-dsn.algolia.net/1/indexes/*/queries';
const ALGOLIA_APP_ID = 'FFQRV35SVV';
const PLATFORM = 'Joyn';
// Use desktop Chrome User-Agent to match browser behavior and avoid fingerprinting detection
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// URL Patterns
const REGEX_EPISODE_URL = /^https:\/\/(?:www\.)?joyn\.de\/serien\/[a-zA-Z0-9-]+\/[0-9]+-[0-9]+-[a-zA-Z0-9-]+$/i;
const REGEX_MOVIE_URL = /^https:\/\/(?:www\.)?joyn\.de\/filme\/[a-zA-Z0-9-]+$/i;
const REGEX_SERIES_URL = /^https:\/\/(?:www\.)?joyn\.de\/serien\/[a-zA-Z0-9-]+$/i;
const REGEX_VIDEO_URL = /^https:\/\/(?:www\.)?joyn\.de\/video\/[a-zA-Z0-9_-]+$/i;
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
    'Referer': `${BASE_URL}/`,
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
};

function applyCommonHeaders() {
    return { ...DEFAULT_HEADERS };
}
function log(message) {
    const logMessage = `[Joyn] ${message}`;
    console.log(logMessage);
    // Use bridge.log if available to ensure logs are captured by OnLog event
    if (typeof bridge !== 'undefined' && bridge.log) {
        bridge.log(logMessage);
    }
}
function getAssetIdFromUrl(url) {
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
function getSeriesSlugFromUrl(url) {
    // Extract series slug from URLs like /serien/navy-cis-la or /serien/navy-cis-la/14-1-...
    const match = url.match(/\/serien\/([^\/\?]+)/);
    return match ? match[1] : null;
}
function buildImageUrl(path, profile) {
    if (!path)
        return '';
    // Handle case where path might be an object (extract string value)
    let pathStr;
    if (typeof path === 'string') {
        pathStr = path;
    }
    else if (path && typeof path === 'object' && 'toString' in path) {
        pathStr = String(path);
    }
    else {
        pathStr = String(path || '');
    }
    if (!pathStr)
        return '';
    if (pathStr.startsWith('http'))
        return pathStr;
    return `https://img.joyn.de/${pathStr}/profile:${profile}.webp`;
}
function parseISO8601Duration(duration) {
    if (!duration)
        return 0;
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match)
        return 0;
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    return hours * 3600 + minutes * 60 + seconds;
}

// Joyn uses persisted queries with SHA256 hashes
// These are the query hashes observed from the network requests
const LANDING_PAGE_QUERY = {
    operationName: 'LandingPageClient',
    persistedQuery: {
        version: 1,
        sha256Hash: 'd126aa8da9aae9a7abdabe014e8641ce54c17fd0a39c37f8a7bbcab258821508'
    }
};
const ALGOLIA_API_KEY_QUERY = {
    operationName: 'AlgoliaApiKey',
    persistedQuery: {
        version: 1,
        sha256Hash: '21a962eb1b3f05c32b85cf8d015f1814563af3d4aede35d6e2f211838fdcfb61'
    }
};
const LIVESTREAM_OVERVIEW_BY_BRAND_QUERY = {
    operationName: 'LivestreamOverviewByBrand',
    persistedQuery: {
        version: 1,
        sha256Hash: '5a094812b90747ed18d2eac87f8b29a82e403a02f329d03478f7b2a5cf6ca463'
    }
};
const EPISODE_DETAIL_PAGE_QUERY = {
    operationName: 'EpisodeDetailPageStatic',
    persistedQuery: {
        version: 1,
        sha256Hash: 'c4bcacee94d38133e87879dad8d69bd8a74c7326262a1848cceb964b871c1551'
    }
};
const PAGE_SERIES_EPISODE_PLAYER_QUERY = {
    operationName: 'PageSeriesEpisodePlayerClientSide',
    persistedQuery: {
        version: 1,
        sha256Hash: '864e9acb09fed428ad277efef2351295e76518b6803e63d5831a4150b96f9051'
    }
};
const PAGE_MOVIE_PLAYER_QUERY = {
    operationName: 'PageMoviePlayerClientSide',
    persistedQuery: {
        version: 1,
        sha256Hash: 'a06da53f05ced9524e1694940d6ceb23e97d85cdb081d3c2ac44ffae5b3190a6'
    }
};
const PAGE_MOVIE_DETAIL_QUERY = {
    operationName: 'PageMovieDetailStatic',
    persistedQuery: {
        version: 1,
        sha256Hash: '26bd3a883c1b619572ea914a11f40c3cddd01bc140d8d58cefbe5291b5916b51'
    }
};

const JoynAssetToGrayjayVideo = (pluginId, asset) => {
    const videoId = asset.id || '';
    const title = asset.title || 'Untitled';
    const duration = asset.duration || 0;
    // Build thumbnail from heroLandscape or heroPortrait
    // GraphQL returns images at top level: heroLandscapeImage, heroPortraitImage
    // Also support nested images structure for compatibility
    const heroLandscape = asset.heroLandscapeImage || asset.images?.heroLandscape;
    const heroPortrait = asset.heroPortraitImage || asset.images?.heroPortrait;
    const primaryImage = asset.primaryImage;
    const thumbnail = heroLandscape
        ? buildImageUrl(heroLandscape, 'nextgen-web-herolandscape-1920x')
        : heroPortrait
            ? buildImageUrl(heroPortrait, 'nextgen-web-heroportrait-243x365')
            : primaryImage
                ? buildImageUrl(primaryImage, 'nextgen-web-herolandscape-1920x')
                : '';
    // Build video URL
    const url = asset.path
        ? `${BASE_URL}${asset.path}`
        : `${BASE_URL}/video/${videoId}`;
    // Create author link from brand
    const author = asset.brand
        ? new PlatformAuthorLink(new PlatformID(PLATFORM, asset.brand.id || asset.brand.name || '', pluginId, 3), asset.brand.name || '', asset.brand.id ? `${BASE_URL}/mediatheken/${asset.brand.id}` : `${BASE_URL}/mediatheken/${asset.brand.name}`, asset.brand.logo ? buildImageUrl(asset.brand.logo, 'nextgen-web-brand-150x') : '', 0)
        : new PlatformAuthorLink(new PlatformID(PLATFORM, 'joyn', pluginId, 3), 'Joyn', BASE_URL, '', 0);
    // Parse date
    const uploadDate = asset.publicationDate
        ? Math.floor(new Date(asset.publicationDate).getTime() / 1000)
        : 0;
    const video = {
        id: new PlatformID(PLATFORM, videoId, pluginId, 3),
        name: title,
        description: asset.description || '',
        thumbnails: new Thumbnails([new Thumbnail(thumbnail, 0)]),
        author,
        uploadDate,
        datetime: uploadDate,
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
let pluginSettings = {};
const state = {
    authToken: '',
    authTokenExpiration: 0,
    userId: '',
    algoliaApiKey: '',
    algoliaApiKeyExpiration: 0,
    graphqlApiKey: '',
    graphqlApiKeyExpiration: 0,
    entitlementToken: '',
    entitlementTokenExpiration: 0
};
//Source Methods
source.enable = function (conf, settings, saveStateStr) {
    try {
        config = conf ?? {};
        pluginSettings = settings ?? {};
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
                state.graphqlApiKey = savedState.graphqlApiKey || '';
                state.graphqlApiKeyExpiration = savedState.graphqlApiKeyExpiration || 0;
                state.entitlementToken = savedState.entitlementToken || '';
                state.entitlementTokenExpiration = savedState.entitlementTokenExpiration || 0;
            }
            catch (e) {
                log('Failed to parse saved state: ' + e);
            }
        }
        // Get anonymous token if needed (non-blocking during enable)
        // Wrap in try-catch to prevent errors during plugin initialization
        try {
            if (!isTokenValid()) {
                refreshAnonymousToken();
            }
        }
        catch (e) {
            log('Warning: Could not refresh token during enable: ' + e);
            // Continue anyway - token will be refreshed when needed
        }
        // Get GraphQL API key if needed (non-blocking during enable)
        // Wrap in try-catch to prevent errors during plugin initialization
        try {
            if (!isGraphQLApiKeyValid()) {
                refreshGraphQLApiKey();
            }
        }
        catch (e) {
            log('Warning: Could not refresh GraphQL API key during enable: ' + e);
            // Continue anyway - API key will be refreshed when needed
        }
    }
    catch (e) {
        log('Error in source.enable: ' + e);
        // Don't throw - allow plugin to load even if initialization fails
        // The plugin can still work, tokens will be refreshed when needed
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
        algoliaApiKeyExpiration: state.algoliaApiKeyExpiration,
        graphqlApiKey: state.graphqlApiKey,
        graphqlApiKeyExpiration: state.graphqlApiKeyExpiration,
        entitlementToken: state.entitlementToken,
        entitlementTokenExpiration: state.entitlementTokenExpiration
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
                // Algolia returns images in nested structure, but GraphQL uses top-level *Image fields
                heroPortraitImage: hit.images?.heroPortrait,
                heroLandscapeImage: hit.images?.heroLandscape,
                artLogoImage: hit.images?.artLogo,
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
    // Content details are episodes, movies, and direct video URLs
    // Also include series URLs - Grayjay may route them to VideoLoad instead of PlaylistLoad
    return REGEX_EPISODE_URL.test(url) || REGEX_MOVIE_URL.test(url) || REGEX_SERIES_URL.test(url) || REGEX_VIDEO_URL.test(url);
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
    }
    catch (e) {
        log('Error in getChannelContents: ' + e);
        throw e;
    }
};
source.getContentDetails = function (url) {
    log('getContentDetails called: ' + url);
    try {
        // If it's a series URL, Grayjay may route it to VideoLoad instead of PlaylistLoad
        // As a workaround, we'll return series info formatted as video details
        // This allows Grayjay to display the series even if it routes incorrectly
        if (REGEX_SERIES_URL.test(url)) {
            log('Series URL detected in getContentDetails - returning series as video details (workaround)');
            return getSeriesAsVideoDetails(url);
        }
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
        else if (REGEX_VIDEO_URL.test(url)) {
            // For /video/ URLs, try to get video details by ID
            // These are typically direct video assets, so we'll try to extract sources directly
            log('Video URL detected - attempting to get video details by ID');
            return getVideoDetailsById(url, assetId);
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
function serializeContentDetails(obj, depth = 0) {
    if (depth > 10)
        return '[Max Depth]'; // Prevent infinite recursion
    if (obj === null || obj === undefined)
        return obj;
    if (typeof obj !== 'object')
        return obj;
    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map((item) => serializeContentDetails(item, depth + 1));
    }
    // For objects, iterate over all key-value pairs and recursively serialize each value
    const result = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            // Recursively serialize the value
            result[key] = serializeContentDetails(value, depth + 1);
        }
    }
    return result;
}
function isTokenValid() {
    const currentTime = Date.now();
    return state.authToken && state.authTokenExpiration > currentTime;
}
function isAlgoliaKeyValid() {
    const currentTime = Date.now();
    return state.algoliaApiKey && state.algoliaApiKeyExpiration > currentTime;
}
function refreshAnonymousToken() {
    const headers = applyCommonHeaders();
    headers['Content-Type'] = 'application/json';
    const requestBody = {
        client_id: 'web',
        client_name: 'joyn-web'
    };
    log('Requesting anonymous token with: ' + JSON.stringify(requestBody));
    // POST with client_id and client_name (required by API)
    const resp = http.POST(BASE_URL_AUTH, JSON.stringify(requestBody), headers, false);
    if (!resp.isOk) {
        // Log the error so we can debug, but throw to fail fast
        const errorMsg = 'Failed to get anonymous token: HTTP ' + resp.code + (resp.body ? ' - ' + resp.body.substring(0, 500) : '');
        log('Error: ' + errorMsg);
        throw new ScriptException(errorMsg);
    }
    log('Auth response body (first 500 chars): ' + resp.body.substring(0, 500));
    const data = JSON.parse(resp.body);
    // API returns access_token (snake_case) not accessToken (camelCase)
    const token = data.access_token || data.accessToken;
    if (!token) {
        const errorMsg = 'No access token in response: ' + resp.body.substring(0, 500);
        log('Error: ' + errorMsg);
        throw new ScriptException(errorMsg);
    }
    log('Token received (first 50 chars): ' + token.substring(0, 50) + '...');
    state.authToken = token;
    state.userId = data.userId || data.user_id || '';
    // Token expires in 24 hours
    state.authTokenExpiration = Date.now() + (24 * 60 * 60 * 1000);
    log('Anonymous token refreshed successfully');
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
function refreshGraphQLApiKey() {
    try {
        log('Fetching GraphQL API key from page JavaScript...');
        // Fetch the main page
        const headers = applyCommonHeaders();
        const resp = http.GET(BASE_URL, headers, false);
        if (!resp.isOk) {
            throw new ScriptException('Failed to fetch page: HTTP ' + resp.code);
        }
        // Search for the API key in the HTML/JavaScript
        // The API key is a 32-character hex string, typically found in headers or config objects
        // Look for patterns like: "x-api-key": "..." or 'x-api-key': '...' or x-api-key: "..." or xApiKey: "..."
        const apiKeyPatterns = [
            /["']x-api-key["']\s*[:=]\s*["']([a-f0-9]{32})["']/gi,
            /["']xApiKey["']\s*[:=]\s*["']([a-f0-9]{32})["']/gi,
            /["']apiKey["']\s*[:=]\s*["']([a-f0-9]{32})["']/gi,
            /api[_-]?key\s*[:=]\s*["']([a-f0-9]{32})["']/gi,
            /["']([a-f0-9]{32})["']\s*[,;]\s*\/\/\s*api[_-]?key/gi
        ];
        let match = null;
        for (const pattern of apiKeyPatterns) {
            match = pattern.exec(resp.body);
            if (match)
                break;
        }
        // Also try searching for the key directly (32 hex chars)
        let foundKey = null;
        if (!match) {
            const directPattern = /([a-f0-9]{32})/g;
            const matches = resp.body.match(directPattern);
            if (matches && matches.length > 0) {
                // The API key we found earlier: 4f0fd9f18abbe3cf0e87fdb556bc39c8
                // Check if any match is near "api" or "key" keywords
                for (const potentialKey of matches) {
                    const keyIndex = resp.body.indexOf(potentialKey);
                    const context = resp.body.substring(Math.max(0, keyIndex - 50), Math.min(resp.body.length, keyIndex + 100));
                    if (context.toLowerCase().includes('api') || context.toLowerCase().includes('key')) {
                        foundKey = potentialKey;
                        break;
                    }
                }
            }
        }
        if (match && match[1]) {
            state.graphqlApiKey = match[1];
            // API key appears to be static, but refresh it daily to be safe
            state.graphqlApiKeyExpiration = Date.now() + (24 * 60 * 60 * 1000);
            log('GraphQL API key refreshed: ' + state.graphqlApiKey.substring(0, 8) + '...');
            return;
        }
        else if (foundKey) {
            state.graphqlApiKey = foundKey;
            // API key appears to be static, but refresh it daily to be safe
            state.graphqlApiKeyExpiration = Date.now() + (24 * 60 * 60 * 1000);
            log('GraphQL API key refreshed: ' + state.graphqlApiKey.substring(0, 8) + '...');
            return;
        }
        // Fallback: try fetching a script file that might contain the key
        // Look for script tags in the HTML
        const scriptPattern = /<script[^>]*src=["']([^"']+)["'][^>]*>/gi;
        let scriptMatch;
        const scriptUrls = [];
        while ((scriptMatch = scriptPattern.exec(resp.body)) !== null) {
            const scriptUrl = scriptMatch[1];
            if (scriptUrl && (scriptUrl.includes('joyn') || scriptUrl.includes('main') || scriptUrl.includes('app'))) {
                scriptUrls.push(scriptUrl.startsWith('http') ? scriptUrl : BASE_URL + scriptUrl);
            }
        }
        // Try fetching the first few script files to find the API key
        for (let i = 0; i < Math.min(3, scriptUrls.length); i++) {
            try {
                const scriptResp = http.GET(scriptUrls[i], headers, false);
                if (scriptResp.isOk) {
                    // Try all patterns on this script
                    for (const pattern of apiKeyPatterns) {
                        const scriptMatch = pattern.exec(scriptResp.body);
                        if (scriptMatch && scriptMatch[1]) {
                            state.graphqlApiKey = scriptMatch[1];
                            state.graphqlApiKeyExpiration = Date.now() + (24 * 60 * 60 * 1000);
                            log('GraphQL API key found in script: ' + state.graphqlApiKey.substring(0, 8) + '...');
                            return;
                        }
                    }
                }
            }
            catch (e) {
                // Continue to next script
            }
        }
        // If we still haven't found it, use the known value as fallback
        log('Warning: Could not extract API key from page, using fallback');
        state.graphqlApiKey = '4f0fd9f18abbe3cf0e87fdb556bc39c8';
        state.graphqlApiKeyExpiration = Date.now() + (24 * 60 * 60 * 1000);
    }
    catch (e) {
        log('Error refreshing GraphQL API key: ' + e);
        // Use fallback
        state.graphqlApiKey = '4f0fd9f18abbe3cf0e87fdb556bc39c8';
        state.graphqlApiKeyExpiration = Date.now() + (24 * 60 * 60 * 1000);
    }
}
function isGraphQLApiKeyValid() {
    return !!(state.graphqlApiKey && state.graphqlApiKeyExpiration > Date.now());
}
function isEntitlementTokenValid() {
    return !!(state.entitlementToken && state.entitlementTokenExpiration > Date.now());
}
function refreshEntitlementToken(videoId) {
    try {
        log('Fetching entitlement token for video: ' + videoId + '...');
        if (state.entitlementToken && state.entitlementTokenExpiration > Date.now()) {
            log('Entitlement token is still valid, no refresh needed.');
            return;
        }
        if (!videoId) {
            throw new ScriptException('Video ID is required for entitlement token');
        }
        // Request entitlement token from entitlement service
        // Refresh auth token if needed (entitlement service might need it even if not in HAR)
        if (!isTokenValid()) {
            refreshAnonymousToken();
        }
        if (!state.authToken) {
            throw new ScriptException('Authentication required but no token available');
        }
        // IMPORTANT: Use the default HTTP client to ensure session state is maintained
        // The same client instance maintains cookies and connection state between requests
        const httpClient = http.getDefaultClient(false);
        const headers = applyCommonHeaders();
        headers['Content-Type'] = 'application/json';
        headers['Accept'] = 'application/json';
        headers['Authorization'] = `Bearer ${state.authToken}`; // Add auth token (might be needed for validation)
        headers['joyn-platform'] = 'web'; // lowercase, not Joyn-Platform
        headers['joyn-client-version'] = '5.1370.0';
        headers['joyn-b2b-context'] = 'UNKNOWN';
        headers['joyn-client-os'] = 'UNKNOWN';
        headers['origin'] = BASE_URL;
        // Browser security headers for entitlement service (cross-site request)
        headers['sec-fetch-site'] = 'cross-site';
        headers['sec-fetch-mode'] = 'cors';
        headers['sec-fetch-dest'] = 'empty';
        headers['sec-ch-ua'] = '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"';
        headers['sec-ch-ua-mobile'] = '?0';
        headers['sec-ch-ua-platform'] = '"Windows"';
        headers['priority'] = 'u=1, i';
        // Request body must use content_id (video ID) and content_type: "VOD"
        const requestBody = {
            content_id: videoId,
            content_type: 'VOD'
        };
        log('Entitlement token request body: ' + JSON.stringify(requestBody));
        log('Using default HTTP client to maintain session state');
        const resp = httpClient.POST('https://entitlement.p7s1.io/api/user/entitlement-token', JSON.stringify(requestBody), headers);
        if (!resp.isOk) {
            log('Failed to get entitlement token: HTTP ' + resp.code + ' - ' + (resp.body ? resp.body.substring(0, 500) : 'empty'));
            throw new ScriptException('Failed to get entitlement token: HTTP ' + resp.code);
        }
        const data = JSON.parse(resp.body);
        // Response field is entitlement_token (snake_case)
        const token = data.entitlement_token || data.entitlementToken || data.token;
        if (!token) {
            log('Entitlement token response: ' + resp.body.substring(0, 500));
            throw new ScriptException('No entitlement token in response');
        }
        state.entitlementToken = token;
        // Entitlement tokens typically expire in 1 hour, but let's refresh every 30 minutes to be safe
        state.entitlementTokenExpiration = Date.now() + (30 * 60 * 1000);
        log('Entitlement token refreshed (first 50 chars): ' + token.substring(0, 50) + '...');
    }
    catch (e) {
        log('Error refreshing entitlement token: ' + e);
        throw e;
    }
}
/**
 * Get the country code from plugin settings
 * For Dropdown settings, the value is the index, so we need to get the actual option value
 * @returns The country code (e.g., "DE", "AT", "CH") or "DE" as default
 */
function getCountryCode() {
    // Get the setting index from pluginSettings
    const settingIndex = pluginSettings['joyn_country'];
    // Get the setting definition from config
    if (config && config.settings) {
        const countrySetting = config.settings.find((s) => s.variable === 'joyn_country');
        if (countrySetting && countrySetting.options && Array.isArray(countrySetting.options)) {
            const index = settingIndex ? parseInt(settingIndex, 10) : 0;
            if (!isNaN(index) && index >= 0 && index < countrySetting.options.length) {
                return countrySetting.options[index];
            }
            // If index is invalid, return first option as default
            return countrySetting.options[0] || 'DE';
        }
    }
    // Fallback to default
    return 'DE';
}
function executeGqlQuery(requestOptions) {
    // Refresh token if needed - MUST have token for this API
    if (!isTokenValid()) {
        refreshAnonymousToken();
    }
    if (!state.authToken) {
        throw new ScriptException('Authentication required but no token available');
    }
    // Get GraphQL API key if needed
    if (!isGraphQLApiKeyValid()) {
        refreshGraphQLApiKey();
    }
    const headers = applyCommonHeaders();
    headers['Authorization'] = `Bearer ${state.authToken}`;
    headers['Accept'] = 'application/json';
    headers['Content-Type'] = 'application/json';
    // GraphQL API requires an API key - fetched dynamically from page
    headers['x-api-key'] = state.graphqlApiKey || '4f0fd9f18abbe3cf0e87fdb556bc39c8';
    // Additional headers found in browser requests
    headers['Joyn-Platform'] = 'web';
    headers['joyn-country'] = getCountryCode();
    headers['joyn-distribution-tenant'] = 'JOYN';
    headers['joyn-client-version'] = '5.1370.0'; // Client version from browser requests
    headers['Referer'] = BASE_URL; // Set referer to match browser behavior
    log('Making GraphQL request with token (first 50 chars): ' + state.authToken.substring(0, 50) + '...');
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
        // If we get a 401, try refreshing the token once and retry
        if (!res.isOk && res.code === 401) {
            log('Got 401, response body: ' + (res.body ? res.body.substring(0, 200) : 'empty'));
            log('Refreshing token and retrying');
            refreshAnonymousToken();
            // Recreate headers with fresh token
            const retryHeaders = applyCommonHeaders();
            retryHeaders['Authorization'] = `Bearer ${state.authToken}`;
            retryHeaders['Accept'] = 'application/json';
            retryHeaders['Content-Type'] = 'application/json';
            retryHeaders['x-api-key'] = state.graphqlApiKey || '4f0fd9f18abbe3cf0e87fdb556bc39c8';
            retryHeaders['Joyn-Platform'] = 'web';
            retryHeaders['joyn-country'] = getCountryCode();
            retryHeaders['joyn-distribution-tenant'] = 'JOYN';
            retryHeaders['joyn-client-version'] = '5.1370.0';
            retryHeaders['Referer'] = BASE_URL;
            const retryRes = http.GET(url, retryHeaders, false);
            log('Retry 401 response body: ' + (retryRes.body ? retryRes.body.substring(0, 200) : 'empty'));
            if (!retryRes.isOk) {
                return [{
                        code: retryRes.code,
                        status: `HTTP ${retryRes.code}`,
                        operationName: requestOptions.operationName,
                        body: retryRes.body
                    }, null];
            }
            // Parse retry response
            let body;
            try {
                body = JSON.parse(retryRes.body);
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
function getBrandChannel(url) {
    log('getBrandChannel for: ' + url);
    // Extract brand ID from URL (mediatheken/{brandId})
    const brandIdMatch = url.match(/\/mediatheken\/([^/?]+)/);
    const brandId = brandIdMatch ? brandIdMatch[1] : '';
    if (!brandId) {
        throw new ScriptException('No brand ID found in URL: ' + url);
    }
    // Query for brand details using the livestream overview query (it returns brand info)
    const [error, data] = executeGqlQuery({
        ...LIVESTREAM_OVERVIEW_BY_BRAND_QUERY,
        variables: {
            id: brandId
        }
    });
    if (error) {
        // If that fails, try to construct a basic channel from the URL
        log('Failed to get brand details: ' + error.status + ', using basic info');
        return new PlatformChannel({
            id: new PlatformID(PLATFORM, brandId, config.id, 3),
            name: brandId,
            thumbnail: '',
            banner: '',
            subscribers: 0,
            description: '',
            url: url,
            urlAlternatives: [url],
            links: {}
        });
    }
    const brand = data?.brand;
    if (!brand) {
        throw new ScriptException('No brand data in response');
    }
    const channel = new PlatformChannel({
        id: new PlatformID(PLATFORM, brand.id || brandId, config.id, 3),
        name: brand.name || brandId,
        thumbnail: brand.logo ? `https://img.joyn.de/${brand.logo}/profile:nextgen-web-brand-150x.webp` : '',
        banner: '',
        subscribers: 0,
        description: brand.description || '',
        url: url,
        urlAlternatives: [url],
        links: {}
    });
    log('Mapped brand channel: ' + brand.name);
    return channel;
}
function getLiveTVChannelContents(url) {
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
    const videos = livestreams.map((stream) => {
        const currentProgram = stream.currentProgram || {};
        return new PlatformVideo({
            id: new PlatformID(PLATFORM, stream.id || '', config.id, 3),
            name: currentProgram.title || brand.name || 'Live',
            thumbnails: new Thumbnails([
                new Thumbnail(stream.images?.logo
                    ? `https://img.joyn.de/${stream.images.logo}/profile:nextgen-web-livestill-503x283.webp`
                    : '', 0)
            ]),
            author: new PlatformAuthorLink(new PlatformID(PLATFORM, brand.id || '', config.id, 3), brand.name || '', url, brand.logo ? `https://img.joyn.de/${brand.logo}/profile:nextgen-web-brand-150x.webp` : '', 0),
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
function getBrandChannelContents(url, type, order, filters) {
    log('getBrandChannelContents for: ' + url);
    // TODO: Query for brand content
    return new VideoPager([], false, {});
}
// Helper Functions for Content Details
function extractVideoSources(path, assetId, isMovie = false) {
    log('Extracting video sources for path: ' + path + (assetId ? ' (assetId: ' + assetId + ')' : '') + (isMovie ? ' [MOVIE]' : ' [EPISODE]'));
    try {
        // Use the correct player query based on content type
        const playerQuery = isMovie ? PAGE_MOVIE_PLAYER_QUERY : PAGE_SERIES_EPISODE_PLAYER_QUERY;
        // Query the player endpoint to get video playback URLs
        const [error, data] = executeGqlQuery({
            ...playerQuery,
            variables: {
                path: path
            }
        });
        if (error) {
            log('Failed to get player data: ' + error.status + ' - ' + JSON.stringify(error));
            return new VideoSourceDescriptor([]);
        }
        // Extract video sources from player response
        // The structure may vary, but typically contains playback configuration
        const page = data?.page;
        if (!page) {
            log('No page data in player response');
            return new VideoSourceDescriptor([]);
        }
        const sources = [];
        // Check if page has minimal data (just __typename and maybe movie/episode with minimal data)
        // If the page only has __typename and a nested object with just id/path, it's minimal data
        const hasMinimalData = (Object.keys(page).length <= 2 && page.__typename &&
            (!page.player && !page.asset && (!page.movie || Object.keys(page.movie).length <= 3) &&
                (!page.episode || Object.keys(page.episode).length <= 3)));
        if (hasMinimalData || (!page.player && !page.asset && !page.hlsManifestUrl && !page.dashManifestUrl)) {
            log('Player query returned minimal data (__typename: ' + page.__typename + '). Trying alternative VOD API endpoint.');
            // Try using the VOD API endpoint if we have an asset ID
            if (assetId) {
                try {
                    // Get entitlement token if needed (pass video ID - assetId should be video ID)
                    if (!isEntitlementTokenValid()) {
                        refreshEntitlementToken(assetId);
                    }
                    if (!state.entitlementToken) {
                        log('No entitlement token available for VOD API');
                        return new VideoSourceDescriptor([]);
                    }
                    const vodUrl = `https://api.vod-prd.s.joyn.de/v1/asset/${assetId}/playlist`;
                    // Based on HAR: no explicit entitlement token header, but might need auth token for session
                    // Refresh auth token if needed
                    if (!isTokenValid()) {
                        refreshAnonymousToken();
                    }
                    if (!state.authToken) {
                        log('No auth token available for VOD API');
                        return new VideoSourceDescriptor([]);
                    }
                    // IMPORTANT: Use the default HTTP client to ensure session state is maintained
                    // The same client instance maintains cookies and connection state between requests
                    // This is critical for server-side session validation
                    const httpClient = http.getDefaultClient(false);
                    // Try using http.batch() to ensure both requests use the same connection
                    // This might help with server-side session validation
                    // However, browser waits ~10 seconds between requests, so we'll make them sequentially
                    // but using the same client instance
                    const vodHeaders = applyCommonHeaders();
                    vodHeaders['Accept'] = '*/*';
                    vodHeaders['Content-Type'] = 'application/json';
                    vodHeaders['origin'] = BASE_URL;
                    vodHeaders['referer'] = BASE_URL;
                    // Browser security headers for VOD API (same-site request from www.joyn.de to api.vod-prd.s.joyn.de)
                    vodHeaders['sec-fetch-site'] = 'same-site';
                    vodHeaders['sec-fetch-mode'] = 'cors';
                    vodHeaders['sec-fetch-dest'] = 'empty';
                    vodHeaders['sec-ch-ua'] = '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"';
                    vodHeaders['sec-ch-ua-mobile'] = '?0';
                    vodHeaders['sec-ch-ua-platform'] = '"Windows"';
                    vodHeaders['priority'] = 'u=1, i';
                    // Don't add Authorization header initially - HAR shows no auth headers
                    // Try multiple approaches based on HAR analysis and testing
                    // Approach 1: No auth headers (as per HAR)
                    // Approach 2: Add entitlement token as header (might be needed despite HAR)
                    // Approach 3: Add auth token (for session)
                    // First try: No auth headers (as HAR suggests)
                    let vodRequestBody = {
                        manufacturer: 'unknown',
                        platform: 'browser',
                        maxSecurityLevel: 1,
                        streamingFormat: 'dash',
                        model: 'unknown',
                        protectionSystem: 'widevine',
                        enableDolbyAudio: false,
                        enableSubtitles: true,
                        variantName: 'default'
                    };
                    log('Trying VOD API endpoint: ' + vodUrl + ' (assetId: ' + assetId + ', entitlementToken: ' + (state.entitlementToken ? 'present' : 'missing') + ')');
                    log('Request body: ' + JSON.stringify(vodRequestBody));
                    log('Request headers: Matching browser exactly (sec-fetch-*, sec-ch-ua, priority, etc.)');
                    log('Using default HTTP client to maintain session state');
                    log('Note: Browser waits ~10s between entitlement and VOD requests, but we make them immediately');
                    // IMPORTANT: Make the VOD API request immediately after entitlement token request
                    // The server may validate based on connection/session state
                    // Using the same httpClient instance ensures connection reuse
                    // First try: Exact match to HAR (no auth headers, just browser headers)
                    let vodResp = httpClient.POST(vodUrl, JSON.stringify(vodRequestBody), vodHeaders);
                    // If that fails with 401, try adding auth token (might be needed for session)
                    if (!vodResp.isOk && vodResp.code === 401) {
                        log('VOD API returned 401, trying with auth token header...');
                        const vodHeadersWithAuth = { ...vodHeaders };
                        vodHeadersWithAuth['Authorization'] = `Bearer ${state.authToken}`;
                        vodResp = httpClient.POST(vodUrl, JSON.stringify(vodRequestBody), vodHeadersWithAuth);
                    }
                    // If still fails, try with entitlement token as header
                    if (!vodResp.isOk && vodResp.code === 401) {
                        log('VOD API still returned 401, trying with entitlement token header...');
                        const vodHeadersWithToken = { ...vodHeaders };
                        vodHeadersWithToken['X-Entitlement-Token'] = state.entitlementToken;
                        vodHeadersWithToken['entitlement-token'] = state.entitlementToken;
                        vodResp = httpClient.POST(vodUrl, JSON.stringify(vodRequestBody), vodHeadersWithToken);
                    }
                    // If still fails, try with both tokens
                    if (!vodResp.isOk && vodResp.code === 401) {
                        log('VOD API still returned 401, trying with both auth and entitlement token...');
                        const vodHeadersWithBoth = { ...vodHeaders };
                        vodHeadersWithBoth['Authorization'] = `Bearer ${state.authToken}`;
                        vodHeadersWithBoth['X-Entitlement-Token'] = state.entitlementToken;
                        vodHeadersWithBoth['entitlement-token'] = state.entitlementToken;
                        vodResp = httpClient.POST(vodUrl, JSON.stringify(vodRequestBody), vodHeadersWithBoth);
                    }
                    // If still fails, try with entitlement token in body
                    if (!vodResp.isOk && vodResp.code === 401) {
                        log('VOD API still returned 401, trying with entitlement token in request body...');
                        const vodBodyWithToken = { ...vodRequestBody, entitlementToken: state.entitlementToken };
                        vodResp = httpClient.POST(vodUrl, JSON.stringify(vodBodyWithToken), vodHeaders);
                    }
                    if (vodResp.isOk && vodResp.body) {
                        try {
                            const vodData = JSON.parse(vodResp.body);
                            log('VOD API response keys: ' + JSON.stringify(Object.keys(vodData)).substring(0, 500));
                            log('VOD API response (first 1000 chars): ' + JSON.stringify(vodData).substring(0, 1000));
                            // Based on HAR: response has manifestUrl field (not hlsUrl/dashUrl)
                            if (vodData.manifestUrl) {
                                // Check streaming format to determine source type
                                if (vodData.streamingFormat === 'hls' || vodData.manifestUrl.includes('.m3u8')) {
                                    sources.push(new HLSSource({ url: vodData.manifestUrl }));
                                    log('Found HLS manifest from VOD API: ' + vodData.manifestUrl);
                                }
                                else if (vodData.streamingFormat === 'dash' || vodData.manifestUrl.includes('.mpd')) {
                                    sources.push(new DashSource({ url: vodData.manifestUrl }));
                                    log('Found DASH manifest from VOD API: ' + vodData.manifestUrl);
                                }
                                else {
                                    // Default to DASH if format is unknown
                                    sources.push(new DashSource({ url: vodData.manifestUrl }));
                                    log('Found manifest from VOD API (assuming DASH): ' + vodData.manifestUrl);
                                }
                            }
                            else {
                                log('VOD API response does not contain manifestUrl. Full response: ' + JSON.stringify(vodData).substring(0, 2000));
                            }
                            if (sources.length > 0) {
                                log('Successfully extracted ' + sources.length + ' video source(s) from VOD API');
                                return new VideoSourceDescriptor(sources);
                            }
                            else {
                                log('VOD API response parsed but no manifestUrl found');
                            }
                        }
                        catch (e) {
                            log('Failed to parse VOD API response: ' + e + ' - Response body: ' + (vodResp.body ? vodResp.body.substring(0, 500) : 'empty'));
                        }
                    }
                    else {
                        log('VOD API request failed: HTTP ' + vodResp.code + ' - ' + (vodResp.body ? vodResp.body.substring(0, 500) : 'empty'));
                        log('Asset ID used: ' + assetId);
                        log('Entitlement token present: ' + (state.entitlementToken ? 'yes (first 50 chars: ' + state.entitlementToken.substring(0, 50) + '...)' : 'no'));
                        log('Auth token present: ' + (state.authToken ? 'yes' : 'no'));
                    }
                }
                catch (e) {
                    log('Error calling VOD API: ' + e);
                }
            }
            // For now, return empty - we'll need to find the correct query or approach
            return new VideoSourceDescriptor([]);
        }
        // Check for HLS manifest at top level
        if (page.hlsManifestUrl) {
            sources.push(new HLSSource({
                url: page.hlsManifestUrl
            }));
            log('Found HLS manifest: ' + page.hlsManifestUrl);
        }
        // Check for DASH manifest at top level
        if (page.dashManifestUrl) {
            sources.push(new DashSource({
                url: page.dashManifestUrl
            }));
            log('Found DASH manifest: ' + page.dashManifestUrl);
        }
        // Check nested structures (player, asset, etc.)
        const player = page.player || page.asset?.player || page.movie?.player || page.episode?.player;
        if (player) {
            if (player.hlsManifestUrl && !sources.find(s => s.url === player.hlsManifestUrl)) {
                sources.push(new HLSSource({
                    url: player.hlsManifestUrl
                }));
                log('Found HLS manifest in player: ' + player.hlsManifestUrl);
            }
            if (player.dashManifestUrl && !sources.find(s => s.url === player.dashManifestUrl)) {
                sources.push(new DashSource({
                    url: player.dashManifestUrl
                }));
                log('Found DASH manifest in player: ' + player.dashManifestUrl);
            }
            // Check for streaming URLs
            if (player.streamingUrl) {
                if (player.streamingUrl.includes('.m3u8')) {
                    sources.push(new HLSSource({
                        url: player.streamingUrl
                    }));
                }
                else if (player.streamingUrl.includes('.mpd')) {
                    sources.push(new DashSource({
                        url: player.streamingUrl
                    }));
                }
                log('Found streaming URL: ' + player.streamingUrl);
            }
            // Check for playback configuration
            if (player.playbackConfig) {
                const config = player.playbackConfig;
                if (config.hlsUrl) {
                    sources.push(new HLSSource({
                        url: config.hlsUrl
                    }));
                    log('Found HLS URL in playbackConfig: ' + config.hlsUrl);
                }
                if (config.dashUrl) {
                    sources.push(new DashSource({
                        url: config.dashUrl
                    }));
                    log('Found DASH URL in playbackConfig: ' + config.dashUrl);
                }
            }
        }
        // Log full response structure for debugging if no sources found
        if (sources.length === 0) {
            log('No video sources found. Player response structure: ' + JSON.stringify(Object.keys(page)).substring(0, 500));
            log('Full page data (first 2000 chars): ' + JSON.stringify(page).substring(0, 2000));
            if (page.player) {
                log('Player keys: ' + JSON.stringify(Object.keys(page.player)).substring(0, 500));
                log('Player data (first 2000 chars): ' + JSON.stringify(page.player).substring(0, 2000));
            }
            if (page.asset) {
                log('Asset keys: ' + JSON.stringify(Object.keys(page.asset)).substring(0, 500));
                if (page.asset.player) {
                    log('Asset.player keys: ' + JSON.stringify(Object.keys(page.asset.player)).substring(0, 500));
                    log('Asset.player data (first 2000 chars): ' + JSON.stringify(page.asset.player).substring(0, 2000));
                }
            }
            if (page.movie) {
                log('Movie keys: ' + JSON.stringify(Object.keys(page.movie)).substring(0, 500));
                if (page.movie.player) {
                    log('Movie.player keys: ' + JSON.stringify(Object.keys(page.movie.player)).substring(0, 500));
                }
            }
            // Also check the root data structure
            log('Root data keys: ' + JSON.stringify(Object.keys(data || {})).substring(0, 500));
        }
        return new VideoSourceDescriptor(sources);
    }
    catch (e) {
        log('Error extracting video sources: ' + e);
        return new VideoSourceDescriptor([]);
    }
}
function getEpisodeDetails(url, assetId) {
    log('getEpisodeDetails for: ' + assetId);
    // Extract the full path for the query
    const pathMatch = url.match(/\/serien\/[^?]+/);
    const path = pathMatch ? pathMatch[0] : '';
    if (!path) {
        throw new ScriptException('Could not extract path from URL');
    }
    // Query for episode details
    const [error, data] = executeGqlQuery({
        ...EPISODE_DETAIL_PAGE_QUERY,
        variables: {
            path: path
        }
    });
    if (error) {
        throw new ScriptException('Failed to get episode details: ' + error.status);
    }
    const asset = data?.page?.asset;
    if (!asset) {
        throw new ScriptException('No asset data in response');
    }
    // Parse episode details
    const episode = asset.episode || {};
    const series = asset.series || {};
    const brand = series.brand || asset.brand || {};
    // Extract video ID from episode data (needed for entitlement token)
    // Episode ID is asset.id, but video ID might be asset.video.id or asset.id itself
    const videoId = asset.video?.id || asset.videoId || asset.id || assetId;
    log('Episode ID: ' + (asset.id || assetId) + ', Video ID: ' + videoId);
    // Extract video sources - pass video ID, not episode ID
    const videoSources = extractVideoSources(path, videoId, false);
    // Extract date - check multiple possible fields
    let uploadDate = 0;
    if (asset.publicationDate) {
        uploadDate = Math.floor(new Date(asset.publicationDate).getTime() / 1000);
    }
    else if (asset.releaseDate) {
        uploadDate = Math.floor(new Date(asset.releaseDate).getTime() / 1000);
    }
    else if (asset.productionYear) {
        // If only year is available, use January 1st of that year
        uploadDate = Math.floor(new Date(asset.productionYear, 0, 1).getTime() / 1000);
    }
    // Extract duration - check multiple possible fields
    let duration = 0;
    if (asset.duration) {
        duration = asset.duration;
    }
    else if (asset.video?.duration) {
        duration = asset.video.duration;
    }
    else if (episode.duration) {
        duration = episode.duration;
    }
    else if (typeof asset.duration === 'string') {
        // If duration is in ISO8601 format (PT1H30M), parse it
        duration = parseISO8601Duration(asset.duration);
    }
    const videoDetails = {
        id: new PlatformID(PLATFORM, asset.id || assetId, config.id, 3),
        name: asset.title || episode.title || 'Unknown Episode',
        thumbnails: new Thumbnails([
            new Thumbnail((asset.heroLandscapeImage || asset.images?.heroLandscape)
                ? buildImageUrl(asset.heroLandscapeImage || asset.images?.heroLandscape || '', 'nextgen-web-herolandscape-1920x')
                : (asset.heroPortraitImage || asset.images?.heroPortrait)
                    ? buildImageUrl(asset.heroPortraitImage || asset.images?.heroPortrait || '', 'nextgen-web-heroportrait-243x365')
                    : '', 0)
        ]),
        author: new PlatformAuthorLink(new PlatformID(PLATFORM, brand.id || '', config.id, 3), brand.name || '', brand.id ? `${BASE_URL}/mediatheken/${brand.id}` : '', brand.logo ? `https://img.joyn.de/${brand.logo}/profile:nextgen-web-brand-150x.webp` : '', 0),
        uploadDate: uploadDate,
        duration: duration,
        viewCount: 0,
        url: url,
        isLive: false,
        description: asset.description || episode.description || '',
        video: videoSources,
        rating: new RatingLikes(0),
        subtitles: []
    };
    log('Mapped episode details: ' + asset.title);
    // Log full content details response
    try {
        const serialized = serializeContentDetails(videoDetails);
        const detailsStr = JSON.stringify(serialized, null, 2);
        log('Full ContentDetails Response (Episode):\n' + detailsStr);
    }
    catch (e) {
        log('Failed to serialize content details: ' + e);
        log('ContentDetails keys: ' + Object.keys(videoDetails).join(', '));
    }
    return new PlatformVideoDetails(videoDetails);
}
function getMovieDetails(url, assetId) {
    log('getMovieDetails for: ' + assetId);
    // Extract the full path for the query (movies use /filme/ path)
    const pathMatch = url.match(/\/filme\/[^?]+/);
    const path = pathMatch ? pathMatch[0] : '';
    if (!path) {
        throw new ScriptException('Could not extract path from URL');
    }
    // Use the movie-specific detail query
    const [error, data] = executeGqlQuery({
        ...PAGE_MOVIE_DETAIL_QUERY,
        variables: {
            path: path
        }
    });
    if (error) {
        throw new ScriptException('Failed to get movie details: ' + error.status);
    }
    // Check different possible response structures for movies
    // The episode query might not work for movies - the page structure might be different
    let asset = data?.page?.asset || data?.asset;
    // If no asset in page, the movie might be in a different location
    // Some GraphQL queries return movies directly, not nested in page.asset
    if (!asset && data?.page) {
        // Check if the page itself has movie data
        const page = data.page;
        if (page.__typename === 'MoviePage' || page.movie) {
            asset = page.movie || page;
        }
        else if (page.path) {
            // The page only has path, which means we need a different query
            // For now, try to construct basic details from what we have
            log('Movie page only has path, using fallback details');
            // We'll need to find a movie-specific query or use search/landing page data
            throw new ScriptException('Movie detail query not available. Page structure: ' + JSON.stringify(Object.keys(page)));
        }
    }
    if (!asset) {
        log('Movie query response structure: ' + JSON.stringify(Object.keys(data || {})));
        if (data?.page) {
            log('Page keys: ' + JSON.stringify(Object.keys(data.page)));
        }
        throw new ScriptException('No asset data in response');
    }
    // Parse movie details (similar to episode but without series/episode info)
    const brand = asset.brand || {};
    // Extract video ID from movie data (needed for entitlement token)
    // Movie ID is asset.id, but video ID is asset.video.id
    const videoId = asset.video?.id || asset.videoId || asset.id || assetId;
    log('Movie ID: ' + (asset.id || assetId) + ', Video ID: ' + videoId);
    // Extract video sources (movies) - pass video ID, not movie ID
    const videoSources = extractVideoSources(path, videoId, true);
    // Build thumbnail - GraphQL returns heroImageDesktop, heroImageMobile, primaryImage (object), cardImage
    // primaryImage might be an object, so extract the path if it's an object
    let imagePath;
    // Try heroImageDesktop first (landscape)
    if (asset.heroImageDesktop) {
        imagePath = typeof asset.heroImageDesktop === 'string' ? asset.heroImageDesktop : asset.heroImageDesktop.path || asset.heroImageDesktop.url;
    }
    // Then try heroImageMobile (portrait)
    else if (asset.heroImageMobile) {
        imagePath = typeof asset.heroImageMobile === 'string' ? asset.heroImageMobile : asset.heroImageMobile.path || asset.heroImageMobile.url;
    }
    // Then try primaryImage (might be object)
    else if (asset.primaryImage) {
        imagePath = typeof asset.primaryImage === 'string' ? asset.primaryImage : asset.primaryImage.path || asset.primaryImage.url;
    }
    // Then try cardImage
    else if (asset.cardImage) {
        imagePath = typeof asset.cardImage === 'string' ? asset.cardImage : asset.cardImage.path || asset.cardImage.url;
    }
    // Fallback to old field names for compatibility
    else if (asset.heroLandscapeImage || asset.images?.heroLandscape) {
        imagePath = asset.heroLandscapeImage || asset.images?.heroLandscape;
    }
    else if (asset.heroPortraitImage || asset.images?.heroPortrait) {
        imagePath = asset.heroPortraitImage || asset.images?.heroPortrait;
    }
    // Determine profile based on which image we're using
    const profile = asset.heroImageDesktop || (asset.heroLandscapeImage || asset.images?.heroLandscape)
        ? 'nextgen-web-herolandscape-1920x'
        : 'nextgen-web-heroportrait-243x365';
    const thumbnailUrl = imagePath ? buildImageUrl(imagePath, profile) : '';
    // Extract date - check multiple possible fields
    let uploadDate = 0;
    if (asset.publicationDate) {
        uploadDate = Math.floor(new Date(asset.publicationDate).getTime() / 1000);
    }
    else if (asset.releaseDate) {
        uploadDate = Math.floor(new Date(asset.releaseDate).getTime() / 1000);
    }
    else if (asset.productionYear) {
        // If only year is available, use January 1st of that year
        uploadDate = Math.floor(new Date(asset.productionYear, 0, 1).getTime() / 1000);
    }
    // Extract duration - check multiple possible fields
    let duration = 0;
    if (asset.duration) {
        duration = asset.duration;
    }
    else if (asset.video?.duration) {
        duration = asset.video.duration;
    }
    else if (typeof asset.duration === 'string') {
        // If duration is in ISO8601 format (PT1H30M), parse it
        duration = parseISO8601Duration(asset.duration);
    }
    log('Date fields - publicationDate: ' + (asset.publicationDate || 'NOT PRESENT') + ', releaseDate: ' + (asset.releaseDate || 'NOT PRESENT') + ', productionYear: ' + (asset.productionYear || 'NOT PRESENT') + ', uploadDate: ' + uploadDate);
    log('Duration fields - asset.duration: ' + (asset.duration || 'NOT PRESENT') + ', asset.video?.duration: ' + (asset.video?.duration || 'NOT PRESENT') + ', final duration: ' + duration);
    const videoDetails = {
        id: new PlatformID(PLATFORM, asset.id || assetId, config.id, 3),
        name: asset.title || assetId,
        thumbnails: new Thumbnails([
            new Thumbnail(thumbnailUrl, 0)
        ]),
        author: new PlatformAuthorLink(new PlatformID(PLATFORM, brand.id || '', config.id, 3), brand.name || '', brand.id ? `${BASE_URL}/mediatheken/${brand.id}` : '', brand.logo ? `https://img.joyn.de/${brand.logo}/profile:nextgen-web-brand-150x.webp` : '', 0),
        uploadDate: uploadDate,
        duration: duration,
        viewCount: 0,
        url: url,
        isLive: false,
        description: asset.description || '',
        video: videoSources,
        rating: new RatingLikes(0),
        subtitles: []
    };
    log('Mapped movie details: ' + asset.title);
    // Log full content details response
    try {
        const serialized = serializeContentDetails(videoDetails);
        const detailsStr = JSON.stringify(serialized, null, 2);
        log('Full ContentDetails Response (Movie):\n' + detailsStr);
    }
    catch (e) {
        log('Failed to serialize content details: ' + e);
        log('ContentDetails keys: ' + Object.keys(videoDetails).join(', '));
    }
    return new PlatformVideoDetails(videoDetails);
}
function getVideoDetailsById(url, videoId) {
    log('getVideoDetailsById for: ' + videoId);
    // For /video/ URLs, we only have the video ID, not a path
    // Try to extract video sources directly using the VOD API
    // We'll create minimal video details since we don't have full metadata
    // Extract video sources using the video ID directly
    const videoSources = extractVideoSourcesById(videoId);
    // Create minimal video details
    const videoDetails = {
        id: new PlatformID(PLATFORM, videoId, config.id, 3),
        name: 'Video ' + videoId, // Fallback name since we don't have metadata
        thumbnails: new Thumbnails([new Thumbnail('', 0)]),
        author: new PlatformAuthorLink(new PlatformID(PLATFORM, 'joyn', config.id, 3), 'Joyn', BASE_URL, '', 0),
        uploadDate: 0,
        duration: 0,
        viewCount: 0,
        url: url,
        isLive: false,
        description: '',
        video: videoSources,
        rating: new RatingLikes(0),
        subtitles: []
    };
    log('Mapped video details by ID: ' + videoId);
    // Log full content details response
    try {
        const serialized = serializeContentDetails(videoDetails);
        const detailsStr = JSON.stringify(serialized, null, 2);
        log('Full ContentDetails Response (Video by ID):\n' + detailsStr);
    }
    catch (e) {
        log('Failed to serialize content details: ' + e);
        log('ContentDetails keys: ' + Object.keys(videoDetails).join(', '));
    }
    return new PlatformVideoDetails(videoDetails);
}
function extractVideoSourcesById(videoId) {
    log('Extracting video sources by ID: ' + videoId);
    try {
        // Get entitlement token if needed
        if (!isEntitlementTokenValid()) {
            refreshEntitlementToken(videoId);
        }
        if (!state.entitlementToken) {
            log('No entitlement token available for VOD API');
            return new VideoSourceDescriptor([]);
        }
        // Refresh auth token if needed
        if (!isTokenValid()) {
            refreshAnonymousToken();
        }
        if (!state.authToken) {
            log('No auth token available for VOD API');
            return new VideoSourceDescriptor([]);
        }
        // Use the default HTTP client to maintain session state
        const httpClient = http.getDefaultClient(false);
        const vodUrl = `https://api.vod-prd.s.joyn.de/v1/asset/${videoId}/playlist`;
        // Build request body
        const requestBody = {
            manufacturer: 'unknown',
            platform: 'browser',
            maxSecurityLevel: 1,
            streamingFormat: 'dash',
            model: 'unknown',
            protectionSystem: 'widevine',
            enableDolbyAudio: false,
            enableSubtitles: true,
            variantName: 'default'
        };
        // Build headers matching browser exactly
        const headers = {
            ...applyCommonHeaders(),
            'sec-fetch-site': 'same-site',
            'sec-fetch-mode': 'cors',
            'sec-fetch-dest': 'empty',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.authToken}`,
            'X-Entitlement-Token': state.entitlementToken
        };
        log('Trying VOD API endpoint: ' + vodUrl + ' (videoId: ' + videoId + ', entitlementToken: present)');
        log('Request body: ' + JSON.stringify(requestBody));
        log('Request headers: Matching browser exactly (sec-fetch-*, sec-ch-ua, priority, etc.)');
        log('Using default HTTP client to maintain session state');
        const response = httpClient.POST(vodUrl, JSON.stringify(requestBody), headers, false);
        if (response.status === 200) {
            try {
                const vodData = JSON.parse(response.body);
                // Extract manifest URLs from response
                const sources = [];
                if (vodData.hlsManifestUrl) {
                    sources.push({
                        url: vodData.hlsManifestUrl,
                        mimeType: 'application/vnd.apple.mpegurl',
                        quality: 'auto'
                    });
                }
                if (vodData.dashManifestUrl) {
                    sources.push({
                        url: vodData.dashManifestUrl,
                        mimeType: 'application/dash+xml',
                        quality: 'auto'
                    });
                }
                if (sources.length > 0) {
                    log('Successfully extracted ' + sources.length + ' video sources from VOD API');
                    return new VideoSourceDescriptor(sources);
                }
            }
            catch (e) {
                log('Failed to parse VOD API response: ' + e);
            }
        }
        else {
            log('VOD API returned ' + response.status + ': ' + response.body);
        }
    }
    catch (e) {
        log('Error extracting video sources by ID: ' + e);
    }
    return new VideoSourceDescriptor([]);
}
// Helper Functions for Playlists
function getSeriesAsVideoDetails(url) {
    log('getSeriesAsVideoDetails for: ' + url);
    const seriesSlug = getSeriesSlugFromUrl(url);
    if (!seriesSlug) {
        throw new ScriptException('Could not extract series slug from URL: ' + url);
    }
    // Extract path from URL
    const pathMatch = url.match(/\/serien\/[^?]+/);
    const path = pathMatch ? pathMatch[0] : '/serien/' + seriesSlug;
    const [error, data] = executeGqlQuery({
        ...LANDING_PAGE_QUERY,
        variables: {
            path: path,
            variation: 'Default'
        }
    });
    if (error) {
        throw new ScriptException('Failed to get series data: ' + error.status);
    }
    const page = data?.page;
    if (!page) {
        throw new ScriptException('No page data in response');
    }
    // Extract series metadata from page
    const asset = page.asset || {};
    const series = asset.series || asset;
    const brand = series.brand || {};
    // Format series as video details (workaround for Grayjay routing issue)
    const videoDetails = {
        id: new PlatformID(PLATFORM, series.id || seriesSlug, config.id, 3),
        name: series.title || 'Unknown Series',
        thumbnails: new Thumbnails([
            new Thumbnail((series.heroPortraitImage || series.images?.heroPortrait)
                ? buildImageUrl(series.heroPortraitImage || series.images?.heroPortrait || '', 'nextgen-web-heroportrait-243x365')
                : (series.heroLandscapeImage || series.images?.heroLandscape)
                    ? buildImageUrl(series.heroLandscapeImage || series.images?.heroLandscape || '', 'nextgen-web-herolandscape-1920x')
                    : '', 0)
        ]),
        author: new PlatformAuthorLink(new PlatformID(PLATFORM, brand.id || '', config.id, 3), brand.name || '', brand.id ? `${BASE_URL}/mediatheken/${brand.id}` : '', brand.logo ? `https://img.joyn.de/${brand.logo}/profile:nextgen-web-brand-150x.webp` : '', 0),
        url: url,
        description: series.description || asset.description || '',
        duration: 0, // Series don't have a single duration
        releaseDate: series.releaseDate ? new Date(series.releaseDate).getTime() : 0,
        genres: series.genres?.map((g) => g.name) || [],
        isLive: false,
        seriesId: undefined, // This IS the series
        episodeId: undefined,
        seasonId: undefined,
        rating: new RatingLikes(series.fskRating || 0),
        cast: series.cast?.map((c) => c.name) || [],
        directors: series.directors?.map((d) => d.name) || [],
        writers: series.writers?.map((w) => w.name) || [],
        productionCompanies: series.productionCompanies?.map((p) => p.name) || [],
        video: new VideoSourceDescriptor([]), // Series don't have video sources
        subtitles: []
    };
    log('Mapped series as video details: ' + series.title);
    // Log full content details response
    try {
        const serialized = serializeContentDetails(videoDetails);
        const detailsStr = JSON.stringify(serialized, null, 2);
        log('Full ContentDetails Response (Series as Video):\n' + detailsStr);
    }
    catch (e) {
        log('Failed to serialize content details: ' + e);
        log('ContentDetails keys: ' + Object.keys(videoDetails).join(', '));
    }
    return new PlatformVideoDetails(videoDetails);
}
function getSeriesPlaylist(url) {
    log('getSeriesPlaylist for: ' + url);
    const seriesSlug = getSeriesSlugFromUrl(url);
    if (!seriesSlug) {
        throw new ScriptException('Could not extract series slug from URL: ' + url);
    }
    // For now, use the landing page query to get series info
    // Extract path from URL
    const pathMatch = url.match(/\/serien\/[^?]+/);
    const path = pathMatch ? pathMatch[0] : '/serien/' + seriesSlug;
    const [error, data] = executeGqlQuery({
        ...LANDING_PAGE_QUERY,
        variables: {
            path: path,
            variation: 'Default'
        }
    });
    if (error) {
        throw new ScriptException('Failed to get series data: ' + error.status);
    }
    const page = data?.page;
    if (!page) {
        throw new ScriptException('No page data in response');
    }
    // Extract series metadata from page
    const asset = page.asset || {};
    const series = asset.series || asset;
    const brand = series.brand || {};
    const videoCount = series.numberOfEpisodes || 0;
    const thumbnail = (series.heroPortraitImage || series.images?.heroPortrait)
        ? buildImageUrl(series.heroPortraitImage || series.images?.heroPortrait || '', 'nextgen-web-heroportrait-243x365')
        : (series.heroLandscapeImage || series.images?.heroLandscape)
            ? buildImageUrl(series.heroLandscapeImage || series.images?.heroLandscape || '', 'nextgen-web-herolandscape-1920x')
            : '';
    const playlistDetails = {
        id: new PlatformID(PLATFORM, series.id || seriesSlug, config.id, 3),
        name: series.title || 'Unknown Series',
        author: new PlatformAuthorLink(new PlatformID(PLATFORM, brand.id || '', config.id, 3), brand.name || '', brand.id ? `${BASE_URL}/mediatheken/${brand.id}` : '', brand.logo ? `https://img.joyn.de/${brand.logo}/profile:nextgen-web-brand-150x.webp` : '', 0),
        thumbnail: thumbnail,
        videoCount: videoCount,
        url: url
    };
    log('Mapped series playlist: ' + series.title);
    return new PlatformPlaylistDetails(playlistDetails);
}
// Plugin loaded - only log if log function is available (may not be during prompt phase)
try {
    if (typeof log === 'function') {
        log('Joyn plugin loaded');
    }
}
catch (e) {
    // Silently ignore - log may not be available during plugin prompt/validation phase
}
