// Configuration
const CONFIG = {
    // Use environment variable or default to localhost for development
    apiAddress: '127.0.0.1', // In production, this should be configurable
    apiPort: '8510',
    timeout: 10000 // 10 seconds
};

// Browser compatibility
var browser_name = "ffx";
if (typeof browser === "undefined") {
    var browser = chrome;
    browser_name = "chrome";
}

// URL matching patterns
const URL_PATTERNS = {
    org: /https:\/\/(manage|integration|manage-staging)\.(?<host>[a-z0-9.]*(mist|mistsys|mist-federal)\.com)\/admin\/\?org_id=(?<org_id>[0-9a-f-]*)#!/yis,
    msp: /https:\/\/(manage|integration|manage-staging)\.(?<host>[a-z0-9.]*(mist|mistsys|mist-federal)\.com)\/msp\/\?msp=(?<msp_id>[0-9a-f-]*)#!/yis,
    api: /https:\/\/api\.(?<host>[a-z0-9.]*(mist|mistsys|mist-federal)\.com)\/api\/v1\/(?<scope>const|installer|invite|login|logout|mobile|msps|orgs|recover|register|self|sites|utils)/yis,
    juniper: /https:\/\/(dc|jsi|routing)(\.stage)?\.ai\.juniper\.net\/+admin\/\?org_id=(?<org_id>[0-9a-f-]*)#!/yis
};

// Badge colors
const BADGE_COLORS = {
    org: "#4caf50",
    api: "#f38019", 
    juniper: "#0095a9"
};

// Event listeners
browser.tabs.onActivated.addListener(info => {
    getUrl(info.tabId);
});

browser.tabs.onUpdated.addListener((tab) => {
    getUrl(tab);
});

function getUrl(tabId) {
    setTimeout(() => {
        browser.tabs.get(tabId)
            .then(tab => {
                if (tab && tab.url) {
                    checkUrl(tab.url);
                } else {
                    // Retry if tab is not ready
                    getUrl(tabId);
                }
            })
            .catch(err => {
                console.error('Error getting tab URL:', err);
            });
    }, 100);
}

// Validates the URL that is in the tab, if that URL is a Mist URL then it should be updated to include a check mark. This does not happen reliably 
function checkUrl(tabUrl) {
    try {
        const org = URL_PATTERNS.org.exec(tabUrl);
        const msp = URL_PATTERNS.msp.exec(tabUrl);
        const api = URL_PATTERNS.api.exec(tabUrl);
        const juniper = URL_PATTERNS.juniper.exec(tabUrl);

        if (org || msp) {
            apiBadge(BADGE_COLORS.org);
        } else if (api) {
            apiBadge(BADGE_COLORS.api);
        } else if (juniper) {
            apiBadge(BADGE_COLORS.juniper);
        } else {
            apiBadge(null);
        }
    } catch (error) {
        console.error('Error checking URL:', error);
        apiBadge(null);
    }
}

// This is the function cally by checkURL to actually update the colours 
function apiBadge(color) {
    try {
        if (color) {
            browser.action.setBadgeBackgroundColor({ color: color });
            browser.action.setBadgeText({ "text": "\u2713" });
        } else {
            browser.action.setBadgeText({ "text": "" });
        }
    } catch (error) {
        console.error('Error setting badge:', error);
    }
}

// Validate input parameters
function validateInput(action, request) {
    switch (action) {
        case 'check-existing-data':
            if (!request.org_id || request.org_id.length !== 36) {
                return 'Invalid organization ID';
            }
            break;
        case 'data':
            if (!request.org_id || !request.api_key) {
                return 'Missing required fields';
            }
            if (request.org_id.length !== 36) {
                return 'Invalid ID format';
            }
            if (request.api_key.length < 10) {
                return 'Invalid API key format';
            }
            break;
        case 'purge-api-key':
            if (!request.org_id || request.org_id.length !== 36) {
                return 'Invalid organization ID';
            }
            break;
    }
    return null;
}

