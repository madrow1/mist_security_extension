// DOM element caching
export const DOMElements = {
    // Content areas
    popupContent: null,
    contentArea: null,           
    settingsMenu: null,
    
    // Display elements
    apiURLElem: null,
    orgidElem: null,
    siteidElem: null,
    
    // Input elements
    apiInput: null,
    dbAddressInput: null,
    dbUserInput: null,
    dbPassInput: null,
    dbPortInput: null,
    dbNameInput: null,
    
    // Button elements
    apiSubmitButton: null,
    dbSubmitButton: null,
    purgeBtn: null,
    
    // Menu elements
    dbMenu: null,
    
    // Chart containers
    pieChart: null,
    histoChart: null,
    histoAverageChart: null
};

export function initializeDOMElements() {
    if (document.readyState === 'loading') {
        console.warn('DOM not ready, elements may not be found');
    }
    
    // Cache all DOM elements
    DOMElements.popupContent = document.querySelector('.popup-content');
    DOMElements.contentArea = document.getElementById('content-area');   
    DOMElements.settingsMenu = document.getElementById('settings-menu');
    DOMElements.apiURLElem = document.getElementById('api-url');
    DOMElements.orgidElem = document.getElementById('org-id');
    DOMElements.siteidElem = document.getElementById('site-id');
    DOMElements.apiInput = document.getElementById('api-input-box');
    DOMElements.dbAddressInput = document.getElementById('db-address-input');
    DOMElements.dbUserInput = document.getElementById('db-user-input');
    DOMElements.dbPassInput = document.getElementById('db-pass-input');
    DOMElements.dbPortInput = document.getElementById('db-port-input');
    DOMElements.dbNameInput = document.getElementById('db-database-input');
    DOMElements.apiSubmitButton = document.getElementById('submit-button');
    DOMElements.dbSubmitButton = document.getElementById('db-submit-button');
    DOMElements.purgeBtn = document.getElementById('purge-api-btn');
    DOMElements.dbMenu = document.getElementById('db-menu');
    DOMElements.pieChart = document.getElementById('pie-chart');
    DOMElements.histoChart = document.getElementById('histo-chart');
    DOMElements.histoAverageChart = document.getElementById('histo-average-chart');

    const totalElements = Object.keys(DOMElements).length;
    const foundElements = Object.values(DOMElements).filter(el => el !== null).length;
    console.log(`DOM elements initialized: ${foundElements}/${totalElements} found`);
    
    // ADDED: Validate elements and warn about missing ones
    const missing = validateDOMElements();
    if (missing.length > 0) {
        console.warn('Missing DOM elements:', missing);
    }
}

let validationCache = null;

export function validateDOMElements(forceRevalidate = false) {
    if (validationCache && !forceRevalidate) {
        return validationCache;
    }
    
    const missing = [];
    for (const [key, element] of Object.entries(DOMElements)) {
        if (!element) {
            missing.push(key);
        }
    }
    
    validationCache = missing;
    return missing;
}

export function safeGetElement(selector, isRequired = false) {
    const element = selector.startsWith('#') || selector.startsWith('.') 
        ? document.querySelector(selector)
        : document.getElementById(selector);
        
    if (!element && isRequired) {
        console.error(`Required DOM element not found: ${selector}`);
    }
    
    return element;
}

export function safeUpdateElement(element, content, type = 'text') {
    if (!element) {
        console.warn('Attempted to update null element');
        return false;
    }
    
    try {
        switch (type) {
            case 'text':
                element.textContent = content;
                break;
            case 'html':
                element.innerHTML = content;
                break;
            case 'value':
                element.value = content;
                break;
            case 'display':
                element.style.display = content;
                break;
            default:
                element.textContent = content;
        }
        return true;
    } catch (error) {
        console.error('Error updating element:', error);
        return false;
    }
}

export function reinitializeDOMElements() {
    console.log('Re-initializing DOM elements...');
    initializeDOMElements();
}