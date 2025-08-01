import { AppState } from './app-state.js';
import { DOMElements } from './dom-elements.js';
import { ValidationUtils } from './validation.js';
import { UIUtils } from './ui-utils.js';
import { APIClient } from './api-client.js';
import { URLUtils } from './url-utils.js';
import { SettingsManager } from './settings-manager.js';
import { SiteManager } from './site-manager.js';
import { TabManager } from './tab-manager.js';

export const ActionHandlers = {
    async handleDataAction(action) {
        try {
            const orgValidation = ValidationUtils.validateWithMessage(AppState.org_id, 'orgId', 'Organization ID');
            if (!orgValidation.valid) {
                if (DOMElements.contentArea) {
                    UIUtils.showError(DOMElements.contentArea, 'Organization ID not detected. Please navigate to a Mist organization page.');
                }
                return;
            }
            
            if (DOMElements.contentArea) {  
                UIUtils.showLoading(DOMElements.contentArea);
            }

            const sanitizedAction = ValidationUtils.sanitizeInput(action, 'alphanumeric');
            if (!sanitizedAction) {
                throw new Error('Invalid action parameter');
            }

            // Add org_id to the request for data endpoints
            const requestData = sanitizedAction === 'settings' ? {} : { org_id: AppState.org_id };
            
            // Add site_id if available for certain actions
            if (AppState.site_id && ['aps', 'switches', 'aps-switches'].includes(sanitizedAction)) {
                const siteValidation = ValidationUtils.validateWithMessage(AppState.site_id, 'siteId', 'Site ID');
                if (siteValidation.valid) {
                    requestData.site_id = AppState.site_id;
                }
            }
            
            const response = await APIClient.sendMessage(sanitizedAction, requestData);

            if (DOMElements.contentArea) {
                if (response?.data) {
                    const jsonString = JSON.stringify(response.data, null, 2);
                    if (jsonString.length > 10000) {
                        DOMElements.contentArea.textContent = 'Data retrieved successfully (too large to display)';
                    } else {
                        DOMElements.contentArea.textContent = jsonString;
                    }
                } else {
                    DOMElements.contentArea.textContent = response?.message || 'Action completed successfully';
                }
                DOMElements.contentArea.style.color = '';
            }

        } catch (error) {
            console.error(`Error in handleDataAction(${action}):`, error);
            UIUtils.showError(DOMElements.contentArea, `Action failed: ${error.message}`);
        } finally {
            UIUtils.hideLoading(DOMElements.contentArea);
        }
    },

    async handleFetchNewAction() {
        try {
            const orgValidation = ValidationUtils.validateWithMessage(AppState.org_id, 'orgId', 'Organization ID');
            if (!orgValidation.valid) {
                UIUtils.showError(DOMElements.contentArea, 'Organization ID not detected. Please navigate to a Mist organization page.');
                return;
            }

            const contentArea = DOMElements.contentArea;
            
            UIUtils.showLoading(contentArea, 'Fetching fresh data...');
            
            // Call fetch-new (backend will get API key from database)
            const response = await APIClient.sendMessage('fetch-new', { 
                org_id: AppState.org_id
            });

            if (response && response.success) { 
                UIUtils.showSuccess(contentArea, 'Fresh data fetched successfully! Updated security scores are now available.');
            } else {
                UIUtils.showError(contentArea, response?.error || 'Failed to fetch fresh data');
            }
        } catch (error) {
            console.error('Error in handleFetchNewAction:', error);
            UIUtils.showError(DOMElements.contentArea, `Fetch failed: ${error.message}`);
        } finally {
            UIUtils.hideLoading(DOMElements.contentArea);
        }
    },

    async handleSettingsAction() {
        const { settingsMenu } = DOMElements;

        if (settingsMenu) {
            settingsMenu.style.display = 'block';
        } else {
            console.error('Settings menu element not found');
            return;
        }

        await TabManager.updateTabInfo();

        const orgValidation = ValidationUtils.validateWithMessage(AppState.org_id, 'orgId', 'Organization ID');
        if (orgValidation.valid) {
            try {
                const exists = await SettingsManager.checkExistingData(AppState.org_id);
                SettingsManager.updateSettingsUI(exists);
            } catch (error) {
                console.error('Error checking existing data:', error);
                SettingsManager.showMessage('Error checking existing data: ' + error.message, 'error');
            }
        } else {
            SettingsManager.showMessage(orgValidation.message, 'error');
        }
    },

    async handleApiKeySubmit() {
        const { apiInput } = DOMElements;

        if (!apiInput) {
            UIUtils.showError(DOMElements.contentArea, 'API input element not found');
            return;
        }

        const rawApiKey = apiInput.value || '';
        const apiKey = ValidationUtils.sanitizeInput(rawApiKey.trim());

        const apiKeyValidation = ValidationUtils.validateWithMessage(apiKey, 'apiKey', 'API Key');
        if (!apiKeyValidation.valid) {
            UIUtils.showError(DOMElements.contentArea, apiKeyValidation.message);
            return;
        }

        await TabManager.updateTabInfo();

        const tabData = {
            org_id: AppState.org_id,
            currentTabUrl: AppState.currentTab?.url
        };

        const tabValidation = ValidationUtils.validateMultiple(tabData, {
            org_id: { required: true, type: 'orgId' },
            currentTabUrl: { required: true, type: 'url' }
        });

        if (tabValidation.length > 0) {
            const errorMessage = tabValidation.map(err => err.message).join(', ');
            UIUtils.showError(DOMElements.contentArea, errorMessage);
            return;
        }

        try {
            const url = new URL(AppState.currentTab.url);
            const apiUrl = URLUtils.getApiUrl(url.hostname);

            console.log('AppState.currentTab.url:', AppState.currentTab?.url);
            console.log('Parsed hostname:', url.hostname);
            console.log('apiUrl:', apiUrl);

            // ✅ IMPROVED: Show loading state
            UIUtils.showLoading(DOMElements.contentArea, 'Saving API key...');

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
            console.error('Error in handleApiKeySubmit:', error);
            UIUtils.showError(DOMElements.contentArea, `API key submission failed: ${error.message}`);
        } finally {
            UIUtils.hideLoading(DOMElements.contentArea);
        }
    },
    
    // ✅ IMPROVED: Use schema validation and sanitization
    async handleDbKeySubmit() {
        const { dbAddressInput, dbNameInput, dbPassInput, dbPortInput, dbUserInput, dbSubmitButton } = DOMElements;

        // Check if all DOM elements exist
        const requiredElements = { dbAddressInput, dbNameInput, dbPassInput, dbPortInput, dbUserInput };
        const missingElements = Object.entries(requiredElements)
            .filter(([key, element]) => !element)
            .map(([key]) => key);

        if (missingElements.length > 0) {
            UIUtils.showError(DOMElements.contentArea, `Database form elements not found: ${missingElements.join(', ')}`);
            return;
        }

        // ✅ IMPROVED: Get and sanitize values
        const rawDbData = {
            dbAddress: dbAddressInput.value,
            dbUser: dbUserInput.value,
            dbPass: dbPassInput.value,
            dbPort: dbPortInput.value,
            dbName: dbNameInput.value
        };

        const dbData = {
            dbAddress: ValidationUtils.sanitizeInput(rawDbData.dbAddress?.trim()),
            dbUser: ValidationUtils.sanitizeInput(rawDbData.dbUser?.trim(), 'alphanumeric'),
            dbPass: ValidationUtils.sanitizeInput(rawDbData.dbPass?.trim()),
            dbPort: ValidationUtils.sanitizeInput(rawDbData.dbPort?.trim(), 'numeric'),
            dbName: ValidationUtils.sanitizeInput(rawDbData.dbName?.trim(), 'alphanumeric')
        };

        // ✅ IMPROVED: Use schema validation
        const validationErrors = ValidationUtils.validateMultiple(dbData, ValidationUtils.schemas.dbConfig);
        
        if (validationErrors.length > 0) {
            const errorMessage = validationErrors.map(err => err.message).join('\n');
            UIUtils.showError(DOMElements.contentArea, errorMessage);
            return;
        }

        // ✅ IMPROVED: Additional port validation
        const portNumber = ValidationUtils.toInt(dbData.dbPort);
        if (portNumber < 1 || portNumber > 65535) {
            UIUtils.showError(DOMElements.contentArea, 'Port number must be between 1 and 65535');
            return;
        }

        // Update tab info to get current context
        await TabManager.updateTabInfo();

        // ✅ IMPROVED: Use validation for org check
        const orgValidation = ValidationUtils.validateWithMessage(AppState.org_id, 'orgId', 'Organization ID');
        if (!orgValidation.valid) {
            UIUtils.showError(DOMElements.contentArea, 'Organization ID not detected. Please navigate to a Mist organization page.');
            return;
        }

        // Disable the submit button during processing
        if (dbSubmitButton) {
            dbSubmitButton.disabled = true;
            dbSubmitButton.textContent = "Testing Connection...";
        }

        // ✅ IMPROVED: Show loading state
        UIUtils.showLoading(DOMElements.contentArea, 'Testing database connection...');

        try {
            const response = await SettingsManager.submitDbConfigKey(
                dbData.dbUser, 
                dbData.dbPass, 
                dbData.dbAddress, 
                portNumber,  // Use converted integer
                dbData.dbName
            );

            if (response && response.success) {
                // Show success message
                const container = dbAddressInput.parentElement;
                if (container) {
                    // Remove any existing messages
                    const existingMsgs = container.querySelectorAll('.db-message');
                    existingMsgs.forEach(msg => msg.remove());
                    
                    // Add success message
                    const successMsg = document.createElement('p');
                    successMsg.className = 'db-message db-success-msg paragraphs';
                    successMsg.style.color = '#2e7d32';
                    successMsg.style.marginTop = '10px';
                    
                    const config = response.config;
                    if (config) {
                        // ✅ IMPROVED: Sanitize config display
                        const sanitizedConfig = {
                            user: ValidationUtils.sanitizeInput(config.user, 'alphanumeric'),
                            host: ValidationUtils.sanitizeInput(config.host),
                            port: ValidationUtils.toInt(config.port),
                            database: ValidationUtils.sanitizeInput(config.database, 'alphanumeric')
                        };
                        successMsg.textContent = `Database connected: ${sanitizedConfig.user}@${sanitizedConfig.host}:${sanitizedConfig.port}/${sanitizedConfig.database}`;
                    } else {
                        successMsg.textContent = 'Database configuration saved successfully';
                    }
                    
                    container.appendChild(successMsg);
                }
                
                // Clear password field for security
                dbPassInput.value = '';
                
                // Show global success message
                SettingsManager.showMessage('Database configuration successful', 'success', 'db-config-msg');
                
            } else {
                throw new Error(response?.error || 'Database configuration failed');
            }

        } catch (error) {
            console.error('Error in handleDbKeySubmit:', error);
            UIUtils.showError(DOMElements.contentArea, `Database configuration failed: ${error.message}`);
        } finally {
            // Cleanup code
            if (dbSubmitButton) {
                dbSubmitButton.disabled = false;
                dbSubmitButton.textContent = "Test & Save Database Config";
            }
            UIUtils.hideLoading(DOMElements.contentArea);
        }
    },

    // ✅ IMPROVED: Better validation and error handling
    async handleApiKeyPurge() {
        const { purgeBtn } = DOMElements;

        // ✅ IMPROVED: Use new validation method
        const orgValidation = ValidationUtils.validateWithMessage(AppState.org_id, 'orgId', 'Organization ID');
        if (!orgValidation.valid) {
            UIUtils.showError(DOMElements.contentArea, orgValidation.message);
            return;
        }

        if (!confirm('Are you sure you want to purge the API key? This action cannot be undone.')) {
            return;
        }

        if (purgeBtn) {
            purgeBtn.disabled = true;
            purgeBtn.textContent = "Purging...";
        }

        // ✅ IMPROVED: Show loading state
        UIUtils.showLoading(DOMElements.contentArea, 'Purging API key...');

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
            console.error('Error in handleApiKeyPurge:', error);
            UIUtils.showError(DOMElements.contentArea, `API key purge failed: ${error.message}`);
        } finally {
            // Cleanup code
            if (purgeBtn) {
                purgeBtn.disabled = false;
                purgeBtn.textContent = "Purge API Key";
            }
            UIUtils.hideLoading(DOMElements.contentArea);
        }
    },

    async resetDBConn() {
        try {
            UIUtils.showLoading(DOMElements.contentArea, 'Resetting database connection...');
            
            const response = await APIClient.sendMessage('db-health', {});
            
            if (response?.healthy) {
                UIUtils.showSuccess(DOMElements.contentArea, 'Database connection is healthy');
            } else {
                UIUtils.showError(DOMElements.contentArea, 'Database connection needs attention');
            }
            
        } catch (error) {
            console.error('Error checking database health:', error);
            UIUtils.showError(DOMElements.contentArea, `Database check failed: ${error.message}`);
        } finally {
            UIUtils.hideLoading(DOMElements.contentArea);
        }
    },

    async updateDataStatus() {
        try {
            // No caching, so nothing to check
            console.log("Data status updated");
        } catch (error) {
            console.error("Error updating data status:", error);
        }
    }
};