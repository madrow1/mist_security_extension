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
                            text: 'Security Average Site Score Over Time',
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

            if (typeof window.Chart === 'undefined') {
                throw new Error('Chart.js library not loaded');
            }

            // Create chart with center text plugin
            this.chartInstance = new window.Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ["Admin Score", "Auto-firmware Upgrade Score", "Password Score", "AP Firmware Score", "WLAN Template Score", "Switch Firmware Score", ""],
                    datasets: [{
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
                        cutout: '60%',
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