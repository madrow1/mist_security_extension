// Import all modules
import { AppState } from './modules/app-state.js';
import { DOMElements, initializeDOMElements } from './modules/dom-elements.js';
import { TabManager } from './modules/tab-manager.js';
import { ActionHandlers } from './modules/action-handlers.js';
import { setupEventListeners } from './modules/event-listeners.js';
import { URLUtils } from './modules/url-utils.js';
import { UIUtils } from './modules/ui-utils.js';
import { ValidationUtils } from './modules/validation.js';

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
});

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize DOM elements cache
        initializeDOMElements();
        
        // Setup event listeners
        setupEventListeners();
        
        // Initialize tab info
        await TabManager.updateTabInfo();
        
        // Update data status
        await ActionHandlers.updateDataStatus();
        
        console.log('Mist Security Audit Extension initialized successfully');
    } catch (error) {
        console.error('Error initializing extension:', error);
    }
});
