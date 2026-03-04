//handle all UI logic

// Helpers 

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function getFavicon(hostname) {
  const map = {
    'youtube.com': '▶️',
    'twitter.com': '🐦',
    'x.com': '🐦',
    'reddit.com': '🤖',
    'facebook.com': '👤',
    'instagram.com': '📸',
    'tiktok.com': '🎵',
    'github.com': '🐙',
    'google.com': '🔍',
    'netflix.com': '🎬',
    'twitch.tv': '🎮',
    'discord.com': '💬',
    'gmail.com': '📧',
    'linkedin.com': '💼',
  };
  return map[hostname] || '🌐';
}

// Nav tabs 

document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`view-${tab.dataset.view}`).classList.add('active');
  });
});

// Date display 

document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-US', {
  weekday: 'short', month: 'short', day: 'numeric'
});

// Load & render stats 

async function loadStats() {
  const { timeData = {}, limits = {} } = await chrome.storage.local.get(['timeData', 'limits']);

  const entries = Object.entries(timeData).sort((a, b) => b[1] - a[1]);

  const totalMs = entries.reduce((sum, [, ms]) => sum + ms, 0);
  document.getElementById('total-time').textContent = formatTime(totalMs);

  const list = document.getElementById('sites-list');

  if (entries.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👀</div>
        <div class="empty-text">No data yet.<br>Browse some tabs and come back!</div>
      </div>`;
    return;
  }

  const maxMs = entries[0][1]; // for proportional bar widths

  list.innerHTML = entries.map(([hostname, ms]) => {
    const limitMin = limits[hostname];
    const limitMs = limitMin ? limitMin * 60 * 1000 : null;
    const pct = Math.min(100, (ms / maxMs) * 100);

    let badgeHtml = '';
    if (limitMs) {
      const ratio = ms / limitMs;
      if (ratio >= 1) {
        badgeHtml = `<span class="site-limit-badge badge-over">OVER</span>`;
      } else if (ratio >= 0.75) {
        badgeHtml = `<span class="site-limit-badge badge-warn">${Math.round(ratio * 100)}%</span>`;
      } else {
        badgeHtml = `<span class="site-limit-badge badge-ok">${formatTime(limitMs - ms)} left</span>`;
      }
    }

    return `
      <div class="site-row">
        <div class="site-row-bg" style="width:${pct}%"></div>
        <div class="site-favicon">${getFavicon(hostname)}</div>
        <div class="site-name">${hostname}</div>
        <div class="site-time">${formatTime(ms)}</div>
        ${badgeHtml}
      </div>`;
  }).join('');
}

// Load & render limits 

async function loadLimits() {
  const { limits = {} } = await chrome.storage.local.get('limits');
  const list = document.getElementById('limits-list');

  const entries = Object.entries(limits);

  if (entries.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎯</div>
        <div class="empty-text">No limits set yet.<br>Add a site above to get started.</div>
      </div>`;
    return;
  }

  list.innerHTML = entries.map(([site, minutes]) => `
    <div class="limit-row">
      <div class="site-favicon" style="position:static">${getFavicon(site)}</div>
      <div class="limit-site">${site}</div>
      <div class="limit-value">${minutes} min/day</div>
      <button class="delete-btn" data-site="${site}">✕</button>
    </div>
  `).join('');

  // Delete buttons
  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { limits = {} } = await chrome.storage.local.get('limits');
      delete limits[btn.dataset.site];
      await chrome.storage.local.set({ limits });
      loadLimits();
      loadStats(); // refresh badges
    });
  });
}

// Add limit 

document.getElementById('add-limit-btn').addEventListener('click', async () => {
  const siteInput = document.getElementById('limit-site-input');
  const minutesInput = document.getElementById('limit-minutes-input');

  let site = siteInput.value.trim().toLowerCase().replace('www.', '');
  const minutes = parseInt(minutesInput.value);

  if (!site || isNaN(minutes) || minutes < 1) {
    siteInput.style.borderColor = '#f87171';
    minutesInput.style.borderColor = '#f87171';
    setTimeout(() => {
      siteInput.style.borderColor = '';
      minutesInput.style.borderColor = '';
    }, 1200);
    return;
  }

  // Clean up URL if they pasted a full URL
  try { site = new URL(site.includes('://') ? site : 'https://' + site).hostname.replace('www.', ''); } catch {}

  const { limits = {} } = await chrome.storage.local.get('limits');
  limits[site] = minutes;
  await chrome.storage.local.set({ limits });

  siteInput.value = '';
  minutesInput.value = '';

  loadLimits();
  loadStats();
});

// Reset button 

document.getElementById('reset-btn').addEventListener('click', async () => {
  if (confirm('Reset all screen time data for today?')) {
    await chrome.storage.local.remove('timeData');
    loadStats();
  }
});

// Enter key on inputs 

document.getElementById('limit-minutes-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('add-limit-btn').click();
});

// Init 

loadStats();
loadLimits();