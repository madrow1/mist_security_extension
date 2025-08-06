import { AppState } from './app-state.js';         
import { UIUtils } from './ui-utils.js';            
import { DOMElements } from './dom-elements.js';

export const tableManager = {
    
    currentTableData: null,
    currentTableType: null,
    
    async showSwitchesTable() {
        try {
            UIUtils.showLoading(DOMElements.contentArea, 'Loading switches data...');
            
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
            UIUtils.showLoading(DOMElements.contentArea, 'Loading APs data...');
            
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
