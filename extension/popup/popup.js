document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.action-button');
    const popupContent = document.querySelector('.popup-content');
    const settingsMenu = document.getElementById('settings-menu');
    const apiURLElem = document.getElementById('api-url');
    const orgidElem = document.getElementById('org-id');
    const siteidElem = document.getElementById('site-id');
    const apiInput = document.getElementById('api-input-box');
    const apiSubmitButton = document.getElementById('submit-button');
    const purgeBtn = document.getElementById('purge-api-btn');
    let org_id = null;
    let site_id = null; 

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            buttons.forEach(btn => btn.classList.remove('clicked'));
            button.classList.add('clicked');
            const action = button.getAttribute('data-action');

            // Use background.js for all API calls
            chrome.runtime.sendMessage({ action }, (response) => {
                if (popupContent) {
                    if (response && response.success) {
                        popupContent.textContent = response.data?.data || response.data?.message || JSON.stringify(response.data);
                    } else {
                        popupContent.textContent = response?.error || "Unknown error";
                    }
                }
            });

            if (action === 'settings') {
                if (settingsMenu) settingsMenu.style.display = 'block';
            } else if (settingsMenu) {
                settingsMenu.style.display = 'none';
            }

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (!tab?.url) return;
                const url = new URL(tab.url);
                const hostname = url.hostname;
                const fullURL = tab.url;
                const api_url = /^manage\./.test(hostname)
                    ? hostname.replace(/^manage\./, 'api.')
                    : /^integration\./.test(hostname)
                    ? hostname.replace(/^integration\./, 'api.')
                    : 'api.mist.com';
                    
                org_id = fullURL.match(/[?&]org_id=([0-9a-fA-F-]{36})/)?.[1] || null;
                site_id = fullURL.match(/([0-9a-fA-F-]{36})$/)?.[1] || null;

                if (apiURLElem) apiURLElem.textContent = api_url;
                if (orgidElem) orgidElem.textContent = org_id;
                if (siteidElem) siteidElem.textContent = site_id;

                // Only run this check if we're in the settings menu
                if (action === 'settings' && org_id) {
                    chrome.runtime.sendMessage(
                        { action: 'check-existing-data', org_id },
                        (data) => {
                            if (data.exists) {
                                if (purgeBtn) purgeBtn.style.display = 'inline-block';
                                if (apiInput) {
                                    apiInput.disabled = true;
                                    apiInput.value = '';
                                }
                                if (apiSubmitButton) apiSubmitButton.disabled = true;
                                if (settingsMenu) {
                                    let msg = document.getElementById('api-exists-msg');
                                    if (!msg) {
                                        msg = document.createElement('p');
                                        msg.id = 'api-exists-msg';
                                        msg.className = 'paragraphs';
                                        settingsMenu.appendChild(msg);
                                    }
                                    msg.textContent = "API key already exists for this org. You cannot add another.";
                                }
                            } else {
                                if (purgeBtn) purgeBtn.style.display = 'none';
                                if (apiInput) apiInput.disabled = false;
                                if (apiSubmitButton) apiSubmitButton.disabled = false;
                                const msg = document.getElementById('api-exists-msg');
                                if (msg) msg.remove();
                            }
                        }
                    );
                }
            });
        });
    });

    if (apiSubmitButton && apiInput) {
        apiSubmitButton.addEventListener('click', () => {
            const key = apiInput.value.trim();
            if (!key) return;
            chrome.runtime.sendMessage(
                {
                    action: 'data',
                    org_id,
                    site_id,
                    api_key: key
                },
                (data) => {
                    // Handle response if needed
                    console.log('Backend response:', data);
                }
            );
            const obscured = key.length > 8
                ? key.slice(0,4) + '••••••••' + key.slice(-4)
                : '••••••••';
            const container = apiInput.parentElement;
            if (container) {
                container.innerHTML = `<p class="paragraphs" id="api-obscured">API Key: ${obscured}</p>`;
            }
        });
    }

    if (purgeBtn) {
        purgeBtn.addEventListener('click', () => {
            if (!org_id) return;
            purgeBtn.disabled = true;
            purgeBtn.textContent = "Purging...";
            chrome.runtime.sendMessage(
                { action: 'purge-api-key', org_id },
                (data) => {
                    if (data.success) {
                        if (apiInput) {
                            apiInput.disabled = false;
                            apiInput.value = '';
                        }
                        if (apiSubmitButton) apiSubmitButton.disabled = false;
                        purgeBtn.style.display = 'none';
                        const msg = document.getElementById('api-exists-msg');
                        if (msg) msg.remove();
                        if (settingsMenu) {
                            let successMsg = document.getElementById('api-purged-msg');
                            if (!successMsg) {
                                successMsg = document.createElement('p');
                                successMsg.id = 'api-purged-msg';
                                successMsg.className = 'paragraphs';
                                settingsMenu.appendChild(successMsg);
                            }
                            successMsg.textContent = "API key purged. You can now add a new one.";
                        }
                    } else {
                        purgeBtn.disabled = false;
                        purgeBtn.textContent = "Purge API Key";
                        alert(data.error || "Failed to purge API key.");
                    }
                }
            );
        });
    }
});
