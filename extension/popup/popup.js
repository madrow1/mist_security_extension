// State management
const AppState = {
    org_id: null,
    site_id: null,
    currentTab: null,
    isLoading: false
};

// DOM elements cache
const DOMElements = {};

// URL parsing utilities
const URLUtils = {
    extractOrgId(url) {
        const match = url.match(/[?&]org_id=([0-9a-fA-F-]{36})/);
        return match ? match[1] : null;
    },

    extractSiteId(url) {
        const match = url.match(/[?&]site_id=([0-9a-fA-F-]{36})/);
        return match ? match[1] : null;
    },

    //matches "manage" in the URL bar and replaces it with "api" to get the local API URL
    getApiUrl(hostname) {
        if (/^manage\./.test(hostname)) {
            return hostname.replace(/^manage\./, 'api.');
        } else if (/^integration\./.test(hostname)) {
            return hostname.replace(/^integration\./, 'api.');
        }
        // if no URL can be found then it will default to api.mist.com
        return 'api.mist.com';
    }
};

// UI utilities, these just make things look nicer
const UIUtils = {
    // Dims the element 
    showLoading(element, text = 'Loading...') {
        if (element) {
            element.textContent = text;
            element.style.opacity = '0.6';
        }
    },

    // Restores the elements opacity 
    hideLoading(element) {
        if (element) {
            element.style.opacity = '1';
        }
    },

    // Displays error messages in red 
    showError(element, message) {
        if (element) {
            element.textContent = `Error: ${message}`;
            element.style.color = '#d32f2f';
        }
    },

    // Displays success messages in green
    showSuccess(element, message) {
        if (element) {
            element.textContent = message;
            element.style.color = '#2e7d32';
        }
    },

    // Resets buttons to their default state
    resetButtonStates() {
        document.querySelectorAll('.action-button').forEach(btn => {
            btn.classList.remove('clicked');
        });
    },

    // Sets the selected button to be "clicked"
    setButtonClicked(button) {
        this.resetButtonStates();
        button.classList.add('clicked');
    }
};

// Validation utilities to validate the org ID and API key.
const ValidationUtils = {
    isValidOrgId(orgId) {
        if (!orgId || typeof orgId !== 'string') return false;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(orgId.trim());
    },

    isValidApiKey(apiKey) {
        // validates api key, if it is not apiKey and not a string then false is returned/ 
        if (!apiKey || typeof apiKey !== 'string') return false;
        return apiKey.trim().length >= 36;
    },

    isValidSiteId(siteId) {
        if (!siteId || typeof siteId !== 'string') return false;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(siteId.trim());
    }
};

// API communication, ues the Chrome extension messaging API to commucate with the backgroun script
const APIClient = {
    sendMessage(action, data = {}) {
        return new Promise((resolve, reject) => {
            const message = { action, ...data };

            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                if (response && response.success) {
                    resolve(response.data);
                } else {
                    reject(new Error(response?.error || 'Unknown error occurred'));
                }
            });
        });
    }
};

// Settings management
const SettingsManager = {
    // cChecks whether the API key exists for the current org_id
    async checkExistingData(orgId) {
        try {
            const response = await APIClient.sendMessage('check-existing-data', { org_id: orgId });
            return response.exists;
        } catch (error) {
            console.error('Error checking existing data:', error);
            throw error;
        }
    },

    // Get site IDs for the organization from database
    async getSiteIds(orgId) {
        try {
            const response = await APIClient.sendMessage('get-site-id', { org_id: orgId });
            console.log(response.siteIds)
            return response.site_ids || [];
        } catch (error) {
            console.error('Error getting site IDs:', error);
            return [];
        }
    },

    // Submits API key data for a specific org and 
    async submitApiKey(orgId, apiKey, apiAddress) {
        if (!ValidationUtils.isValidOrgId(orgId)) {
            throw new Error('Invalid organization ID');
        }

        if (!ValidationUtils.isValidApiKey(apiKey)) {
            throw new Error('API key must be at least 36 characters long');
        }

        try {
            await APIClient.sendMessage('data', {
                org_id: orgId,
                api_key: apiKey,
                api_url: apiAddress
            });
        } catch (error) {
            console.error('Error submitting API key:', error);
            throw error;
        }
    },

    async purgeApiKey(orgId) {
        if (!ValidationUtils.isValidOrgId(orgId)) {
            throw new Error('Invalid organization ID');
        }

        try {
            await APIClient.sendMessage('purge-api-key', { org_id: orgId });
        } catch (error) {
            console.error('Error purging API key:', error);
            throw error;
        }
    },

    updateSettingsUI(exists) {
        const { apiInput, apiSubmitButton, purgeBtn, settingsMenu } = DOMElements;

        if (exists) {
            if (purgeBtn) purgeBtn.style.display = 'inline-block';
            if (apiInput) {
                apiInput.disabled = true;
                apiInput.value = '';
            }
            if (apiSubmitButton) apiSubmitButton.disabled = true;

            this.showMessage('API key already exists for this organization. You cannot add another.', 'info');
        } else {
            if (purgeBtn) purgeBtn.style.display = 'none';
            if (apiInput) apiInput.disabled = false;
            if (apiSubmitButton) apiSubmitButton.disabled = false;

            this.removeMessage('api-exists-msg');
            this.removeMessage('api-purged-msg');
        }
    },

    showMessage(text, type = 'info', id = 'api-exists-msg') {
        const { settingsMenu } = DOMElements;
        if (!settingsMenu) return;

        let msg = document.getElementById(id);
        if (!msg) {
            msg = document.createElement('p');
            msg.id = id;
            msg.className = 'paragraphs';
            settingsMenu.appendChild(msg);
        }

        msg.textContent = text;
        msg.style.color = type === 'error' ? '#d32f2f' : type === 'success' ? '#2e7d32' : '#666';
    },

    removeMessage(id) {
        const msg = document.getElementById(id);
        if (msg) msg.remove();
    },

    obscureApiKey(apiKey) {
        if (!apiKey || apiKey.length <= 8) return '••••••••';
        return apiKey.slice(0, 4) + '••••••••' + apiKey.slice(-4);
    }
};

