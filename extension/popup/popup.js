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
    const apiHost = 'localhost';

    // JS listens for HTML buttons to be clicked. In click triggers events.
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            // Toggle .clicked class, updating the color profile of the clicked button 
            buttons.forEach(btn => btn.classList.remove('clicked'));
            button.classList.add('clicked');

            // data-action is the class of the button in HTML
            const action = button.getAttribute('data-action');

            if (settingsMenu) {
                settingsMenu.style.display = (action === 'settings') ? 'block' : 'none';
            }



            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (!tab?.url) return;

                const url = new URL(tab.url);
                const hostname = url.hostname;
                const fullURL = tab.url;
            
                // uses JS.replace() to strip the "manage" from the beginning of the standard URL and replace it with "api"
                const api_url = /^manage\./.test(hostname)
                    ? hostname.replace(/^manage\./, 'api.')
                    : /^integration\./.test(hostname)
                    ? hostname.replace(/^integration\./, 'api.')
                    : 'api.mist.com';

                // regex strips the org_id or site_id from the full URL string
                org_id = fullURL.match(/[?&]org_id=([0-9a-fA-F-]{36})/)?.[1] || null;
                site_id = fullURL.match(/([0-9a-fA-F-]{36})$/)?.[1] || null;

                if (apiURLElem) apiURLElem.textContent = api_url;
                if (orgidElem) orgidElem.textContent = org_id;
                if (siteidElem) siteidElem.textContent = site_id;

                // Only run this check if we're in the settings menu
                if (action === 'settings' && org_id) {
                    // API call to the Flask backend to check whether or not the org_id retrieved already exists in the database. 
                    // If it already exists then the option to input a new API key cannot be input
                    fetch(`http://${apiHost}:8510/api/check-existing-data?org_id=${encodeURIComponent(org_id)}`)
                        .then(response => response.json())
                        .then(data => {
                            if (data.exists) {
                                // Show the purge button
                                if (purgeBtn) purgeBtn.style.display = 'inline-block';
                                // Block API key input
                                if (apiInput) {
                                    apiInput.disabled = true;
                                    apiInput.value = '';
                                }
                                if (apiSubmitButton) apiSubmitButton.disabled = true;
                                // Optionally show a message, this message will only show if there is already an API key.
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
                                // Hide the purge button
                                if (purgeBtn) purgeBtn.style.display = 'none';
                                // Allow API key input
                                if (apiInput) apiInput.disabled = false;
                                if (apiSubmitButton) apiSubmitButton.disabled = false;
                                // Remove message if present
                                const msg = document.getElementById('api-exists-msg');
                                if (msg) msg.remove();
                            }
                        })
                        .catch(err => {
                            console.error('Error checking org_id:', err);
                        });
                }
            });
        });
    });

    if (apiSubmitButton && apiInput) {
        apiSubmitButton.addEventListener('click', () => {
            const key = apiInput.value.trim();
            if (!key) return;

            fetch(`http://${apiHost}:8510/api/data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    org_id,
                    site_id,
                    api_key: key
                })
            })
            .then(response => response.json())
            .then(data => {
                // Handle response if needed
                console.log('Backend response:', data);
            })
            .catch(error => {
                console.error('Error sending data to backend:', error);
            });

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
            fetch(`http://${apiHost}:8510/api/purge-api-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ org_id })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Enable input and submit button
                    if (apiInput) {
                        apiInput.disabled = false;
                        apiInput.value = '';
                    }
                    if (apiSubmitButton) apiSubmitButton.disabled = false;
                    // Hide purge button
                    purgeBtn.style.display = 'none';
                    // Remove exists message if present
                    const msg = document.getElementById('api-exists-msg');
                    if (msg) msg.remove();
                    // Optionally show a success message
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
            })
            .catch(err => {
                purgeBtn.disabled = false;
                purgeBtn.textContent = "Purge API Key";
                alert("Error purging API key.");
                console.error('Error purging API key:', err);
            });
        });
    }
});