// Build API endpoint and options
function buildApiRequest(action, request) {
    const baseUrl = `http://${CONFIG.apiAddress}:${CONFIG.apiPort}/api`;
    let endpoint, fetchOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };

    switch (action) {
        case 'pie':
            endpoint = `${baseUrl}/pie-chart?org_id=${encodeURIComponent(request.org_id || '')}`;
            fetchOptions.method = 'GET';
            break;
        case 'histogram':
            endpoint = `${baseUrl}/histogram?org_id=${encodeURIComponent(request.org_id || '')}`;
            fetchOptions.method = 'GET';
            break;
        case 'switches':
            endpoint = `${baseUrl}/switch-list?org_id=${encodeURIComponent(request.org_id || '')}`;
            fetchOptions.method = 'GET';
            break;
        case 'aps':
            endpoint = `${baseUrl}/ap-list?org_id=${encodeURIComponent(request.org_id || '')}`;
            fetchOptions.method = 'GET';
            break;
        case 'settings':
            endpoint = `${baseUrl}/settings`;
            fetchOptions.method = 'GET';
            break;
        case 'check-existing-data':
            endpoint = `${baseUrl}/check-existing-data?org_id=${encodeURIComponent(request.org_id)}`;
            fetchOptions.method = 'GET';
            break;
        case 'data':
            endpoint = `${baseUrl}/data`;
            fetchOptions.method = 'POST';
            fetchOptions.headers = { 'Content-Type': 'application/json' };
            fetchOptions.body = JSON.stringify({
                // include the org/api_key/url in the mody instead of the query string.
                org_id: request.org_id,
                api_key: request.api_key,
                api_url: request.api_url
            });
            break;
        case 'fetch-new':
            console.log("Attempting to fetch new data");
            endpoint = `${baseUrl}/fetch-new-data?org_id=${encodeURIComponent(request.org_id)}`;
            fetchOptions.method = 'POST';
            fetchOptions.headers = { 'Content-Type': 'application/json' };
            fetchOptions.body = JSON.stringify({
                org_id: request.org_id
            });
            break;
        case 'purge-api-key':
            endpoint = `${baseUrl}/purge-api-key`;
            fetchOptions.method = 'POST';
            fetchOptions.headers = { 'Content-Type': 'application/json' };
            fetchOptions.body = JSON.stringify({ 
                org_id: request.org_id 
            });
            break;
        case 'get-site-id':
            endpoint = `http://${CONFIG.apiAddress}:${CONFIG.apiPort}/api/get-site-id?org_id=${encodeURIComponent(request.org_id)}`;
            fetchOptions.method = 'GET';
            break;
        default:
            throw new Error('Unknown action');
    }

    return { endpoint, fetchOptions };
}

// Handle API errors
function handleApiError(error, action) {
    let errorMessage = error.message;
    
    if (error.name === 'AbortError') {
        errorMessage = 'Request timeout - please try again';
    } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Unable to connect to API server. Please check if the server is running.';
    } else if (error.message.includes('NetworkError')) {
        errorMessage = 'Network error - please check your connection';
    }
    
    console.error(`API Error for action ${action}:`, error);
    return errorMessage;
}

// Main message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const { action } = request;
    
    // Validate action
    if (!action) {
        sendResponse({ success: false, error: 'No action specified' });
        return;
    }

    // Validate input parameters
    const validationError = validateInput(action, request);
    if (validationError) {
        sendResponse({ success: false, error: validationError });
        return;
    }

    try {
        const { endpoint, fetchOptions } = buildApiRequest(action, request);
        
        // Set up timeout and abort controller
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
        fetchOptions.signal = controller.signal;

        // Make API request
        fetch(endpoint, fetchOptions)
            .then(response => {
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    // Handle specific HTTP status codes
                    let errorMessage = `HTTP ${response.status}`;
                    switch (response.status) {
                        case 400:
                            errorMessage = 'Bad request - please check your input';
                            break;
                        case 404:
                            errorMessage = 'API endpoint not found';
                            break;
                        case 409:
                            errorMessage = 'Data already exists';
                            break;
                        case 500:
                            errorMessage = 'Server error - please try again later';
                            break;
                    }
                    throw new Error(errorMessage);
                }
                
                return response.json();
            })
            .then(data => {
                sendResponse({ 
                    success: true, 
                    data: data,
                    action: action
                });
            })
            .catch(error => {
                clearTimeout(timeoutId);
                const errorMessage = handleApiError(error, action);
                sendResponse({ 
                    success: false, 
                    error: errorMessage,
                    action: action 
                });
            });

    } catch (error) {
        console.error(`Error processing action ${action}:`, error);
        sendResponse({ 
            success: false, 
            error: error.message || 'Unknown error occurred',
            action: action
        });
    }

    // Keep the message channel open for async response
    return true;
});