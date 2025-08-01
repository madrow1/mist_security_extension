import { AppState } from './app-state.js';         
import { DOMElements } from './dom-elements.js';     
import { URLUtils } from './url-utils.js';        
import { SiteManager } from './site-manager.js';    

// Tab management
export const TabManager = {
    async checkTabPermissions() {
        try {
            return new Promise((resolve) => {
                chrome.permissions.contains({
                    permissions: ['tabs']
                }, (result) => {
                    resolve(result);
                });
            });
        } catch (error) {
            console.error('Error checking tab permissions:', error);
            return false;
        }
    },

    // IMPROVED: Add error handling and timeout
    async getCurrentTab() {
        const hasPermission = await this.checkTabPermissions();
        if (!hasPermission) {
            throw new Error('Extension does not have tab permissions');
        }

        return new Promise((resolve, reject) => {
            // Add timeout
            const timeout = setTimeout(() => {
                reject(new Error('Tab query timeout'));
            }, 5000);

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                clearTimeout(timeout);
                
                // ADDED: Check for chrome.runtime.lastError
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                resolve(tabs[0] || null);
            });
        });
    },

    // IMPROVED: Better error handling and DOM updates
    async updateTabInfo() {
        const { orgidElem, siteidElem } = DOMElements;

        try {
            // ADDED: Update UI to show loading state
            if (orgidElem) {
                orgidElem.textContent = 'Detecting...';
                orgidElem.style.color = '#666';
            }
            if (siteidElem) {
                siteidElem.textContent = 'Detecting...';
                siteidElem.style.color = '#666';
            }

            const urlInfo = await URLUtils.parseCurrentUrl();
            
            if (urlInfo) {
                // Update organization info
                AppState.setOrgId(urlInfo.orgId);
                
                // ADDED: Update DOM elements
                if (orgidElem) {
                    if (urlInfo.orgId) {
                        orgidElem.textContent = urlInfo.orgId;
                        orgidElem.style.color = '#2e7d32';  // Green for detected
                    } else {
                        orgidElem.textContent = 'Not detected';
                        orgidElem.style.color = '#d32f2f';  // Red for not found
                    }
                }

                // Update site info
                if (urlInfo.siteId) {
                    AppState.setSiteId(urlInfo.siteId);
                    if (siteidElem) {
                        siteidElem.textContent = urlInfo.siteId;
                        siteidElem.style.color = '#2e7d32';  // Green for detected
                    }
                } else if (urlInfo.orgId) {
                    // FIXED: Use correct method name
                    await SiteManager.updateSiteInfo(urlInfo.orgId, null);
                } else {
                    AppState.setSiteId(null);
                    if (siteidElem) {
                        siteidElem.textContent = 'Not detected';
                        siteidElem.style.color = '#d32f2f';
                    }
                }

                // ADDED: Update API URL element
                const { apiURLElem } = DOMElements;
                if (apiURLElem && urlInfo.apiUrl) {
                    apiURLElem.textContent = urlInfo.apiUrl;
                }

                console.log('Tab info updated successfully:', {
                    orgId: urlInfo.orgId,
                    siteId: urlInfo.siteId,
                    apiUrl: urlInfo.apiUrl
                });

            } else {
                // ADDED: Handle case where URL info is not available
                AppState.setOrgId(null);
                AppState.setSiteId(null);
                
                if (orgidElem) {
                    orgidElem.textContent = 'Not a Mist page';
                    orgidElem.style.color = '#999';
                }
                if (siteidElem) {
                    siteidElem.textContent = 'Not detected';
                    siteidElem.style.color = '#999';
                }
                
                console.log('Current page is not a Mist organization page');
            }

        } catch (error) {
            console.error('Error updating tab info:', error);
            
            // ADDED: Update UI to show error state
            if (orgidElem) {
                orgidElem.textContent = 'Error detecting';
                orgidElem.style.color = '#d32f2f';
            }
            if (siteidElem) {
                siteidElem.textContent = 'Error detecting';
                siteidElem.style.color = '#d32f2f';
            }
            
            // Reset state on error
            AppState.setOrgId(null);
            AppState.setSiteId(null);
        }
    },

    // ADDED: Get current tab URL safely
    async getCurrentTabUrl() {
        try {
            const tab = await this.getCurrentTab();
            return tab ? tab.url : null;
        } catch (error) {
            console.error('Error getting current tab URL:', error);
            return null;
        }
    },

    // ADDED: Check if current tab is a Mist page
    async isMistPage() {
        try {
            const url = await this.getCurrentTabUrl();
            if (!url) return false;
            
            return url.includes('manage.mist.com') || 
                   url.includes('api.mist.com') ||
                   url.includes('mist.com');
        } catch (error) {
            console.error('Error checking if Mist page:', error);
            return false;
        }
    },

    // ADDED: Refresh tab information
    async refreshTabInfo() {
        console.log('Refreshing tab information...');
        await this.updateTabInfo();
    },

    // ADDED: Get tab information summary
    async getTabSummary() {
        try {
            const tab = await this.getCurrentTab();
            const urlInfo = await URLUtils.parseCurrentUrl();
            
            return {
                tab: tab ? {
                    id: tab.id,
                    url: tab.url,
                    title: tab.title
                } : null,
                urlInfo: urlInfo || null,
                isMistPage: await this.isMistPage(),
                appState: {
                    orgId: AppState.org_id,
                    siteId: AppState.site_id
                }
            };
        } catch (error) {
            console.error('Error getting tab summary:', error);
            return {
                tab: null,
                urlInfo: null,
                isMistPage: false,
                appState: {
                    orgId: AppState.org_id,
                    siteId: AppState.site_id
                },
                error: error.message
            };
        }
    }
};