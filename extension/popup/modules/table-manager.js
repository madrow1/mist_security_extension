import { AppState } from './app-state.js';         
import { UIUtils } from './ui-utils.js';            
import { APIClient } from './api-client.js';     
import { DOMElements } from './dom-elements.js';

export const tableManager = {
    
    tableInstance: null,
    
    async showSwitchesTable() {
        try {
            UIUtils.showLoading(DOMElements.contentArea, 'Loading switches data...');
            
            const response = await APIClient.sendMessage('switches', {
                org_id: AppState.org_id,
                site_id: AppState.site_id
            });
            
            if (response?.data) {
                await this.showTable(response.data);
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
            
            const response = await APIClient.sendMessage('aps', {
                org_id: AppState.org_id,
                site_id: AppState.site_id
            });
            
            if (response?.data) {
                await this.showTable(response.data);
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
    
    async getTableData() {
        // Default sample data if no specific data is provided
        return [
            {id: 1, name: "Sample Device", progress: 95, gender: "N/A", rating: 5, col: "green", dob: "2023-01-01", car: true},
            {id: 2, name: "Test Device", progress: 80, gender: "N/A", rating: 4, col: "blue", dob: "2023-02-01", car: false},
        ];
    },
    
    hideTable() {
        if (this.tableInstance) {
            this.tableInstance.destroy();
            this.tableInstance = null;
        }
        
        const tableContainer = document.getElementById('table-container');
        if (tableContainer) {
            tableContainer.style.display = 'none';
        }
    },
    
    refreshTable() {
        if (this.tableInstance) {
            this.tableInstance.redraw();
        }
    }
};