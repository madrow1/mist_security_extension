import { DOMElements } from './dom-elements.js';     
import { ValidationUtils } from './validation.js';          
import { APIClient } from './api-client.js';         

export const SettingsManager = {
    // Checks whether the API key exists for the current org_id
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

    async resetDbConnection(orgId) {
        if (!ValidationUtils.validate(orgId, 'orgId')) {
            throw new Error('Invalid organization ID');
        }

        try {
            const response = await APIClient.sendMessage('reset-db-con', { org_id: orgId });
            console.log('Database connection reset response:', response);  
            return response; 
        } catch (error) {
            console.error('Error resetting database connection:', error);  
            throw error; 
        }
    },

    // Submits API key data for a specific org
    async submitApiKey(orgId, apiKey, apiAddress) {
        if (!ValidationUtils.validate(orgId, 'orgId')) {
            throw new Error('Invalid organization ID');
        }

        if (!ValidationUtils.validate(apiKey, 'apiKey')) {
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

    async submitDbConfigKey(dbUser, dbPass, dbAddress, dbPort, dbName) {
        // Validate required parameters
        const requiredFields = { dbUser, dbPass, dbAddress, dbPort, dbName };
        const missing = ValidationUtils.validateRequired(requiredFields);
        
        if (missing.length > 0) {
            throw new Error(`Missing required database fields: ${missing.join(', ')}`);
        }

        // Validate port number
        if (!ValidationUtils.validate(dbPort, 'dbPort')) {
            throw new Error('Invalid database port number');
        }

        // Validate database name format
        if (!ValidationUtils.validate(dbName, 'dbName')) {
            throw new Error('Invalid database name format');
        }

        try {
            await APIClient.sendMessage('dbconfig', {
                dbUser: dbUser,
                dbPass: dbPass,
                dbAddress: dbAddress,
                dbPort: parseInt(dbPort, 10),  
                dbName: dbName
            });
        } catch (error) {
            console.error('Error submitting database configurations:', error);
            throw error;
        }
    },

    async purgeApiKey(orgId) {
        if (!ValidationUtils.validate(orgId, 'orgId')) {
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
        if (!settingsMenu) {
            console.warn('Settings menu not found, cannot show message');
            return;
        }

        let msg = document.getElementById(id);
        if (!msg) {
            msg = document.createElement('p');
            msg.id = id;
            msg.className = 'paragraphs';
            settingsMenu.appendChild(msg);
        }

        msg.textContent = text;
        msg.style.color = type === 'error' ? '#d32f2f' : 
                         type === 'success' ? '#2e7d32' : '#666';
    },

    removeMessage(id) {
        const msg = document.getElementById(id);
        if (msg) msg.remove();
    },

    obscureApiKey(apiKey) {
        if (!apiKey) return '••••••••';
        if (typeof apiKey !== 'string') return '••••••••';
        if (apiKey.length <= 8) return '••••••••';
        
        // Show first 4 and last 4 characters
        const start = apiKey.slice(0, 4);
        const end = apiKey.slice(-4);
        const middle = '•'.repeat(Math.max(8, apiKey.length - 8));
        
        return start + middle + end;
    },

    async validateOrgOperation(orgId, operation = 'operation') {
        if (!orgId) {
            throw new Error(`Organization ID is required for ${operation}`);
        }
        
        if (!ValidationUtils.validate(orgId, 'orgId')) {
            throw new Error(`Invalid organization ID format for ${operation}`);
        }
        
        return true;
    },

    async updateAllSettings(orgId) {
        try {
            await this.validateOrgOperation(orgId, 'settings update');
            
            const exists = await this.checkExistingData(orgId);
            this.updateSettingsUI(exists);
            
            return { exists, updated: true };
        } catch (error) {
            console.error('Error updating settings:', error);
            this.showMessage(`Settings update failed: ${error.message}`, 'error');
            throw error;
        }
    }
};