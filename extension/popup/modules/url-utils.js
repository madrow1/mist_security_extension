// URL parsing utilities
export const URLUtils = {
    extractOrgId(url) {
        const match = url.match(/[?&]org_id=([0-9a-fA-F-]{36})/);
        return match ? match[1] : null;
    },

    extractSiteId(url) {
        const match = url.match(/[?&]site_id=([0-9a-fA-F-]{36})/);
        return match ? match[1] : null;
    },

    getApiUrl(hostname) {
        return hostname.replace(/^(manage|integration)\./, 'api.') || 'api.mist.com';
    }
};