// Site management
const SiteManager = {
    async updateSiteInfo(orgId, urlSiteId) {
        const { siteidElem } = DOMElements;
        
        if (!siteidElem) return;

        try {
            // If there's a site_id in the URL, use it
            if (urlSiteId && ValidationUtils.isValidSiteId(urlSiteId)) {
                siteidElem.textContent = urlSiteId;
                siteidElem.style.color = '#2e7d32'; // Green for URL-detected site
                AppState.site_id = urlSiteId;
                return;
            }

            // If no site_id in URL but we have org_id, try to get sites from database
            if (orgId && ValidationUtils.isValidOrgId(orgId)) {
                const siteIds = await SettingsManager.getSiteIds(orgId);

                if (siteIds.length > 0) {
                    if (siteIds.length === 1) {
                        siteidElem.textContent = siteIds[0];
                        AppState.site_id = siteIds[0];
                    } else {
                        // Join all site_ids with new lines or commas
                        siteidElem.innerHTML = siteIds.map(id => `<div>${id}</div>`).join('');
                        AppState.site_id = null;
                    }
                    siteidElem.style.color = '#666';

                } else {
                    siteidElem.textContent = 'No sites found';
                    siteidElem.style.color = '#d32f2f'; // Red for no sites
                    AppState.site_id = null;
                }
            } else {
                siteidElem.textContent = 'Null';
                siteidElem.style.color = '#999'; // Gray for null
                AppState.site_id = null;
            }
        } catch (error) {
            console.error('Error updating site info:', error);
            siteidElem.textContent = 'Error loading sites';
            siteidElem.style.color = '#d32f2f';
            AppState.site_id = null;
        }
    }
};

// Tab management
const TabManager = {
    async getCurrentTab() {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                resolve(tabs[0] || null);
            });
        });
    },

    async updateTabInfo() {
        try {
            const tab = await this.getCurrentTab();
            if (!tab?.url) return;

            const url = new URL(tab.url);
            const hostname = url.hostname;
            const fullURL = tab.url;

            AppState.currentTab = tab;
            AppState.org_id = URLUtils.extractOrgId(fullURL);
            const urlSiteId = URLUtils.extractSiteId(fullURL);

            const apiUrl = URLUtils.getApiUrl(hostname);

            // Update UI elements
            const { apiURLElem, orgidElem } = DOMElements;
            if (apiURLElem) apiURLElem.textContent = apiUrl;
            if (orgidElem) orgidElem.textContent = AppState.org_id || 'Not detected';

            // Update site information
            await SiteManager.updateSiteInfo(AppState.org_id, urlSiteId);

        } catch (error) {
            console.error('Error updating tab info:', error);
        }
    }
};

