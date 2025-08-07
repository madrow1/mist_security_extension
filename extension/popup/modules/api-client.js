 // API communication, uses the Chrome extension messaging API to communicate with the background script
export const APIClient = {
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