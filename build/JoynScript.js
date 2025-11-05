'use strict';

const BASE_URL = 'https://www.joyn.de';
const BASE_URL_API = 'https://api.joyn.de/graphql';
const BASE_URL_AUTH = 'https://auth.joyn.de/auth/anonymous';
const PLATFORM = 'Joyn';
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36';
// URL Patterns
const REGEX_VIDEO_URL = /^https:\/\/(?:www\.)?joyn\.de\/(serien|filme)\/[a-zA-Z0-9-]+$/i;
const REGEX_SERIES_URL = /^https:\/\/(?:www\.)?joyn\.de\/serien\/[a-zA-Z0-9-]+$/i;
const REGEX_MOVIE_URL = /^https:\/\/(?:www\.)?joyn\.de\/filme\/[a-zA-Z0-9-]+$/i;
const REGEX_CHANNEL_URL = /^https:\/\/(?:www\.)?joyn\.de\/play\/live-tv\/[a-zA-Z0-9-]+$/i;
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

function applyCommonHeaders() {
    return { ...DEFAULT_HEADERS };
}
function log(message) {
    console.log(`[Joyn] ${message}`);
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

let config;
const state = {
    authToken: '',
    authTokenExpiration: 0,
    userId: ''
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
        userId: state.userId
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
    // TODO: Implement search using Joyn's GraphQL API
    return new VideoPager([], false, {});
};
source.isChannelUrl = function (url) {
    return REGEX_CHANNEL_URL.test(url);
};
source.isContentDetailsUrl = function (url) {
    return REGEX_VIDEO_URL.test(url) ||
        REGEX_SERIES_URL.test(url) ||
        REGEX_MOVIE_URL.test(url);
};
source.getChannel = function (url) {
    log('getChannel called: ' + url);
    throw new ScriptException('Not implemented yet');
};
source.getChannelContents = function (url, type, order, filters) {
    log('getChannelContents called: ' + url);
    throw new ScriptException('Not implemented yet');
};
source.getContentDetails = function (url) {
    log('getContentDetails called: ' + url);
    throw new ScriptException('Not implemented yet');
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
log('Joyn plugin loaded');
