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

// Plugin that I absolutely did steal from stack overflow which creates a centre text on the doughnut and colours it according to the sites overall score
const enhancedCenterTextPlugin = {
    id: 'enhancedCenterText',
    beforeDraw(chart) {
        const { ctx, chartArea: { left, top, width, height } } = chart;
        const data = chart.data.datasets[0].data;
        const validScores = data.filter(score => score !== null && score !== undefined);
       
        // only scores uses a slice to take all scores included except the last one so that when the final value is calculated it is - the empty segment
        let onlyScores = data.slice(0, -1)

        // data.length - 1 because we don't want to include the empty segment in our total scoring
        const maxPossibleScore = (data.length-1) * 10; 
        
        // Slight modification here so that the score is dynamically updated to reflect new tests being added
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

            this.histoChartInstance = new Chart(ctx, {
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
                            data: data.switch_firmware_score,
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
                    maintainAspectRatio: false,
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
                        title: {
                            display: true,
                            text: 'Security Scores Over Time',
                            font: {
                                size: 18,
                                weight: 'bold'
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

        const contentArea = document.getElementById('content-area');

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

            this.histoAverageInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.labels,
                    datasets: chartDatasets  
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Time',
                                font: {
                                    size: 14,
                                    weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Average Security Score per Site',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        min: 0,
                        max: 10,
                        ticks: {
                            stepSize: 1,
                            callback: function(value) {
                                return value + '/10';
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: {
                                size: 10
                            },
                            usePointStyle: true,
                            maxWidth: 80,  
                            padding: 10
                        }
                    },
                    title: {
                        display: true,
                        text: `Security Scores per Site Over Time (${data.site_count} sites)`,
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: {
                            top: 10,
                            bottom: 20
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#333',
                        borderWidth: 1,
                        cornerRadius: 6,
                        callbacks: {
                            title: function(tooltipItems) {
                                const index = tooltipItems[0].dataIndex;
                                const batchInfo = data.batch_ids && data.batch_ids[index] 
                                    ? ` (Batch: ${data.batch_ids[index]})` 
                                    : '';
                                return `Time: ${data.labels[index]}${batchInfo}`;
                            },
                            label: function(context) {
                                const score = context.parsed.y;
                                const siteData = data.datasets[context.datasetIndex];
                                return `${context.dataset.label}: ${score.toFixed(1)}/10`;
                            },
                            afterBody: function(tooltipItems) {
                                return `${tooltipItems.length} sites shown at this time point`;
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                elements: {
                    point: {
                        hoverBackgroundColor: '#ffffff',
                        hoverBorderWidth: 3
                    },
                    line: {
                        tension: 0.1
                    }
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

            // Create chart with center text plugin
            this.chartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    // Labels/datasets/backgroundcolour all need to be updated every time a new test is added, the "" initialises an empty label for the white space
                    labels: ["Admin Score", "Auto-firmware Upgrade Score", "Password Score", "AP Firmware Score", "WLAN Template Score", "Switch Firmware Score", ""],
                    datasets: [{
                        data: [
                            data.admin_score,
                            data.site_firmware_score,
                            data.password_policy_score,
                            data.ap_firmware_score,
                            data.wlan_score,
                            data.switch_firmware_score,
                            // This TODO needs to be updated every time a new test is added
                            Math.max(1, 50 - ((data.admin_score || 0) + (data.site_firmware_score || 0) + (data.password_policy_score || 0) + (data.ap_firmware_score || 0) + (data.wlan_score || 0) +
                        (data.switch_firmware_score || 0 )))],
                        backgroundColor: ['#2D6A00', '#84B135', '#0095A9', '#FF6B35','#CCDB2A', '#578A1B', '#FFFFFF'],
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
                                    
                                    // Add detailed recommendations based on the segment all detail here is drawn from the database for speed
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
                                        case 5: // Switch Firmware Score
                                                details = 'Switch Firmware Issues:\n' + Object.entries(data.switch_firmware_recs)
                                                    .map(([serial, rec]) => `• ${serial}: ${rec}`)
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

// Add this before setupEventListeners function, new TODO eventListeners need to be added every time one is added
const DOMElements = {
    popupContent: null,
    settingsMenu: null,
    apiURLElem: null,
    orgidElem: null,
    siteidElem: null,
    apiInput: null,
    apiSubmitButton: null,
    purgeBtn: null,
    dbPassInput: null,
    dbNameInput: null,
    dbPortInput: null,
    dbUserInput: null,
    dbAddressInput: null
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
                ChartManager.hideChart()
                await ActionHandlers.handleSettingsAction();
                ChartManager.hideHistoChart()
                ChartManager.hideAverageHistoChart()
            } else if (action === 'pie') {
                await ChartManager.handlePieChart();
                ChartManager.hideSettings()
                ChartManager.hideHistoChart()
                ChartManager.hideAverageHistoChart()
            } else if (action === 'histogram') {
                await ChartManager.handleHistoChart();
                ChartManager.hideChart()
                ChartManager.hideSettings()
                ChartManager.hideAverageHistoChart()
            } else if (action === 'histogram-site-average') {
                await ChartManager.handleHistoAverageChart();
                ChartManager.hideChart()
                ChartManager.hideSettings()
                ChartManager.hideHistoChart()
            } else if (action === 'switches') {
                ChartManager.hideChart()
                ChartManager.hideSettings()
                ChartManager.hideHistoChart()
                ChartManager.hideAverageHistoChart()
            } else if (action === 'aps') {
                ChartManager.hideChart()
                ChartManager.hideSettings()
                ChartManager.hideHistoChart()
                ChartManager.hideAverageHistoChart()
            } else if (action === 'fetch-new') {
                ChartManager.hideSettings()
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
