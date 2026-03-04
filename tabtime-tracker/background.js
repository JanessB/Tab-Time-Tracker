//tracks active tab time and enforces limits

let activeTabId = null;
let activeHostname = null;
let sessionStart = null;

// Helpers

function getHostname(url) {
  try {
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return null;
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return null;
  }
}

// Save time spent on a hostname to storage
async function flushTime(hostname, ms) {
  if (!hostname || ms <= 0) return;

  const today = new Date().toDateString();
  const data = await chrome.storage.local.get(['timeData', 'lastDate']);

  // Reset data if it's a new day
  let timeData = data.timeData || {};
  if (data.lastDate !== today) {
    timeData = {};
    await chrome.storage.local.set({ lastDate: today });
  }

  timeData[hostname] = (timeData[hostname] || 0) + ms;
  await chrome.storage.local.set({ timeData });

  // Check if over limit
  checkLimit(hostname, timeData[hostname]);
}

async function checkLimit(hostname, totalMs) {
  const { limits } = await chrome.storage.local.get('limits');
  if (!limits || !limits[hostname]) return;

  const limitMs = limits[hostname] * 60 * 1000; // convert minutes to ms

  if (totalMs >= limitMs) {
    // Send notification
    chrome.notifications.create(`limit-${hostname}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '⏰ Time Limit Reached',
      message: `You've hit your ${limits[hostname]}-minute limit on ${hostname}.`,
      priority: 2
    });
  }
}

// Track active tab 

function startTracking(tabId, url) {
  // Flush previous tab's time first
  if (activeHostname && sessionStart) {
    const elapsed = Date.now() - sessionStart;
    flushTime(activeHostname, elapsed);
  }

  activeTabId = tabId;
  activeHostname = getHostname(url);
  sessionStart = activeHostname ? Date.now() : null;
}

// When user switches tabs
chrome.tabs.onActivated.addListener(async (info) => {
  const tab = await chrome.tabs.get(info.tabId);
  startTracking(info.tabId, tab.url);
});

// When tab URL changes (navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.url) {
    startTracking(tabId, changeInfo.url);
  }
});

// When window loses focus (user switches apps)
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus — flush current time, stop tracking
    if (activeHostname && sessionStart) {
      flushTime(activeHostname, Date.now() - sessionStart);
    }
    activeHostname = null;
    sessionStart = null;
  } else {
    // Browser regained focus — resume tracking current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) startTracking(tabs[0].id, tabs[0].url);
    });
  }
});

// Flush every 30 seconds as a heartbeat (in case user stays on one tab)
setInterval(() => {
  if (activeHostname && sessionStart) {
    const elapsed = Date.now() - sessionStart;
    flushTime(activeHostname, elapsed);
    sessionStart = Date.now(); // reset session start so we don't double-count
  }
}, 5000); // every 5 seconds 