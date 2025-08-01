// State management
export const AppState = {
    org_id: null,
    site_id: null,
    currentTab: null,
    isLoading: false,
    
    // State update methods
    setOrgId(orgId) {
        this.org_id = orgId;
    },
    
    setSiteId(siteId) {
        this.site_id = siteId;
    },
    
    setCurrentTab(tab) {
        this.currentTab = tab;
    },
    
    setLoading(isLoading) {
        this.isLoading = isLoading;
    },
    
    // State getters
    hasOrgId() {
        return this.org_id !== null;
    },
    
    hasSiteId() {
        return this.site_id !== null;
    },
    
    reset() {
        this.org_id = null;
        this.site_id = null;
        this.currentTab = null;
        this.isLoading = false;
    }
};