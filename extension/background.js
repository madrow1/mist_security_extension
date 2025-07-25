const apiAddress = '127.0.0.1'
var browser_name = "ffx";

if (typeof browser === "undefined") {
    var browser = chrome;
    browser_name = "chrome";
}

browser.tabs.onActivated.addListener(info => {
    getUrl(info.tabId);
})

browser.tabs.onUpdated.addListener((tab) => {
    getUrl(tab);
})

function getUrl(tabId) {
    setTimeout(() => {
        browser.tabs.get(tabId)
            .then(tab => {
                if (tab) {
                    checkUrl(tab.url);
                } else {
                    getUrl(tabId);
                }
            })
            .catch(err => console.log(err))
    }, 100);
}

// Borrowed code from the other Mist API extension. Checks the current URL and updates the badge to reflect.
function checkUrl(tabUrl) {
    const org_re = /https:\/\/(manage|integration|manage-staging)\.(?<host>[a-z0-9.]*(mist|mistsys|mist-federal)\.com)\/admin\/\?org_id=(?<org_id>[0-9a-f-]*)#!/yis;
    const org = org_re.exec(tabUrl);
    const msp_re = /https:\/\/(manage|integration|manage-staging)\.(?<host>[a-z0-9.]*(mist|mistsys|mist-federal)\.com)\/msp\/\?msp=(?<msp_id>[0-9a-f-]*)#!/yis;
    const msp = msp_re.exec(tabUrl);
    const api_re = /https:\/\/api\.(?<host>[a-z0-9.]*(mist|mistsys|mist-federal)\.com)\/api\/v1\/(?<scope>const|installer|invite|login|logout|mobile|msps|orgs|recover|register|self|sites|utils)/yis;
    const api = api_re.exec(tabUrl);
    const juniper_re = /https:\/\/(dc|jsi|routing)(\.stage)?\.ai\.juniper\.net\/+admin\/\?org_id=(?<org_id>[0-9a-f-]*)#!/yis;
    const juniper = juniper_re.exec(tabUrl);

    if (org || msp) {
        apiBadge("#4caf50");
    } else if (api) {
        apiBadge("#f38019");
    } else if (juniper) {
        apiBadge("#0095a9" );
    } else {
        apiBadge(null);
    }
}

function apiBadge(color) {
    if (color) {
        browser.action.setBadgeBackgroundColor({ color: color })
        browser.action.setBadgeText({ "text": "\u2713" });
    } else {
        browser.action.setBadgeText({ "text": "" });
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  let endpoint, fetchOptions = {};

  switch (request.action) {
    case 'pie':
      endpoint = `http://${apiAddress}:8510/api/pie-chart`;
      fetchOptions.method = 'GET';
      break;
    case 'histogram':
      endpoint = `http://${apiAddress}:8510/api/histogram`;
      fetchOptions.method = 'GET';
      break;
    case 'switches':
      endpoint = `http://${apiAddress}:8510/api/switch-list`;
      fetchOptions.method = 'GET';
      break;
    case 'aps':
      endpoint = `http://${apiAddress}:8510/api/ap-list`;
      fetchOptions.method = 'GET';
      break;
    case 'settings':
      endpoint = `http://${apiAddress}:8510/api/settings`;
      fetchOptions.method = 'GET';
      break;
    case 'check-existing-data':
      endpoint = `http://${apiAddress}:8510/api/check-existing-data?org_id=${encodeURIComponent(request.org_id)}`;
      fetchOptions.method = 'GET';
      break;
    case 'data':
      endpoint = `http://${apiAddress}:8510/api/data`;
      fetchOptions.method = 'POST';
      fetchOptions.headers = { 'Content-Type': 'application/json' };
      fetchOptions.body = JSON.stringify({
        org_id: request.org_id,
        site_id: request.site_id,
        api_key: request.api_key
      });
      break;
    case 'purge-api-key':
      endpoint = `http://${apiAddress}:8510/api/purge-api-key`;
      fetchOptions.method = 'POST';
      fetchOptions.headers = { 'Content-Type': 'application/json' };
      fetchOptions.body = JSON.stringify({ org_id: request.org_id });
      break;
    default:
      sendResponse({ error: 'Unknown action' });
      return;
  }

  // Make API call with proper error handling and timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
  fetchOptions.signal = controller.signal;

  fetch(endpoint, fetchOptions)
    .then(response => {
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      sendResponse({ success: true, data: data });
    })
    .catch(err => {
      clearTimeout(timeoutId);
      let errorMessage = err.message;
      if (err.name === 'AbortError') {
        errorMessage = 'Request timeout';
      } else if (err.message.includes('Failed to fetch')) {
        errorMessage = 'Unable to connect to API server';
      }
      sendResponse({ 
        success: false, 
        error: errorMessage,
        action: request.action 
      });
    });

  return true; // Keep the message channel open for async response
});
