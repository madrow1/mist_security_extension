// API communication
export const APIClient = {
    sendMessage(action, data = {}, timeout = 30000) {  
        if (!action || typeof action !== 'string') {
            return Promise.reject(new Error('Invalid action parameter'));
        }

        return new Promise((resolve, reject) => {
            const message = { action, ...data };
            
            const timeoutId = setTimeout(() => {
                reject(new Error(`Request timeout after ${timeout}ms`));
            }, timeout);

            chrome.runtime.sendMessage(message, (response) => {
                clearTimeout(timeoutId);  
                
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
    },
    
    // Convenience methods for common API calls
    async checkExistingData(orgId) {
        return this.sendMessage('check-existing-data', { org_id: orgId });
    },
    
    async getSiteIds(orgId) {
        return this.sendMessage('get-site-id', { org_id: orgId });
    },
    
    async submitApiKey(orgId, apiKey, apiUrl) {
        return this.sendMessage('data', {
            org_id: orgId,
            api_key: apiKey,
            api_url: apiUrl
        });
    },
    
    async submitDbConfig(config) {
        return this.sendMessage('dbconfig', config);
    },
    
    async purgeApiKey(orgId) {
        return this.sendMessage('purge-api-key', { org_id: orgId });
    },
    
    async fetchNewData(orgId) {
        return this.sendMessage('fetch-new', { org_id: orgId });
    },
    
    async resetDbConnection(orgId) {
        return this.sendMessage('reset-db-con', { org_id: orgId });
    },
    
    async getPieChartData(orgId) {
        return this.sendMessage('pie', { org_id: orgId });
    },
    
    async getHistogramData(orgId) {
        return this.sendMessage('histogram', { org_id: orgId });
    },
    
    async getHistogramSiteAverage(orgId) {
        return this.sendMessage('histogram-site-average', { org_id: orgId });
    }
};