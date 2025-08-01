// UI utilities
export const UIUtils = {
 
    showLoading(element, text = 'Loading...') {
        if (!element) {
            console.warn('showLoading: element is null or undefined');
            return;
        }

        if (typeof text !== 'string') {
            text = 'Loading...';
        }

        try {
            // Store original content to restore later
            if (!element.dataset.originalContent) {
                element.dataset.originalContent = element.textContent || '';
            }
            
            element.textContent = text;
            element.style.opacity = '0.6';
            element.classList.add('loading-state');
        } catch (error) {
            console.error('Error showing loading state:', error);
        }
    },

    hideLoading(element) {
        if (!element) {
            console.warn('hideLoading: element is null or undefined');
            return;
        }

        try {
            element.style.opacity = '1';
            element.classList.remove('loading-state');
            
            if (element.classList.contains('loading-state') || 
                (element.textContent && element.textContent.includes('Loading'))) {
                
                // Restore original content if available
                const originalContent = element.dataset.originalContent;
                if (originalContent !== undefined) {
                    element.textContent = originalContent;
                    delete element.dataset.originalContent;
                } else {
                    element.textContent = '';
                }
            }
        } catch (error) {
            console.error('Error hiding loading state:', error);
        }
    },

    showError(element, message) {
        if (!element) {
            console.warn('showError: element is null or undefined');
            return;
        }

        if (typeof message !== 'string') {
            message = 'An unknown error occurred';
        }

        try {
            element.textContent = `Error: ${message}`;
            element.style.color = '#d32f2f';
            element.classList.add('error-state');
            
            setTimeout(() => {
                if (element.classList.contains('error-state')) {
                    this.clearMessage(element);
                }
            }, 5000);
        } catch (error) {
            console.error('Error showing error message:', error);
        }
    },

    showSuccess(element, message) {
        if (!element) {
            console.warn('showSuccess: element is null or undefined');
            return;
        }

        if (typeof message !== 'string') {
            message = 'Operation completed successfully';
        }

        try {
            element.textContent = message;
            element.style.color = '#2e7d32';
            element.classList.add('success-state');
            
            setTimeout(() => {
                if (element.classList.contains('success-state')) {
                    this.clearMessage(element);
                }
            }, 3000);
        } catch (error) {
            console.error('Error showing success message:', error);
        }
    },

    resetButtonStates() {
        try {
            const buttons = document.querySelectorAll('.action-button');
            if (buttons.length === 0) {
                console.warn('No action buttons found to reset');
                return;
            }

            buttons.forEach(btn => {
                try {
                    if (btn && btn.classList) {
                        btn.classList.remove('clicked');
                    }
                } catch (error) {
                    console.error('Error resetting button state:', error);
                }
            });
        } catch (error) {
            console.error('Error resetting button states:', error);
        }
    },

    setButtonClicked(button) {
        if (!button) {
            console.warn('setButtonClicked: button is null or undefined');
            return;
        }

        try {
            this.resetButtonStates();
            
            if (button.classList) {
                button.classList.add('clicked');
            }
        } catch (error) {
            console.error('Error setting button clicked state:', error);
        }
    },
    
    createMessage(text, type = 'info', id = null) {
        if (typeof text !== 'string') {
            text = 'Message';
        }

        if (!['info', 'error', 'success', 'warning'].includes(type)) {
            type = 'info';
        }

        try {
            const msg = document.createElement('p');
            
            if (id && typeof id === 'string') {
                msg.id = id;
            }
            
            msg.className = 'paragraphs';
            msg.textContent = text;
            
            const colors = {
                error: '#d32f2f',
                success: '#2e7d32',
                warning: '#f57c00',
                info: '#666'
            };
            
            msg.style.color = colors[type];
            msg.classList.add(`message-${type}`);
            
            return msg;
        } catch (error) {
            console.error('Error creating message:', error);
            return null;
        }
    },
    
    removeMessage(id) {
        if (!id || typeof id !== 'string') {
            console.warn('removeMessage: invalid id provided');
            return false;
        }

        try {
            const msg = document.getElementById(id);
            if (msg) {
                msg.remove();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error removing message:', error);
            return false;
        }
    },

    clearMessage(element) {
        if (!element) return;

        try {
            element.classList.remove('error-state', 'success-state', 'loading-state');
            element.style.color = '';
            
            // Restore original content if available
            const originalContent = element.dataset.originalContent;
            if (originalContent !== undefined) {
                element.textContent = originalContent;
                delete element.dataset.originalContent;
            }
        } catch (error) {
            console.error('Error clearing message state:', error);
        }
    },

    safeSetText(element, text) {
        if (!element) return false;
        
        try {
            element.textContent = typeof text === 'string' ? text : '';
            return true;
        } catch (error) {
            console.error('Error setting text content:', error);
            return false;
        }
    },

    safeSetStyle(element, property, value) {
        if (!element || !element.style) return false;
        
        try {
            element.style[property] = value;
            return true;
        } catch (error) {
            console.error('Error setting style:', error);
            return false;
        }
    },

    isValidElement(element) {
        return element && 
               typeof element === 'object' && 
               element.nodeType === Node.ELEMENT_NODE;
    },

    showTemporaryMessage(element, message, type = 'info', duration = 3000) {
        if (!this.isValidElement(element)) {
            console.warn('showTemporaryMessage: invalid element');
            return;
        }

        // Store original state
        const originalText = element.textContent;
        const originalColor = element.style.color;

        // Show message
        if (type === 'error') {
            this.showError(element, message);
        } else if (type === 'success') {
            this.showSuccess(element, message);
        } else {
            this.safeSetText(element, message);
            this.safeSetStyle(element, 'color', '#666');
        }

        // Restore original state after duration
        setTimeout(() => {
            try {
                element.textContent = originalText;
                element.style.color = originalColor;
                element.classList.remove('error-state', 'success-state');
            } catch (error) {
                console.error('Error restoring element state:', error);
            }
        }, duration);
    }
};