// Action handlers
const ActionHandlers = {
    async handleDataAction(action) {
        const { popupContent } = DOMElements;

        if (!AppState.org_id) {
            UIUtils.showError(popupContent, 'Organization ID not detected. Please navigate to a Mist organization page.');
            return;
        }

        try {
            UIUtils.showLoading(popupContent);

            // Add org_id to the request for data endpoints
            const requestData = action === 'settings' ? {} : { org_id: AppState.org_id };
            
            // Add site_id if available for certain actions
            if (AppState.site_id && ['switches', 'aps'].includes(action)) {
                requestData.site_id = AppState.site_id;
            }
            
            const response = await APIClient.sendMessage(action, requestData);

            if (popupContent) {
                if (response?.data) {
                    popupContent.textContent = JSON.stringify(response.data, null, 2);
                } else {
                    popupContent.textContent = response?.message || 'Action completed successfully';
                }
                popupContent.style.color = '';
            }

        } catch (error) {
            UIUtils.showError(popupContent, error.message);
        } finally {
            UIUtils.hideLoading(popupContent);
        }
    },

    async handleSettingsAction() {
        const { settingsMenu } = DOMElements;

        if (settingsMenu) {
            settingsMenu.style.display = 'block';
        }

        await TabManager.updateTabInfo();

        if (AppState.org_id && ValidationUtils.isValidOrgId(AppState.org_id)) {
            try {
                const exists = await SettingsManager.checkExistingData(AppState.org_id);
                SettingsManager.updateSettingsUI(exists);
            } catch (error) {
                console.error('Error checking existing data:', error);
                SettingsManager.showMessage('Error checking existing data: ' + error.message, 'error');
            }
        } else {
            SettingsManager.showMessage('Invalid organization ID detected', 'error');
        }
    },

    async handleApiKeySubmit() {
        const { apiInput } = DOMElements;

        if (!apiInput) return;

        const apiKey = apiInput.value.trim();

        if (!apiKey) {
            alert('Please enter an API key');
            return;
        }

        if (!ValidationUtils.isValidApiKey(apiKey)) {
            alert('API key must be at least 36 characters long');
            return;
        }

        await TabManager.updateTabInfo();

        if (!AppState.org_id || !AppState.currentTab?.url) {
            alert('Organization ID or URL not detected');
            return;
        }

        const url = new URL(AppState.currentTab.url);
        const apiUrl = URLUtils.getApiUrl(url.hostname);

        console.log('AppState.currentTab.url:', AppState.currentTab?.url);
        console.log('Parsed hostname:', url.hostname);
        console.log('apiUrl:', apiUrl);

        try {
            await SettingsManager.submitApiKey(AppState.org_id, apiKey, apiUrl);

            // Update UI to show success
            const obscuredKey = SettingsManager.obscureApiKey(apiKey);
            const container = apiInput.parentElement;
            if (container) {
                container.innerHTML = `<p class="paragraphs" id="api-obscured">API Key: ${obscuredKey}</p>`;
            }

            SettingsManager.showMessage('API key saved successfully', 'success');

            // Refresh site information after API key is saved
            await SiteManager.updateSiteInfo(AppState.org_id, null);

        } catch (error) {
            alert('Error saving API key: ' + error.message);
        }
    },

    async handleApiKeyPurge() {
        const { purgeBtn } = DOMElements;

        if (!AppState.org_id) {
            alert('Organization ID not detected');
            return;
        }

        if (!confirm('Are you sure you want to purge the API key? This action cannot be undone.')) {
            return;
        }

        if (purgeBtn) {
            purgeBtn.disabled = true;
            purgeBtn.textContent = "Purging...";
        }

        try {
            await SettingsManager.purgeApiKey(AppState.org_id);

            // Reset UI
            const { apiInput, apiSubmitButton } = DOMElements;
            if (apiInput) {
                apiInput.disabled = false;
                apiInput.value = '';
            }
            if (apiSubmitButton) apiSubmitButton.disabled = false;
            if (purgeBtn) purgeBtn.style.display = 'none';

            SettingsManager.removeMessage('api-exists-msg');
            SettingsManager.showMessage('API key purged successfully. You can now add a new one.', 'success', 'api-purged-msg');

            // Check existing data after successful purge
            const exists = await SettingsManager.checkExistingData(AppState.org_id);
            SettingsManager.updateSettingsUI(exists);

            // Update site information after purging
            await SiteManager.updateSiteInfo(AppState.org_id, null);

        } catch (error) {
            alert('Error purging API key: ' + error.message);
        } finally {
            if (purgeBtn) {
                purgeBtn.disabled = false;
                purgeBtn.textContent = "Purge API Key";
            }
        }
    }
};

// Event listeners setup
function setupEventListeners() {
    // Cache DOM elements
    DOMElements.popupContent = document.querySelector('.popup-content');
    DOMElements.settingsMenu = document.getElementById('settings-menu');
    DOMElements.apiURLElem = document.getElementById('api-url');
    DOMElements.orgidElem = document.getElementById('org-id');
    DOMElements.siteidElem = document.getElementById('site-id');
    DOMElements.apiInput = document.getElementById('api-input-box');
    DOMElements.apiSubmitButton = document.getElementById('submit-button');
    DOMElements.purgeBtn = document.getElementById('purge-api-btn');

    // Action button listeners
    document.querySelectorAll('.action-button').forEach(button => {
        button.addEventListener('click', async () => {
            UIUtils.setButtonClicked(button);

            const action = button.getAttribute('data-action');

            if (action === 'settings') {
                await ActionHandlers.handleSettingsAction();
            } else {
                // Hide settings menu for non-settings actions
                if (DOMElements.settingsMenu) {
                    DOMElements.settingsMenu.style.display = 'none';
                }
                await ActionHandlers.handleDataAction(action);
            }
        });
    });

    // API key submit listener
    if (DOMElements.apiSubmitButton) {
        DOMElements.apiSubmitButton.addEventListener('click', ActionHandlers.handleApiKeySubmit);
    }

    // API key purge listener
    if (DOMElements.purgeBtn) {
        DOMElements.purgeBtn.addEventListener('click', ActionHandlers.handleApiKeyPurge);
    }

    // Enter key support for API input
    if (DOMElements.apiInput) {
        DOMElements.apiInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                ActionHandlers.handleApiKeySubmit();
            }
        });
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();

    // Initialize tab info
    TabManager.updateTabInfo().catch(error => {
        console.error('Error initializing tab info:', error);
    });
});