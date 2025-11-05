'use strict';

const BASE_URL = 'https://www.joyn.de';
const BASE_URL_API = 'https://api.joyn.de/graphql';
const BASE_URL_AUTH = 'https://auth.joyn.de/auth/anonymous';
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

const state = {
    authToken: '',
    authTokenExpiration: 0,
    userId: ''
};
//Source Methods
source.enable = function (conf, settings, saveStateStr) {
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
        // TODO: Parse data and return videos
        return new VideoPager([], false, {});
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
