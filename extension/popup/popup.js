// State management
const AppState = {
    org_id: null,
    site_id: null,
    currentTab: null,
    isLoading: false
};

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

    getApiUrl(hostname) {
        return hostname.replace(/^(manage|integration)\./, 'api.') || 'api.mist.com';
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
            // FIXED: Clear loading text
            if (element.textContent && element.textContent.includes('Loading')) {
                element.textContent = '';
            }
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
    UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    
    validate(value, type) {
        if (!value || typeof value !== 'string') return false;
        value = value.trim();
        
        switch (type) {
            case 'orgId':
            case 'siteId':
                return this.UUID_REGEX.test(value);
            case 'apiKey':
                return value.length >= 36;
            default:
                return false;
        }
    }
};

// API communication, uses the Chrome extension messaging API to communicate with the background script
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

    // Submits API key data for a specific org and 
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
            if (urlSiteId && ValidationUtils.validate(urlSiteId, 'siteId')) {
                siteidElem.textContent = urlSiteId;
                siteidElem.style.color = '#2e7d32'; // Green for URL-detected site
                AppState.site_id = urlSiteId;
                return;
            }

            // If no site_id in URL but we have org_id, try to get sites from database
            if (orgId && ValidationUtils.validate(orgId, 'orgId')) {
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

const enhancedCenterTextPlugin = {
    id: 'enhancedCenterText',
    beforeDraw(chart) {
        const { ctx, chartArea: { left, top, width, height } } = chart;
        const data = chart.data.datasets[0].data;
        const validScores = data.filter(score => score !== null && score !== undefined);
       
        let onlyScores = data.slice(0, -1)

        const maxPossibleScore = (data.length-1) * 10; // 4 tests × 10 points = 40 max
        
        const highScore = maxPossibleScore*0.9
        const midScore = maxPossibleScore*0.7

        const totalPoints = onlyScores.reduce((sum, value) => sum + (value || 0), 0);
        

        let scoreColor = '#d32f2f'; // Red for low scores
        if (totalPoints >= highScore) scoreColor = '#2D6A00'; // Green for high scores
        else if (totalPoints >= midScore) scoreColor = '#f57f17'; // Yellow for medium scores
        
        ctx.save();
        
        const centerX = left + width / 2;
        const centerY = top + height / 2;
        
        // Draw circular background
        ctx.beginPath();
        ctx.arc(centerX, centerY, 60, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fill();
        ctx.strokeStyle = scoreColor;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw main score as points/max
        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = scoreColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${totalPoints}/${maxPossibleScore}`, centerX, centerY - 5);
        
        // Draw label
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#666';
        ctx.fillText('TOTAL POINTS', centerX, centerY + 20);
        
        ctx.restore();
    }
};

const ChartManager = {
    // Chart instance reference for cleanup
    chartInstance: null,
    
    // Hide chart and clean up
    hideChart() {
        const popupContent = document.getElementById('content-area');
        const pieChartContainer = document.getElementById('pie-chart');

        document.body.classList.remove('chart-expanded');
        
        if (pieChartContainer) {
            pieChartContainer.style.display = 'none';
            
            // Destroy the chart instance if it exists
            if (this.chartInstance) {
                this.chartInstance.destroy();
                this.chartInstance = null;
            }
        }
        
        if (popupContent) {
            popupContent.style.display = 'block';
        }
    },

    hideSettings() {
            const settingsMenuDOM = document.getElementById('settings-menu');

        document.body.classList.remove('settings-menu');
        
        if (settingsMenuDOM) {
            settingsMenuDOM.style.display = 'none';
            }
    },
    
    // Main method to show chart
    async showChart(data, isCached = false) {
        try {
            // First make the container visible
            const pieChartContainer = document.getElementById('pie-chart');
            const popupContent = document.getElementById('content-area');
            
            // Hide content and show chart container with specific dimensions
            if (popupContent) {
                popupContent.style.display = 'none';
            }
            
            if (pieChartContainer) {
                pieChartContainer.style.display = 'block';
                pieChartContainer.style.width = '600px';
                pieChartContainer.style.height = '400px';
                pieChartContainer.style.margin = '0 auto';
            }
            
            // Expand the body
            document.body.classList.add('chart-expanded');
            
            // Force layout recalculation
            void pieChartContainer.offsetHeight;
            
            // Clear and create a fresh canvas
            pieChartContainer.innerHTML = '<canvas id="chart-inner"></canvas>';
            
            // Get the canvas and set explicit dimensions
            const chartCanvas = document.getElementById('chart-inner');
            chartCanvas.style.width = '100%';
            chartCanvas.style.height = '100%';
            
            // Give the browser a moment to process the DOM changes
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Now set the canvas dimensions after the container is properly sized
            chartCanvas.width = pieChartContainer.clientWidth || 800;
            chartCanvas.height = pieChartContainer.clientHeight || 600;
            
            // Get the context
            const ctx = chartCanvas.getContext('2d');
            if (!ctx) {
                console.error("Failed to get canvas context");
                return;
            }

            // Debug the data being passed to chart
            console.log("Chart data received:", {
                admin_score: data.admin_score,
                admin_recs: data.failing_admins,
                site_firmware_score: data.site_firmware_score,
                password_policy_score: data.password_policy_score,
                ap_firmware_score: data.ap_version_score || data.ap_firmware_score
            });

            // Create chart with center text plugin
            this.chartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ["Admin Score", "Auto-firmware Upgrade Score", "Password Score", "AP Firmware Score", "WLAN Template Score", ""],
                    datasets: [{
                        data: [
                            data.admin_score,
                            data.site_firmware_score,
                            data.password_policy_score,
                            data.ap_version_score,
                            data.wlan_score,
                            Math.max(1, 50 - ((data.admin_score || 0) + (data.site_firmware_score || 0) + (data.password_policy_score || 0) + (data.ap_version_score || 0) + (data.wlan_score || 0)))
                        ],
                        backgroundColor: ['#2D6A00', '#84B135', '#0095A9', '#FF6B35','#CCDB2A', '#FFFFFF'],
                        cutout: '60%', // Increased cutout for more center space
                        borderWidth: 3,
                        hoverOffset: 15,
                        spacing: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'right',
                            labels: {
                                font: {
                                    size: 12
                                },
                                padding: 15,
                                usePointStyle: true,
                                generateLabels: function(chart) {
                                    const data = chart.data;
                                    if (data.labels.length && data.datasets.length) {
                                        return data.labels.map((label, i) => {
                                            // Skip the missing segment in legend
                                            if (label === "Missing Points" || label === "") return null;
                                            
                                            const dataset = data.datasets[0];
                                            const value = dataset.data[i] || 0;
                                            return {
                                                text: `${label}: ${value}/10`,
                                                fillStyle: dataset.backgroundColor[i],
                                                strokeStyle: dataset.backgroundColor[i],
                                                lineWidth: 0,
                                                pointStyle: 'circle',
                                                hidden: false,
                                                index: i
                                            };
                                        }).filter(Boolean); // Remove null entries
                                    }
                                    return [];
                                }
                            }
                        },
                        title: {
                            display: true,
                            text: 'Security Audit Scores',
                            font: {
                                size: 18,
                                weight: 'bold'
                            },
                            padding: {
                                top: 10,
                                bottom: 20
                            },
                        },
                        subtitle: {
                            display: true,
                            text: `Batch ID: ${data.batch_id}`,
                        },
                        tooltip: {
                            callbacks: {
                                title: function(tooltipItems) {
                                    const item = tooltipItems[0];
                                    return item.label || '';
                                },
                                label: function(context) {
                                    const index = context.dataIndex;
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    
                                    // Don't show tooltip for missing segment
                                    if (label === "" || label.includes("Missing")) {
                                        return null;
                                    }
                                    
                                    return `Score: ${value}/10 points`;
                                },
                                afterLabel: function(context) {
                                    const index = context.dataIndex;
                                    let details = '';
                                    
                                    // Add detailed recommendations based on the segment
                                    switch(index) {
                                        case 0: // Admin Score
                                                details = 'Issues found:\n' + Object.entries(data.failing_admins)
                                                    .map(([admin, issue]) => `• ${admin}: ${issue}`)
                                                    .join('\n');
                                            break;
                                        case 1: // Site Firmware Score
                                                details = 'Sites with issues:\n' + Object.entries(data.site_firmware_failing)
                                                    .map(([site, issue]) => `• ${site}: ${issue}`)
                                                    .join('\n');
                                            break;
                                        case 2: // Password Policy Score
                                                details = 'Recommendations:\n' + Object.entries(data.password_policy_recs)
                                                    .map(([key, rec]) => `• ${key}: ${rec}`)
                                                    .join('\n');
                                            break;
                                        case 3: // AP Firmware Score
                                                details = 'AP Firmware Issues:\n' + Object.entries(data.ap_firmware_recs)
                                                    .map(([serial, rec]) => `• ${serial}: ${rec}`)
                                                    .join('\n');
                                            break;
                                        case 4: // WLAN Score
                                                details = 'WLAN Recommendations:\n' + Object.entries(data.wlan_recs)
                                                    .map(([ssid, recs]) => {
                                                        if (typeof recs === 'object') {
                                                            return `• ${ssid}:\n  ${Object.values(recs).join('\n  ')}`;
                                                        }
                                                        return `• ${ssid}: ${recs}`;
                                                    })
                                                    .join('\n');
                                            break;
                                        default:
                                            details = '';
                                    }
                                    
                                    return details;
                                }
                            },
                            displayColors: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#ddd',
                            borderWidth: 1,
                            cornerRadius: 6,
                            caretPadding: 10,
                            padding: 12,
                            maxWidth: 400,
                            // Allow multiline tooltips
                            mode: 'nearest',
                            intersect: false
                        }
                    },
                    onClick: (event, elements) => {
                        if (elements.length > 0) {
                            const index = elements[0].index;
                            const labels = this.chartInstance.data.labels;
                            const values = this.chartInstance.data.datasets[0].data;
                            
                            alert(`${labels[index]}: ${values[index]}`);
                        }
                    }
                },
                plugins: [enhancedCenterTextPlugin] // Register the center text plugin
            });
            
        } catch (error) {
            console.error("Chart creation error:", error);
            alert(`Chart creation failed: ${error.message}`);
        }
    },
    
    // Fetch and show chart data
    async handlePieChart() {
        if (!AppState.org_id) {
            alert('Organization ID not detected. Please navigate to a Mist organization page.');
            return;
        }

        const contentArea = document.getElementById('content-area');

        try {
            UIUtils.showLoading(document.getElementById('content-area'));
            const response = await APIClient.sendMessage('pie', { org_id: AppState.org_id });

            if (response) {
                await this.showChart(response);
                UIUtils.hideLoading(contentArea);
            } else {
                alert(`Error loading chart data: No data returned`);
                UIUtils.hideLoading(contentArea);
            }
        } catch (error) {
            console.error('Error handling pie chart:', error);
            alert(`Error: ${error.message}`);
            UIUtils.hideLoading(contentArea);
        }
    }
};

// Action handlers
const ActionHandlers = {
    async handleDataAction(action) {
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

    async handleFetchNewAction() {
        if (!AppState.org_id) {
            alert('Organization ID not detected. Please navigate to a Mist organization page.');
            return;
        }

        const contentArea = document.getElementById('content-area'); 
        
        try {
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
            console.error('Error fetching new data:', error);
            UIUtils.showError(contentArea, error.message);
        } finally {
            UIUtils.hideLoading(contentArea);
        }
    },

    async handleSettingsAction() {
        const { settingsMenu } = DOMElements;

        if (settingsMenu) {
            settingsMenu.style.display = 'block';
        }

        await TabManager.updateTabInfo();

        if (AppState.org_id && ValidationUtils.validate(AppState.org_id, 'orgId')) {
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

        if (!ValidationUtils.validate(apiKey, 'apiKey')) {
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
    },

    async updateDataStatus() {
        try {
            // No caching, so nothing to check
            console.log("Data status updated");
        } catch (error) {
            console.error("Error updating data status:", error);
        }
    }
}

// Add this before setupEventListeners function
const DOMElements = {
    popupContent: null,
    settingsMenu: null,
    apiURLElem: null,
    orgidElem: null,
    siteidElem: null,
    apiInput: null,
    apiSubmitButton: null,
    purgeBtn: null
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
                ChartManager.hideChart()
                await ActionHandlers.handleSettingsAction();
            } else if (action === 'pie') {
                await ChartManager.handlePieChart();
                ChartManager.hideSettings()
            //} else if (action === 'export-data') {
                // Handle data export
            //    await ActionHandlers.handleDataExport();
            } else if (action === 'histogram') {
                ChartManager.hideChart()
                ChartManager.hideSettings()
                // Handle pie chart specifically with caching support
                //await ChartManager.handlePieChart();
            } else if (action === 'switches') {
                ChartManager.hideChart()
                ChartManager.hideSettings()
                // Handle pie chart specifically with caching support
                //await ChartManager.handlePieChart();
            } else if (action === 'aps') {
                ChartManager.hideChart()
                ChartManager.hideSettings()
                // Handle pie chart specifically with caching support
                //await ChartManager.handlePieChart();
            } else if (action === 'fetch-new') {
                ChartManager.hideSettings()
                await ActionHandlers.handleFetchNewAction();
                // Handle pie chart specifically with caching support
                //await ChartManager.handlePieChart();
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

// Add global error handler to log all errors
window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
});

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    
    TabManager.updateTabInfo().catch(error => {
        console.error('Error initializing tab info:', error);
    });

    // Update data status on popup load
    await ActionHandlers.updateDataStatus();
});