import { DOMElements } from './dom-elements.js';      
import { UIUtils } from './ui-utils.js';             
import { ChartManager } from './chart-manager.js';  
import { ActionHandlers } from './action-handlers.js';  
import { tableManager } from './table-manager.js';

function safeCall(fn, context, ...args) {
    try {
        if (typeof fn === 'function') {
            return fn.apply(context, args);
        } else {
            console.error('Attempted to call non-function:', fn);
        }
    } catch (error) {
        console.error('Error in function call:', error);
        throw error; // Re-throw to maintain error chain
    }
}

export function setupEventListeners() {
    const requiredElements = [
        { name: 'apiSubmitButton', element: DOMElements.apiSubmitButton },
        { name: 'dbSubmitButton', element: DOMElements.dbSubmitButton },
        { name: 'purgeBtn', element: DOMElements.purgeBtn },
        { name: 'apiInput', element: DOMElements.apiInput },
        { name: 'dbMenu', element: DOMElements.dbMenu }
    ];

    const missingElements = requiredElements.filter(item => !item.element);
    if (missingElements.length > 0) {
        console.warn('Missing required DOM elements for event listeners:', 
                    missingElements.map(item => item.name));
    }

    // Action button listeners
    const actionButtons = document.querySelectorAll('.action-button');
    if (actionButtons.length === 0) {
        console.warn('No action buttons found for event listeners');
    }

    actionButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const action = button.getAttribute('data-action');
            
            // Hide all views once
            ChartManager.hideAllViews();
            
            // Show specific view
            if (action === 'settings') {
                await ActionHandlers.handleSettingsAction();
            } else if (action === 'pie') {
                await ChartManager.handlePieChart();
            } else if (action === 'histogram') {
                await ChartManager.handleHistoChart();
            } else if (action === 'histogram-site-average') {
                await ChartManager.handleHistoAverageChart();
            } else if (action === 'switches') {
                await tableManager.showSwitchesTable();
            } else if (action === 'aps') {
                await tableManager.showAPsTable();
            } else if (action === 'cve-feed') {
                // Handle APS action
            } else if (action === 'fetch-new') {
                await ActionHandlers.handleFetchNewAction();
            } else {
                // Handle data action
                await ActionHandlers.handleDataAction(action);
            }
        });
    });

    // Radio button listeners
    const radioButtons = document.querySelectorAll('input[name="db-selection"]');
    if (radioButtons.length === 0) {
        console.warn('No database selection radio buttons found');
    }
    
    radioButtons.forEach((radio) => {
        radio.addEventListener('change', (event) => {
            if (event.target.checked) {
                const selectedOption = event.target.value;
                
                const labelElement = document.querySelector(`label[for="${event.target.id}"]`);
                const labelText = labelElement ? labelElement.textContent : 'Unknown';
                
                const output = document.querySelector('#db-output');
                
                if (output) {
                    output.innerHTML = `You selected: ${labelText} (${selectedOption})`;
                }
                
                if (selectedOption === "local") { 
                    if (DOMElements.dbMenu) {  
                        DOMElements.dbMenu.style.display = 'block';
                    }
                } else {
                    if (DOMElements.dbMenu) {  
                        DOMElements.dbMenu.style.display = 'none';
                    }
                    ActionHandlers.resetDBConn(); 
                }
            }
        });
    });

    // Set initial state - hide menu since "remote" is checked by default
    if (DOMElements.dbMenu) {  
        DOMElements.dbMenu.style.display = 'none';
    }

    // API key submit listener
    if (DOMElements.apiSubmitButton) {
        DOMElements.apiSubmitButton.addEventListener('click', ActionHandlers.handleApiKeySubmit);
    }

    if (DOMElements.dbSubmitButton) {
        DOMElements.dbSubmitButton.addEventListener('click', ActionHandlers.handleDbKeySubmit);
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

    console.log('Event listeners setup completed');
}

export function removeEventListeners() {
    // Remove action button listeners
    document.querySelectorAll('.action-button').forEach(button => {
        button.replaceWith(button.cloneNode(true)); // Removes all listeners
    });

    // Remove radio button listeners
    const radioButtons = document.querySelectorAll('input[name="db-selection"]');
    radioButtons.forEach(radio => {
        radio.replaceWith(radio.cloneNode(true));
    });

    // Remove submit button listeners
    if (DOMElements.apiSubmitButton) {
        DOMElements.apiSubmitButton.replaceWith(DOMElements.apiSubmitButton.cloneNode(true));
    }

    if (DOMElements.dbSubmitButton) {
        DOMElements.dbSubmitButton.replaceWith(DOMElements.dbSubmitButton.cloneNode(true));
    }

    if (DOMElements.purgeBtn) {
        DOMElements.purgeBtn.replaceWith(DOMElements.purgeBtn.cloneNode(true));
    }

    console.log('Event listeners removed');
}