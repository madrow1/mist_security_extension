document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.action-button');
    const popupContent = document.querySelector('.popup-content');
    const settingsMenu = document.getElementById('settings-menu');
    const apiURLElem = document.getElementById('api-url');
    const orgidElem = document.getElementById('org-id');
    const siteidElem = document.getElementById('site-id');
    const apiSubmitButton = document.getElementById('submit-button')
    const apiInput = document.getElementById('api-input-box');

    apiSubmitButton = document.getElementById('apiSubmitButton');
        const key = apiInput.value.trim()
        if (!key) return;

        const obscured = key.length > 8
            ? key.slice(0,4) + '••••••••' + key.slice(-4)
            : '••••••••' ;

        apiSubmitButton.addEventListener('click', () => {
        const apiKey = document.getElementById('apiKeyValue').value;

        const container = apiInput.parentElement;
        container.innerHTML = `<p class="paragraphs" id="api-obscured">API Key: ${obscured}</p>`;

    })

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            // Toggle .clicked class
            buttons.forEach(btn => btn.classList.remove('clicked'));
            button.classList.add('clicked');

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

                const api_url = /^manage\./.test(hostname)
                    ? hostname.replace(/^manage\./, 'api.')
                    : /^integration\./.test(hostname)
                    ? hostname.replace(/^integration\./, 'api.')
                    : 'api.mist.com';

                const org_id = fullURL.match(/[?&]org_id=([0-9a-fA-F-]{36})/)?.[1] || null;
                const site_id = fullURL.match(/([0-9a-fA-F-]{36})$/)?.[1] || null;

                if (apiURLElem) apiURLElem.textContent = api_url;
                if (orgidElem) orgidElem.textContent = org_id;
                if (siteidElem) siteidElem.textContent = site_id;

                chrome.runtime.sendMessage({ action }, (response) => {
                    console.log(`${action} result:`, response);
                    if (popupContent) {
                        popupContent.textContent = JSON.stringify(response, null, 2);
                    }
                });
            });
        });
    });
});
