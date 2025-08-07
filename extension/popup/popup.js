import { URLUtils } from "./modules/url-utils.js";
import { UIUtils } from "./modules/ui-utils.js";
import { ValidationUtils } from "./modules/validation.js";
import { APIClient } from "./modules/api-client.js";
import { enhancedCenterTextPlugin } from "./plugins/chart-plugin.js";
import { AppState } from "./modules/app-state.js";
import { DOMElements } from "./modules/dom-elements.js";

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

    async resetDbConnection(orgId) {
        try {
            const response = await APIClient.sendMessage('reset-db-con', { org_id: orgId });
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

    async submitdbConfigKey(dbUser, dbPass, dbAddress, dbPort, dbName) {
        try {
            await APIClient.sendMessage('dbconfig', {
                dbUser: dbUser,
                dbPass: dbPass,
                dbAddress: dbAddress,
                dbPort: dbPort,
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

    // Hides the API key after it has been typed by covering the central text with dots
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

const ChartManager = {
    // Chart instance reference for cleanup
    chartInstance: null,
    histoChartInstance: null, 
    histoAverageInstance: null,
    
    // Hide chart and clean up, this function can be called from anywhere to hide the pie-chart
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

    // performs the same function as hideChart() but for the settings menu
    hideSettings() {
            const settingsMenuDOM = document.getElementById('settings-menu');

        document.body.classList.remove('settings-menu');
        
        if (settingsMenuDOM) {
            settingsMenuDOM.style.display = 'none';
            }
    },

    hideHistoChart() {
        const popupContent = document.getElementById('content-area');
        const histoChartContainer = document.getElementById('histo-chart');

        document.body.classList.remove('chart-expanded');
        
        if (histoChartContainer) {
            histoChartContainer.style.display = 'none';
            
            // Destroy the histogram chart instance if it exists
            if (this.histoChartInstance) {
                this.histoChartInstance.destroy();
                this.histoChartInstance = null;
            }
        }
        
        if (popupContent) {
            popupContent.style.display = 'block';
        }
    },

    hideAverageHistoChart() {
        const popupContent = document.getElementById('content-area');
        const histoAverageChartContainer = document.getElementById('histo-average-chart');

        document.body.classList.remove('chart-expanded');
        
        if (histoAverageChartContainer) {
            histoAverageChartContainer.style.display = 'none';
            
            // Destroy the histogram chart instance if it exists
            if (this.histoAverageChartContainer) {
                this.histoAverageChartContainer.destroy();
                this.histoAverageChartContainer = null;
            }
        }
        
        if (popupContent) {
            popupContent.style.display = 'block';
        }
    },

    async showHistoChart(data, isCached = false) {
        try {
            const histoChartContainer = document.getElementById('histo-chart');
            const popupContent = document.getElementById('content-area');
            
            if (popupContent) {
                popupContent.style.display = 'none';
            }
            
            if (histoChartContainer) {
                histoChartContainer.style.display = 'block';
                histoChartContainer.style.width = '700px';
                histoChartContainer.style.height = '500px';
                histoChartContainer.style.margin = '0 auto';
            }
            
            // Expand the body
            document.body.classList.add('chart-expanded');
            
            // Force layout recalculation
            void histoChartContainer.offsetHeight;
            
            // Clear and create a fresh canvas
            histoChartContainer.innerHTML = '<canvas id="histo-inner"></canvas>';
            
            // Get the canvas and set explicit dimensions
            const chartCanvas = document.getElementById('histo-inner');
            chartCanvas.style.width = '90%';  
            chartCanvas.style.height = '90%'; 
            
            // Give the browser a moment to process the DOM changes
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Get the context
            const ctx = chartCanvas.getContext('2d');
            if (!ctx) {
                console.error("Failed to get canvas context");
                return;
            }

            this.histoChartInstance = new window.Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.labels,  
                    datasets: [
                        {
                            label: "Admin Score",
                            data: data.admin_scores, 
                            fill: false,
                            borderColor: '#2D6A00',
                            backgroundColor: '#2D6A00',
                            tension: 0.1,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        },
                        {
                            label: "Site Firmware Score", 
                            data: data.site_firmware_scores,
                            fill: false,
                            borderColor: '#84B135',
                            backgroundColor: '#84B135',
                            tension: 0.1,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        },
                        {
                            label: "Password Policy Score",
                            data: data.password_policy_scores,
                            fill: false,
                            borderColor: '#0095A9',
                            backgroundColor: '#0095A9',
                            tension: 0.1,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        },
                        {
                            label: "AP Firmware Score",
                            data: data.ap_firmware_scores,
                            fill: false,
                            borderColor: '#FF6B35',
                            backgroundColor: '#FF6B35',
                            tension: 0.1,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        },
                        {
                            label: "WLAN Template Score",
                            data: data.wlan_scores,
                            fill: false,
                            borderColor: '#CCDB2A',
                            backgroundColor: '#CCDB2A',
                            tension: 0.1,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        },
                        {
                            label: "Switch Firmware Score",
                            data: data.switch_firmware_scores,
                            fill: false,
                            borderColor: '#578A1B',
                            backgroundColor: '#578A1B',
                            tension: 0.1,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        x: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Time'
                            }
                        },
                        y: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Security Score'
                            },
                            min: 0,
                            max: 10,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        labels: {
                            font: {
                                size: 10
                            },
                            usePointStyle: true,
                            maxWidth: 80,  
                            padding: 10
                        },
                        title: {
                            display: true,
                            text: 'Security Scores Over Time',
                            font: {
                                size: 18,
                                weight: 'bold'
                            }
                            ,
                            padding: {
                                top: 10,
                                bottom: 20
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                title: function(tooltipItems) {
                                    const index = tooltipItems[0].dataIndex;
                                    const batchInfo = data.batch_ids && data.batch_ids[index] 
                                        ? ` (Batch: ${data.batch_ids[index]})` 
                                        : '';
                                    return `Time: ${data.labels[index]}${batchInfo}`;
                                },
                                label: function(context) {
                                    return `${context.dataset.label}: ${context.parsed.y}/10`;
                                }
                            } 
                        } 
                    }, 
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    }
                } 
            });
            
        } catch (error) {
            console.error("Histogram chart creation error:", error);
            alert(`Histogram chart creation failed: ${error.message}`);
        }
    },
    
    // Fetch and show chart data
    async handleHistoChart() {
        if (!AppState.org_id) {
            alert('Organization ID not detected. Please navigate to a Mist organization page.');
            return;
        }

        const contentArea = DOMElements.contentArea;

        try {
            UIUtils.showLoading(contentArea, 'Loading historical data...');
            const response = await APIClient.sendMessage('histogram', { org_id: AppState.org_id });

            if (response) {
                await this.showHistoChart(response);  
                UIUtils.hideLoading(contentArea);
            } else {
                alert(`Error loading histogram data: No data returned`);
                UIUtils.hideLoading(contentArea);
            }
        } catch (error) {
            console.error('Error handling histogram:', error);
            alert(`Error: ${error.message}`);
            UIUtils.hideLoading(contentArea);
        }
    },

    async showHistoAverageChart(data, isCached = false) {
        try {
            if (!data || !data.labels || !data.datasets) {
                throw new Error('Invalid per-site histogram data');
            }
            
            const histoChartContainer = document.getElementById('histo-average-chart');
            const popupContent = document.getElementById('content-area');
            
            // Hide content and show chart container
            if (popupContent) {
                popupContent.style.display = 'none';
            }
            
            if (histoChartContainer) {
                histoChartContainer.style.display = 'block';
                histoChartContainer.style.width = '700px';  
                histoChartContainer.style.height = '500px'; 
                histoChartContainer.style.margin = '0 auto';
            }
            
            // Expand the body
            document.body.classList.add('chart-expanded');
            
            // Force layout recalculation
            void histoChartContainer.offsetHeight;
            
            // Clear and create a fresh canvas
            histoChartContainer.innerHTML = '<canvas id="histo-average-inner"></canvas>';
            
            // Get the canvas and set explicit dimensions
            const chartCanvas = document.getElementById('histo-average-inner');
            chartCanvas.style.width = '90%';
            chartCanvas.style.height = '90%';
            
            // Give the browser a moment to process the DOM changes
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Get the context
            const ctx = chartCanvas.getContext('2d');
            if (!ctx) {
                console.error("Failed to get canvas context");
                return;
            }

            const chartDatasets = data.datasets.map(siteData => ({
                label: siteData.label,
                data: siteData.data,
                fill: false,
                borderColor: siteData.color,
                backgroundColor: siteData.color,
                tension: 0.1,
                pointRadius: 4,
                pointHoverRadius: 6,
                borderWidth: 2
            }));

            this.histoAverageInstance = new window.Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.labels,
                    datasets: chartDatasets  
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        x: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Time'
                            }
                        },
                        y: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Site Average Score'
                            },
                            min: 0,
                            max: 10,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        labels: {
                            font: {
                                size: 10
                            },
                            usePointStyle: true,
                            maxWidth: 80,  
                            padding: 10
                        },
                        title: {
                            display: true,
                            text: 'Site Average Site Score Over Time',
                            font: {
                                size: 18,
                                weight: 'bold'
                            }
                            ,
                            padding: {
                                top: 10,
                                bottom: 20
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                title: function(tooltipItems) {
                                    const index = tooltipItems[0].dataIndex;
                                    const batchInfo = data.batch_ids && data.batch_ids[index] 
                                        ? ` (Batch: ${data.batch_ids[index]})` 
                                        : '';
                                    return `Time: ${data.labels[index]}${batchInfo}`;
                                },
                                label: function(context) {
                                    return `${context.dataset.label}: ${context.parsed.y}/10`;
                                }
                            } 
                        } 
                    }, 
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    }
                } 
            });
            
        } catch (error) {
            console.error("Per-site histogram chart creation error:", error);
            alert(`Per-site histogram chart creation failed: ${error.message}`);
        }
    },
    
    // Fetch and show chart data
    async handleHistoAverageChart() {
        if (!AppState.org_id) {
            alert('Organization ID not detected. Please navigate to a Mist organization page.');
            return;
        }

        const contentArea = document.getElementById('content-area');

        try {
            UIUtils.showLoading(contentArea, 'Loading historical data...');
            const response = await APIClient.sendMessage('histogram-site-average', { org_id: AppState.org_id });

            if (response) {
                await this.showHistoAverageChart(response);  
                UIUtils.hideLoading(contentArea);
            } else {
                alert(`Error loading histogram data: No data returned`);
                UIUtils.hideLoading(contentArea);
            }
        } catch (error) {
            console.error('Error handling histogram:', error);
            alert(`Error: ${error.message}`);
            UIUtils.hideLoading(contentArea);
        }
    },

    // Main method to show pie chart chart
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
                pieChartContainer.style.width = '700px';
                pieChartContainer.style.height = '500px';
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
            chartCanvas.style.width = '90%';
            chartCanvas.style.height = '90%';
            
            // Give the browser a moment to process the DOM changes
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Get the context
            const ctx = chartCanvas.getContext('2d');
            if (!ctx) {
                console.error("Failed to get canvas context");
                return;
            }

            if (typeof window.Chart === 'undefined') {
                throw new Error('Chart.js library not loaded');
            }

            // Create chart with center text plugin
            this.chartInstance = new window.Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ["Admin Score", "Auto-firmware Upgrade Score", "Password Score", "AP Firmware Score", "WLAN Template Score", "Switch Firmware Score", "Missing Points"],
                    datasets: [
                        {
                            // OUTER RING - Current Data
                            label: "Current Data",
                            data: [
                                data.admin_score,
                                data.site_firmware_score,
                                data.password_policy_score,
                                data.ap_firmware_score,
                                data.wlan_score,
                                data.switch_firmware_score,
                                Math.max(0, 60 - ((data.admin_score || 0) + (data.site_firmware_score || 0) + 
                                                (data.password_policy_score || 0) + (data.ap_firmware_score || 0) + 
                                                (data.wlan_score || 0) + (data.switch_firmware_score || 0)))
                            ],
                            backgroundColor: ['#2D6A00', '#84B135', '#0095A9', '#FF6B35','#CCDB2A', '#578A1B', '#FFFFFF'],
                            borderWidth: 3,
                            hoverOffset: 15,
                            spacing: 2,
                            // OUTER RING CONFIGURATION
                            cutout: '30%',  
                            radius: '100%'  
                        },
                        {
                            // INNER RING - Previous/Comparison Data
                            label: "Previous Data",
                            data: [
                                data.prev_admin_score || 0,        // Use actual previous data if available
                                data.prev_site_firmware_score || 0,
                                data.prev_password_policy_score || 0,
                                data.prev_ap_firmware_score || 0,
                                data.prev_wlan_score || 0,
                                data.prev_switch_firmware_score || 0,
                                Math.max(0, 60 - ((data.prev_admin_score || 0) + (data.prev_site_firmware_score || 0) + 
                                                (data.prev_password_policy_score || 0) + (data.prev_ap_firmware_score || 0) + 
                                                (data.prev_wlan_score || 0) + (data.prev_switch_firmware_score || 0)))
                            ],
                            // LIGHTER COLORS for inner ring to show distinction
                            backgroundColor: ['#4D8A20', '#A4D155', '#20B5C9', '#FF8B55','#ECFB4A', '#77AA3B', '#FFFFFF'],
                            borderWidth: 2,
                            hoverOffset: 10,
                            spacing: 1,
                            // INNER RING CONFIGURATION
                            cutout: '50%',  
                            radius: '90%'   
                        }
                    ]
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
                                    const labels = [];
                                    
                                    if (data.labels.length && data.datasets.length > 0) {
                                        const currentDataset = data.datasets[0]; // Only first dataset
                                        
                                        data.labels.forEach((label, i) => {
                                            // Skip the missing segment in legend
                                            if (label === "Missing Points" || label === "") return;
                                            
                                            const value = currentDataset.data[i] || 0;
                                            labels.push({
                                                text: `${label}: ${value}/10`, 
                                                fillStyle: currentDataset.backgroundColor[i],
                                                strokeStyle: currentDataset.backgroundColor[i],
                                                lineWidth: 0,
                                                pointStyle: 'circle',
                                                hidden: false,
                                                datasetIndex: 0, // Always reference first dataset
                                                index: i
                                            });
                                        });
                                    }
                                    
                                    return labels;
                                }
                            }
                        },
                        title: {
                            display: true,
                            text: 'Security Audit Scores - Current vs Previous',
                            font: {
                                size: 18,
                                weight: 'bold'
                            },
                            padding: {
                                top: 10,
                                bottom: 20
                            }
                        },
                        subtitle: {
                            display: true,
                            text: `Batch ID: ${data.batch_id}${data.previous_batch_id ? ` vs ${data.previous_batch_id}` : ''}`
                        },
                        tooltip: {
                            callbacks: {
                                title: function(tooltipItems) {
                                    const item = tooltipItems[0];
                                    const datasetLabel = item.dataset.label;
                                    return `${datasetLabel}: ${item.label || ''}`;
                                },
                                label: function(context) {
                                    const index = context.dataIndex;
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    const datasetLabel = context.dataset.label;
                                    
                                    // Don't show tooltip for missing segment
                                    if (label === "" || label.includes("Missing")) {
                                        return null;
                                    }
                                    
                                    return `${datasetLabel} Score: ${value}/10 points`;
                                },
                                afterLabel: function(context) {
                                    const index = context.dataIndex;
                                    const datasetIndex = context.datasetIndex;
                                    let details = '';
                                    
                                    // Only show detailed recommendations for current data (outer ring)
                                    if (datasetIndex === 0) {
                                        // Add detailed recommendations based on the segment
                                        switch(index) {
                                            case 0: // Admin Score
                                                if (data.failing_admins && Object.keys(data.failing_admins).length > 0) {
                                                    details = 'Issues found:\n' + Object.entries(data.failing_admins)
                                                        .map(([admin, issue]) => `• ${admin}: ${issue}`)
                                                        .join('\n');
                                                }
                                                break;
                                            case 1: // Site Firmware Score
                                                if (data.site_firmware_failing && Object.keys(data.site_firmware_failing).length > 0) {
                                                    details = 'Sites with issues:\n' + Object.entries(data.site_firmware_failing)
                                                        .map(([site, issue]) => `• ${site}: ${issue}`)
                                                        .join('\n');
                                                }
                                                break;
                                            case 2: // Password Policy Score
                                                if (data.password_policy_recs && Object.keys(data.password_policy_recs).length > 0) {
                                                    details = 'Recommendations:\n' + Object.entries(data.password_policy_recs)
                                                        .map(([key, rec]) => `• ${key}: ${rec}`)
                                                        .join('\n');
                                                }
                                                break;
                                            case 3: // AP Firmware Score
                                                if (data.ap_firmware_recs && Object.keys(data.ap_firmware_recs).length > 0) {
                                                    details = 'AP Firmware Issues:\n' + Object.entries(data.ap_firmware_recs)
                                                        .map(([serial, rec]) => `• ${serial}: ${rec}`)
                                                        .join('\n');
                                                }
                                                break;
                                            case 4: // WLAN Score
                                                if (data.wlan_recs && Object.keys(data.wlan_recs).length > 0) {
                                                    details = 'WLAN Recommendations:\n' + Object.entries(data.wlan_recs)
                                                        .map(([ssid, recs]) => {
                                                            if (typeof recs === 'object') {
                                                                return `• ${ssid}:\n  ${Object.values(recs).join('\n  ')}`;
                                                            }
                                                            return `• ${ssid}: ${recs}`;
                                                        })
                                                        .join('\n');
                                                }
                                                break;
                                            case 5: // Switch Firmware Score
                                                if (data.switch_firmware_recs && Object.keys(data.switch_firmware_recs).length > 0) {
                                                    details = 'Switch Firmware Issues:\n' + Object.entries(data.switch_firmware_recs)
                                                        .map(([serial, rec]) => `• ${serial}: ${rec}`)
                                                        .join('\n');
                                                }
                                                break;
                                            default:
                                                details = '';
                                        }
                                    } else {
                                        // For previous data, show comparison
                                        const currentValue = chart.data.datasets[0].data[index] || 0;
                                        const previousValue = context.parsed || 0;
                                        const change = currentValue - previousValue;
                                        const changeText = change > 0 ? `+${change}` : `${change}`;
                                        details = `Change from previous: ${changeText} points`;
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
                            mode: 'nearest',
                            intersect: false
                        }
                    },
                    onClick: (event, elements) => {
                        if (elements.length > 0) {
                            const element = elements[0];
                            const datasetIndex = element.datasetIndex;
                            const index = element.index;
                            const dataset = this.chartInstance.data.datasets[datasetIndex];
                            const label = this.chartInstance.data.labels[index];
                            const value = dataset.data[index];
                            
                            alert(`${dataset.label} - ${label}: ${value}/10`);
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
    },
}


const tableManager = {
    
    currentTableData: null,
    currentTableType: null,
    
    async showSwitchesTable() {
        try {
            const contentArea = document.getElementById('content-area');

            UIUtils.showLoading(contentArea);

            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: 'switches',
                    org_id: AppState.org_id
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    if (response && response.success) {
                        resolve(response.data);
                    } else {
                        reject(new Error(response?.error || 'Unknown error'));
                    }
                });
            });
            
            UIUtils.hideLoading(contentArea);

            if (response?.switch_list) {
                const switchesArray = this.transformSwitchDataToArray(response.switch_list);
                this.showTable(switchesArray, 'switches');
            } else {
                UIUtils.showError(DOMElements.contentArea, 'No switches data available');
            }
            
        } catch (error) {
            console.error('Error loading switches table:', error);
            UIUtils.showError(DOMElements.contentArea, `Failed to load switches: ${error.message}`);
        } finally {
            UIUtils.hideLoading(DOMElements.contentArea);
        }
    },
    
    async showAPsTable() {
        try {
            const contentArea = document.getElementById('content-area');

            UIUtils.showLoading(contentArea);

            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: 'aps',
                    org_id: AppState.org_id
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    if (response && response.success) {
                        resolve(response.data);
                    } else {
                        reject(new Error(response?.error || 'Unknown error'));
                    }
                });
            });
            
            UIUtils.hideLoading(contentArea);

            if (response?.ap_list) {
                const apsArray = this.transformAPDataToArray(response.ap_list);
                this.showTable(apsArray, 'aps');
            } else {
                UIUtils.showError(DOMElements.contentArea, 'No APs data available');
            }
            
        } catch (error) {
            console.error('Error loading APs table:', error);
            UIUtils.showError(DOMElements.contentArea, `Failed to load APs: ${error.message}`);
        } finally {
            UIUtils.hideLoading(DOMElements.contentArea);
        }
    },

    transformSwitchDataToArray(switchData) {
        const switchesArray = [];
        
        for (const [serial_address, details] of Object.entries(switchData)) {
            if (Array.isArray(details) && details.length >= 4) {
                switchesArray.push({
                    serial_address: serial_address,
                    model: details[0] || 'Unknown',
                    type: details[1] || 'Unknown',
                    firmware_version: details[2] || 'Unknown',
                    site_id: details[3] || 'Unknown',
                    device_type: 'Switch',
                    status: 'Active'
                });
            }
        }
        
        return switchesArray;
    },

    transformAPDataToArray(apData) {
        const apsArray = [];
        
        for (const [serial_address, details] of Object.entries(apData)) {
            if (Array.isArray(details) && details.length >= 4) {
                apsArray.push({
                    serial_address: serial_address,
                    model: details[0] || 'Unknown',
                    type: details[1] || 'Unknown',
                    firmware_version: details[2] || 'Unknown',
                    site_id: details[3] || 'Unknown',
                    device_type: 'Access Point',
                    radio_status: 'Up' 
                });
            }
        }
        
        return apsArray;
    },

    showTable(data, tableType = 'generic') {
        try {
            // Validate data
            if (!Array.isArray(data) || data.length === 0) {
                UIUtils.showError(DOMElements.contentArea, `No ${tableType} data to display`);
                return;
            }
            
            // Store current data
            this.currentTableData = data;
            this.currentTableType = tableType;
            
            // Show and populate table
            this.displayTable(data, tableType);
            
        } catch (error) {
            console.error('Error creating table:', error);
            UIUtils.showError(DOMElements.contentArea, `Table creation failed: ${error.message}`);
        }
    },

    displayTable(data, tableType) {
        // Get table elements - FIXED IDs to match HTML
        const tableContainer = document.getElementById('table-container');
        const tableTitle = document.getElementById('table-title');
        const itemCount = document.getElementById('table-item-count'); 
        const tableHead = document.getElementById('table-head');
        const tableBody = document.getElementById('table-body');
        
        // FIXED: Make itemCount optional since it might not exist
        if (!tableContainer || !tableTitle || !tableHead || !tableBody) {
            console.error('Critical table elements not found in DOM');
            console.error('Missing elements:', {
                tableContainer: !!tableContainer,
                tableTitle: !!tableTitle,
                tableHead: !!tableHead,
                tableBody: !!tableBody
            });
            return;
        }
        
        // Add table-active class to body for layout adjustments
        document.body.classList.add('table-active');
        
        // Show table container
        tableContainer.style.display = 'block';
        
        // Set title and count
        const titleText = tableType.charAt(0).toUpperCase() + tableType.slice(1);
        tableTitle.textContent = `${titleText} Data`;
        
        // FIXED: Only set item count if element exists
        if (itemCount) {
            itemCount.textContent = `(${data.length} items)`;
        }
        
        // Generate table header
        this.generateTableHeader(tableHead, tableType);
        
        // Generate table body
        this.generateTableBody(tableBody, data, tableType);
        
        // Add event listeners
        this.addTableEventListeners();
        
        console.log(`${tableType} table displayed with ${data.length} rows`);
    },

    generateTableHeader(tableHead, tableType) {
        const columns = this.getTableColumns(tableType);
        
        const headerHTML = columns.map(col => 
            `<th data-field="${col.field}" title="Click to sort">
                ${col.title} <span class="sort-indicator">↕️</span>
            </th>`
        ).join('');
        
        tableHead.innerHTML = `<tr>${headerHTML}</tr>`;
    },

    generateTableBody(tableBody, data, tableType) {
        const columns = this.getTableColumns(tableType);
        
        const rowsHTML = data.map((row, index) => {
            const cellsHTML = columns.map(col => {
                const value = row[col.field] || 'Unknown';
                return `<td>${this.escapeHtml(value)}</td>`;
            }).join('');
            
            return `<tr data-row-index="${index}">${cellsHTML}</tr>`;
        }).join('');
        
        tableBody.innerHTML = rowsHTML;
    },

    addTableEventListeners() {
        // Remove existing listeners to prevent duplicates
        this.removeTableEventListeners();
        
        // Close button
        const closeBtn = document.getElementById('close-table-btn');
        if (closeBtn) {
            this.closeHandler = () => this.hideTable();
            closeBtn.addEventListener('click', this.closeHandler);
        }
        
        // Export CSV button
        const exportBtn = document.getElementById('export-csv-btn');
        if (exportBtn) {
            this.exportHandler = () => this.exportToCSV();
            exportBtn.addEventListener('click', this.exportHandler);
        }
        
        // Search functionality
        const searchInput = document.getElementById('table-search');
        if (searchInput) {
            this.searchHandler = (e) => this.filterTable(e.target.value);
            searchInput.addEventListener('input', this.searchHandler);
        }
        
        // Clear search
        const clearBtn = document.getElementById('clear-search-btn');
        if (clearBtn) {
            this.clearHandler = () => {
                const searchInput = document.getElementById('table-search');
                if (searchInput) {
                    searchInput.value = '';
                    this.filterTable('');
                }
            };
            clearBtn.addEventListener('click', this.clearHandler);
        }
        
        // Column sorting - FIXED selector to match actual table
        const headers = document.querySelectorAll('#data-table th[data-field]');
        this.sortHandlers = new Map();
        headers.forEach(header => {
            const handler = () => {
                const field = header.dataset.field;
                this.sortTable(field);
            };
            this.sortHandlers.set(header, handler);
            header.addEventListener('click', handler);
        });
        
        // ESC key to close
        this.escHandler = (e) => {
            if (e.key === 'Escape') {
                this.hideTable();
            }
        };
        document.addEventListener('keydown', this.escHandler);
    },

    removeTableEventListeners() {
        // Remove specific handlers to prevent memory leaks
        const closeBtn = document.getElementById('close-table-btn');
        if (closeBtn && this.closeHandler) {
            closeBtn.removeEventListener('click', this.closeHandler);
        }
        
        const exportBtn = document.getElementById('export-csv-btn');
        if (exportBtn && this.exportHandler) {
            exportBtn.removeEventListener('click', this.exportHandler);
        }
        
        const searchInput = document.getElementById('table-search');
        if (searchInput && this.searchHandler) {
            searchInput.removeEventListener('input', this.searchHandler);
        }
        
        const clearBtn = document.getElementById('clear-search-btn');
        if (clearBtn && this.clearHandler) {
            clearBtn.removeEventListener('click', this.clearHandler);
        }
        
        // Remove sort handlers
        if (this.sortHandlers) {
            this.sortHandlers.forEach((handler, element) => {
                element.removeEventListener('click', handler);
            });
            this.sortHandlers.clear();
        }
        
        // Remove ESC handler
        if (this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
        }
    },

    filterTable(searchTerm) {
        // FIXED - Use correct table body ID and add item count update
        const tableBody = document.getElementById('table-body');
        const itemCount = document.getElementById('table-item-count');
        
        if (!tableBody) return;
        
        const rows = tableBody.querySelectorAll('tr');
        const term = searchTerm.toLowerCase().trim();
        let visibleCount = 0; 
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const isVisible = !term || text.includes(term);
            row.style.display = isVisible ? '' : 'none';
            if (isVisible) visibleCount++; 
        });
        
        // FIXED: Update item count display
        if (itemCount) {
            const totalCount = this.currentTableData ? this.currentTableData.length : 0;
            itemCount.textContent = visibleCount === totalCount ? 
                `(${totalCount} items)` : 
                `(${visibleCount} of ${totalCount} items)`;
        }
    }, // FIXED: Added missing comma

    sortTable(field) {
        if (!this.currentTableData) return;
        
        // Determine sort direction
        const header = document.querySelector(`th[data-field="${field}"]`);
        if (!header) return;
        
        const currentSort = header.dataset.sortDir || 'none';
        const newSort = currentSort === 'asc' ? 'desc' : 'asc';
        
        // Clear all sort indicators
        document.querySelectorAll('th[data-field]').forEach(th => {
            th.dataset.sortDir = 'none';
            const indicator = th.querySelector('.sort-indicator');
            if (indicator) indicator.textContent = '↕️';
        }); // FIXED: Removed extra semicolon and closing brace
        
        // Set new sort
        header.dataset.sortDir = newSort;
        const indicator = header.querySelector('.sort-indicator');
        if (indicator) indicator.textContent = newSort === 'asc' ? '↑' : '↓';
        
        // Sort data
        const sortedData = [...this.currentTableData].sort((a, b) => {
            const aVal = (a[field] || '').toString().toLowerCase();
            const bVal = (b[field] || '').toString().toLowerCase();
            
            if (newSort === 'asc') {
                return aVal.localeCompare(bVal);
            } else {
                return bVal.localeCompare(aVal);
            }
        });
        
        // Update table body - FIXED: Added const declaration
        const tableBody = document.getElementById('table-body');
        if (tableBody) {
            this.generateTableBody(tableBody, sortedData, this.currentTableType);
            
            // Reapply current search filter
            const searchInput = document.getElementById('table-search');
            if (searchInput && searchInput.value) {
                this.filterTable(searchInput.value);
            }
        }
    },

    exportToCSV() {
        if (!this.currentTableData || this.currentTableData.length === 0) {
            alert('No data to export');
            return;
        }
        
        const columns = this.getTableColumns(this.currentTableType);
        const headers = columns.map(col => col.title);
        
        // Get visible rows only
        const visibleData = this.getVisibleTableData();
        
        // Create CSV content
        const csvContent = [
            headers.join(','),
            ...visibleData.map(row => 
                columns.map(col => {
                    const value = row[col.field] || '';
                    return `"${value.toString().replace(/"/g, '""')}"`;
                }).join(',')
            )
        ].join('\n');
        
        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentTableType}_data_${new Date().toISOString().split('T')[0]}.csv`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        console.log(`Exported ${visibleData.length} rows to CSV`);
    },

    getVisibleTableData() {
        if (!this.currentTableData) return [];
        
        // FIXED - Use correct table body ID
        const tableBody = document.getElementById('table-body');
        if (!tableBody) return this.currentTableData;
        
        const visibleRows = [];
        const rows = tableBody.querySelectorAll('tr');
        
        rows.forEach(row => {
            if (row.style.display !== 'none') {
                const index = parseInt(row.dataset.rowIndex);
                if (!isNaN(index) && this.currentTableData[index]) {
                    visibleRows.push(this.currentTableData[index]);
                }
            }
        });
        
        return visibleRows.length > 0 ? visibleRows : this.currentTableData;
    },

    getTableColumns(tableType) {
        const baseColumns = [
            {title: "Serial No.", field: "serial_address"},
            {title: "Model", field: "model"},
            {title: "Type", field: "type"},
            {title: "Firmware Version", field: "firmware_version"},
            {title: "Site ID", field: "site_id"},
            {title: "Device Type", field: "device_type"}
        ];
        
        switch (tableType) {
            case 'switches':
                return [
                    ...baseColumns,
                    {title: "Status", field: "status"}
                ];
                
            case 'aps':
                return [
                    ...baseColumns,
                    {title: "Radio Status", field: "radio_status"}
                ];
                
            default:
                return baseColumns;
        }
    },

    hideTable() {
        // Remove event listeners
        this.removeTableEventListeners();
        
        // Remove table-active class from body
        document.body.classList.remove('table-active');
        
        // Hide table container - FIXED ID
        const tableContainer = document.getElementById('table-container');
        if (tableContainer) {
            tableContainer.style.display = 'none';
        }
        
        // Show content area
        if (DOMElements.contentArea) {
            DOMElements.contentArea.style.display = 'block';
        }
        
        // Reset search - FIXED ID
        const searchInput = document.getElementById('table-search');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Reset state
        this.currentTableData = null;
        this.currentTableType = null;
        
        console.log('Table hidden and content area restored');
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    // Helper methods for external access
    getCurrentData() {
        return this.currentTableData || [];
    },
    
    refreshTable() {
        if (this.currentTableData && this.currentTableType) {
            this.displayTable(this.currentTableData, this.currentTableType);
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

    async resetDBConn() {
        await TabManager.updateTabInfo();

        if (!AppState.org_id || !AppState.currentTab?.url) {
            alert('Organization ID or URL not detected');
            return;
        }

        const url = new URL(AppState.currentTab.url);
        const apiUrl = URLUtils.getApiUrl(url.hostname);

        await SettingsManager.resetDbConnection(AppState.org_id);

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
    
    async handledbKeySubmit() {
        const { dbAddressInput, dbNameInput, dbPassInput, dbPortInput, dbUserInput, dbSubmitButton } = DOMElements;

        // Check if all DOM elements exist
        if (!dbAddressInput || !dbNameInput || !dbPassInput || !dbPortInput || !dbUserInput) {
            alert('Database configuration form elements not found');
            return;
        }

        // Get values and trim whitespace
        const dbAddress = dbAddressInput.value.trim();
        const dbUser = dbUserInput.value.trim();
        const dbPass = dbPassInput.value.trim();
        const dbPort = dbPortInput.value.trim();
        const dbName = dbNameInput.value.trim();

        // Validate the actual values
        if (!dbAddress || !dbUser || !dbPass || !dbPort || !dbName) {
            alert('All database fields are required. Please fill in all fields.');
            return;
        }

        // Validate port number
        const portNumber = parseInt(dbPort, 10);
        if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
            alert('Please enter a valid port number (1-65535)');
            return;
        }

        // Validate database name format
        if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
            alert('Database name can only contain letters, numbers, and underscores');
            return;
        }

        // Update tab info to get current context
        await TabManager.updateTabInfo();

        if (!AppState.org_id || !AppState.currentTab?.url) {
            alert('Organization ID or URL not detected. Please navigate to a Mist organization page.');
            return;
        }

        // Disable the submit button during processing
        if (dbSubmitButton) {
            dbSubmitButton.disabled = true;
            dbSubmitButton.textContent = "Testing Connection...";
        }

        try {
            const response = await SettingsManager.submitdbConfigKey(dbUser, dbPass, dbAddress, dbPort, dbName);

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
                        successMsg.textContent = `Database connected: ${config.user}@${config.host}:${config.port}/${config.database}`;
                    } else {
                        successMsg.textContent = 'Database configuration saved successfully';
                    }
                    
                    container.appendChild(successMsg);
                }
                
                // Clear form fields for security
                dbPassInput.value = '';
                
                // Show global success message
                SettingsManager.showMessage('Database configuration successful', 'success', 'db-config-msg');
                
            } else {
                throw new Error(response?.error || 'Database configuration failed');
            }

        } catch (error) {
            console.error('Database configuration error:', error);
            
            // Show error message
            const container = dbAddressInput.parentElement;
            if (container) {
                // Remove any existing messages
                const existingMsgs = container.querySelectorAll('.db-message');
                existingMsgs.forEach(msg => msg.remove());
                
                // Add error message
                const errorMsg = document.createElement('p');
                errorMsg.className = 'db-message db-error-msg paragraphs';
                errorMsg.style.color = '#d32f2f';
                errorMsg.style.marginTop = '10px';
                errorMsg.textContent = `${error.message}`;
                
                container.appendChild(errorMsg);
            }
            
            alert('Database configuration failed: ' + error.message);
            
        } finally {
            // Re-enable the submit button
            if (dbSubmitButton) {
                dbSubmitButton.disabled = false;
                dbSubmitButton.textContent = "Test & Save Database Config";
            }
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

function hideAllUIElements() {
    ChartManager.hideChart();
    ChartManager.hideSettings();
    ChartManager.hideHistoChart();
    ChartManager.hideAverageHistoChart();
    tableManager.hideTable();
}

// Event listeners setup
function setupEventListeners() {
    // Cache DOM elements
    DOMElements.popupContent = document.querySelector('.popup-content');
    DOMElements.settingsMenu = document.getElementById('settings-menu');
    DOMElements.apiURLElem = document.getElementById('api-url');
    DOMElements.orgidElem = document.getElementById('org-id');
    DOMElements.siteidElem = document.getElementById('site-id');
    DOMElements.apiInput = document.getElementById('api-input-box');
    DOMElements.dbPassInput = document.getElementById('db-pass-input');
    DOMElements.dbAddressInput = document.getElementById('db-address-input');
    DOMElements.dbPortInput = document.getElementById('db-port-input');
    DOMElements.dbNameInput = document.getElementById('db-database-input');
    DOMElements.dbUserInput = document.getElementById('db-user-input');
    DOMElements.apiSubmitButton = document.getElementById('submit-button');
    DOMElements.dbSubmitButton = document.getElementById('db-submit-button');
    DOMElements.purgeBtn = document.getElementById('purge-api-btn');
    DOMElements.dbMenu = document.getElementById('db-menu');
    const radioButtons = document.querySelectorAll('input[name="db-selection"]');

    // Action button listeners
    document.querySelectorAll('.action-button').forEach(button => {
        button.addEventListener('click', async () => {
            UIUtils.setButtonClicked(button);

            const action = button.getAttribute('data-action');

            if (action === 'settings') {
                hideAllUIElements();
                await ActionHandlers.handleSettingsAction();
            } else if (action === 'pie') {
                hideAllUIElements();
                await ChartManager.handlePieChart();
            } else if (action === 'histogram') {
                hideAllUIElements();
                await ChartManager.handleHistoChart();
            } else if (action === 'histogram-site-average') {
                hideAllUIElements();
                await ChartManager.handleHistoAverageChart();
            } else if (action === 'switches') {
                hideAllUIElements();
                await tableManager.showSwitchesTable()
            } else if (action === 'aps') {
                hideAllUIElements();
                await tableManager.showAPsTable()
            } else if (action === 'fetch-new') {
                hideAllUIElements();
                await ActionHandlers.handleFetchNewAction();
            } else {
                // Hide settings menu for non-settings actions
                if (DOMElements.settingsMenu) {
                    DOMElements.settingsMenu.style.display = 'none';
                }
                await ActionHandlers.handleDataAction(action);
            }
        });
    });


    radioButtons.forEach((radio) => {
        radio.addEventListener('change', (event) => {
            if (event.target.checked) {
                const selectedOption = event.target.value;
                const labelText = document.querySelector(`label[for="${event.target.id}"]`).textContent;
                const output = document.querySelector('#db-output');
                
                if (output) {
                    output.innerHTML = `You selected: ${labelText} (${selectedOption})`;
                }
                
                if (selectedOption === "local") { 
                    DOMElements.dbMenu.style.display = 'block';
                } else {
                    DOMElements.dbMenu.style.display = 'none';
                    ActionHandlers.resetDBConn(); 
                }
            }
        });
    });

    // Set initial state - hide menu since "remote" is checked by default
    DOMElements.dbMenu.style.display = 'none';

    // API key submit listener
    if (DOMElements.apiSubmitButton) {
        DOMElements.apiSubmitButton.addEventListener('click', ActionHandlers.handleApiKeySubmit);
    }

    if (DOMElements.dbSubmitButton) {
        DOMElements.dbSubmitButton.addEventListener('click', ActionHandlers.handledbKeySubmit);
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