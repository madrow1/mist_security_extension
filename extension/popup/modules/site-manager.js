import { AppState } from './app-state.js';         
import { DOMElements } from './dom-elements.js';     
import { ValidationUtils } from './validation.js';     
import { SettingsManager } from './settings-manager.js'; 

// Site management
export const SiteManager = {
    async updateSiteInfo(orgId, urlSiteId) {
        const { siteidElem } = DOMElements;
        
        if (!siteidElem) {
            console.warn('Site ID element not found in DOM');
            return;
        }

        try {
            // If there's a site_id in the URL, use it
            if (urlSiteId && ValidationUtils.validate(urlSiteId, 'siteId')) {
                this.updateSiteDisplay(siteidElem, urlSiteId, '#2e7d32'); 
                AppState.setSiteId(urlSiteId);  
                console.log('Site ID detected from URL:', urlSiteId);
                return;
            }

            // If no site_id in URL but we have org_id, try to get sites from database
            if (orgId && ValidationUtils.validate(orgId, 'orgId')) {
                const siteIds = await SettingsManager.getSiteIds(orgId);

                if (siteIds && siteIds.length > 0) {
                    if (siteIds.length === 1) {
                        this.updateSiteDisplay(siteidElem, siteIds[0], '#666');
                        AppState.setSiteId(siteIds[0]);  
                        console.log('Single site found:', siteIds[0]);
                    } else {
                        this.displayMultipleSites(siteidElem, siteIds);
                        AppState.setSiteId(null);  
                        console.log(`Multiple sites found: ${siteIds.length}`);
                    }
                } else {
                    this.updateSiteDisplay(siteidElem, 'No sites found', '#d32f2f');
                    AppState.setSiteId(null);  
                    console.log('No sites found for organization');
                }
            } else {
                this.updateSiteDisplay(siteidElem, 'Not detected', '#999');
                AppState.setSiteId(null); 
                console.log('No valid organization ID provided');
            }
        } catch (error) {
            console.error('Error updating site info:', error);
            this.updateSiteDisplay(siteidElem, 'Error loading sites', '#d32f2f');
            AppState.setSiteId(null);  
        }
    },

    updateSiteDisplay(element, text, color) {
        if (!element) {
            console.warn('Cannot update display: element is null');
            return;
        }

        try {
            element.textContent = text;
            element.style.color = color;
        } catch (error) {
            console.error('Error updating site display:', error);
        }
    },

    sanitizeSiteId(siteId) {
        if (!siteId || typeof siteId !== 'string') return null;
        
        // Remove any HTML tags and limit length
        const cleaned = siteId
            .replace(/<[^>]*>/g, '')  // Remove HTML tags
            .trim()
            .substring(0, 50);  // Limit length
        
        return cleaned || null;
    },

    displayMultipleSites(element, siteIds) {
        if (!element || !Array.isArray(siteIds)) {
            console.warn('Cannot display multiple sites: invalid parameters');
            return;
        }

        try {
            const container = document.createElement('div');
            
            siteIds.forEach(id => {
                const cleanId = this.sanitizeSiteId(id); 
                if (cleanId) {
                    const siteDiv = document.createElement('div');
                    siteDiv.textContent = cleanId;
                    siteDiv.style.fontSize = '11px';
                    siteDiv.style.marginBottom = '2px';
                    container.appendChild(siteDiv);
                }
            });

            // Clear existing content and append new content
            element.innerHTML = '';
            element.appendChild(container);
            element.style.color = '#666';
            
        } catch (error) {
            console.error('Error displaying multiple sites:', error);
            // Fallback to simple text display
            element.textContent = `${siteIds.length} sites found`;
            element.style.color = '#666';
        }
    },

    validateSiteId(siteId) {
        if (!siteId) return false;
        return ValidationUtils.validate(siteId, 'siteId');
    },

    getCurrentSiteId() {
        return AppState.site_id;
    },

    hasValidSiteId() {
        const siteId = AppState.site_id;
        return siteId && this.validateSiteId(siteId);
    },

    clearSiteInfo() {
        const { siteidElem } = DOMElements;
        
        if (siteidElem) {
            this.updateSiteDisplay(siteidElem, 'Not detected', '#999');
        }
        
        AppState.setSiteId(null);
        console.log('Site information cleared');
    },

    async refreshSiteInfo(orgId) {
        console.log('Refreshing site information...');
        const { siteidElem } = DOMElements;
        
        if (siteidElem) {
            siteidElem.textContent = 'Loading...';
            siteidElem.style.color = '#666';
        }
        
        try {
            await this.updateSiteInfo(orgId, null);
        } catch (error) {
            console.error('Error refreshing site info:', error);
            if (siteidElem) {
                siteidElem.textContent = 'Refresh failed';
                siteidElem.style.color = '#d32f2f';
            }
        }
    }
};