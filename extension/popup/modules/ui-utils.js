// UI utilities, these just make things look nicer
export const UIUtils = {
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