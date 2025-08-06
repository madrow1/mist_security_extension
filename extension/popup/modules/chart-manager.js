import { AppState } from './app-state.js';         
import { UIUtils } from './ui-utils.js';            
import { APIClient } from './api-client.js';     
import { enhancedCenterTextPlugin } from '../plugins/chart.js';
import { DOMElements } from './dom-elements.js';

export const ChartManager = {
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
            
            if (this.histoAverageInstance) {
                this.histoAverageInstance.destroy();
                this.histoAverageInstance = null;
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

    // Add to ChartManager
    destroyAllCharts() {
        if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }
        if (this.histoChartInstance) {
            this.histoChartInstance.destroy();
            this.histoChartInstance = null;
        }
        if (this.histoAverageInstance) {
            this.histoAverageInstance.destroy();
            this.histoAverageInstance = null;
        }
    },

    hideAllViews() {
        this.destroyAllCharts();
        document.getElementById('pie-chart').style.display = 'none';
        document.getElementById('histo-chart').style.display = 'none';
        document.getElementById('histo-average-chart').style.display = 'none';
        document.getElementById('settings-menu').style.display = 'none';
        document.getElementById('content-area').style.display = 'block';
        document.getElementById('table-container').style.display = 'none';
        document.body.classList.remove('chart-expanded');
    }
};