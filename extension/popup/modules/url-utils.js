// URL parsing utilities
export const URLUtils = {
    extractOrgId(url) {
        if (!url || typeof url !== 'string') {
            return null;
        }

        const uuidRegex = /[?&]org_id=([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/;
        const match = url.match(uuidRegex);
        return match ? match[1] : null;
    },

    extractSiteId(url) {
        if (!url || typeof url !== 'string') {
            return null;
        }

        const uuidRegex = /[?&]site_id=([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/;
        const match = url.match(uuidRegex);
        return match ? match[1] : null;
    },

    getApiUrl(hostname) {
        if (!hostname || typeof hostname !== 'string') {
            return 'api.mist.com';
        }

        try {
            // Handle different Mist domains
            if (hostname.includes('mist.com')) {
                return hostname.replace(/^(manage|integration|dashboard)\./, 'api.');
            }
            
            // Default fallback
            return 'api.mist.com';
        } catch (error) {
            console.error('Error mapping API URL:', error);
            return 'api.mist.com';
        }
    },

    async parseCurrentUrl() {
        try {
            const hasPermission = await new Promise(resolve => {
                chrome.permissions.contains({ permissions: ['tabs'] }, resolve);
            });

            if (!hasPermission) {
                throw new Error('Extension does not have tab permissions');
            }
        } catch (error) {
            console.error('Permission check failed:', error);
            return null;
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('URL parsing timeout'));
            }, 5000);

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                clearTimeout(timeout);

                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                if (!tabs || !Array.isArray(tabs) || tabs.length === 0) {
                    resolve(null);
                    return;
                }

                const tab = tabs[0];
                if (!tab || !tab.url) {
                    resolve(null);
                    return;
                }

                try {
                    const url = new URL(tab.url);
                    
                    if (!this.isMistDomain(url.hostname)) {
                        resolve(null);
                        return;
                    }

                    const result = {
                        hostname: url.hostname,
                        fullURL: tab.url,
                        orgId: this.extractOrgId(tab.url),
                        siteId: this.extractSiteId(tab.url),
                        apiUrl: this.getApiUrl(url.hostname),
                        pathname: url.pathname,
                        search: url.search
                    };

                    if (result.orgId && !this.isValidUUID(result.orgId)) {
                        console.warn('Invalid org_id format detected:', result.orgId);
                        result.orgId = null;
                    }

                    if (result.siteId && !this.isValidUUID(result.siteId)) {
                        console.warn('Invalid site_id format detected:', result.siteId);
                        result.siteId = null;
                    }

                    resolve(result);

                } catch (error) {
                    console.error('Error parsing URL:', error);
                    resolve(null);
                }
            });
        });
    },

    isMistDomain(hostname) {
        if (!hostname || typeof hostname !== 'string') {
            return false;
        }

        const mistDomains = [
            'manage.mist.com',
            'api.mist.com',
            'integration.mist.com',
            'dashboard.mist.com',
            'mist.com'
        ];

        return mistDomains.some(domain => 
            hostname === domain || hostname.endsWith('.' + domain)
        );
    },

    isValidUUID(uuid) {
        if (!uuid || typeof uuid !== 'string') {
            return false;
        }

        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        return uuidRegex.test(uuid);
    },

    extractPathInfo(url) {
        if (!url || typeof url !== 'string') {
            return null;
        }

        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/').filter(segment => segment);

            // Parse common Mist URL patterns
            const pathInfo = {
                segments: pathSegments,
                isOrgPage: pathSegments.includes('orgs'),
                isSitePage: pathSegments.includes('sites'),
                isDevicePage: pathSegments.includes('devices'),
                isConfigPage: pathSegments.includes('config')
            };

            return pathInfo;
        } catch (error) {
            console.error('Error extracting path info:', error);
            return null;
        }
    },

    buildApiUrl(endpoint, orgId, params = {}) {
        if (!endpoint || typeof endpoint !== 'string') {
            throw new Error('Invalid endpoint');
        }

        if (orgId && !this.isValidUUID(orgId)) {
            throw new Error('Invalid organization ID format');
        }

        try {
            let apiUrl = 'https://api.mist.com/api/v1';
            
            if (orgId) {
                apiUrl += `/orgs/${orgId}`;
            }
            
            apiUrl += `/${endpoint.replace(/^\//, '')}`;

            // Add query parameters
            if (params && Object.keys(params).length > 0) {
                const searchParams = new URLSearchParams();
                Object.entries(params).forEach(([key, value]) => {
                    if (value !== null && value !== undefined) {
                        searchParams.append(key, value.toString());
                    }
                });
                
                if (searchParams.toString()) {
                    apiUrl += '?' + searchParams.toString();
                }
            }

            return apiUrl;
        } catch (error) {
            console.error('Error building API URL:', error);
            throw error;
        }
    },

    async validateCurrentPage() {
        try {
            const urlInfo = await this.parseCurrentUrl();
            
            if (!urlInfo) {
                return {
                    isValid: false,
                    reason: 'Not a Mist page'
                };
            }

            if (!urlInfo.orgId) {
                return {
                    isValid: false,
                    reason: 'No organization ID detected in URL'
                };
            }

            return {
                isValid: true,
                urlInfo: urlInfo
            };
        } catch (error) {
            console.error('Error validating current page:', error);
            return {
                isValid: false,
                reason: 'Error accessing current page',
                error: error.message
            };
        }
    },

    extractAllParams(url) {
        if (!url || typeof url !== 'string') {
            return {};
        }

        try {
            const urlObj = new URL(url);
            const params = {};
            
            for (const [key, value] of urlObj.searchParams.entries()) {
                params[key] = value;
            }
            
            return params;
        } catch (error) {
            console.error('Error extracting URL parameters:', error);
            return {};
        }
    }
};