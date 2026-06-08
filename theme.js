const STORAGE_KEY = 'theme';
const root = document.documentElement;
const toggleBtn = document.getElementById('theme-toggle');

function getPreferredTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  root.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
  if (toggleBtn) toggleBtn.setAttribute('aria-pressed', theme === 'dark');
}

function toggleTheme() {
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

applyTheme(getPreferredTheme());
toggleBtn?.addEventListener('click', toggleTheme);

const statusEl = document.getElementById('connection-status');

function updateConnectionStatus() {
  if (!statusEl) return;
  const online = navigator.onLine;
  statusEl.className = online ? 'status--online' : 'status--offline';
  statusEl.textContent = online ? 'En línea' : 'Sin conexión';
}

const OFFLINE_ORDERS_KEY = 'offline_orders_queue';
const ORDERS_KEY = 'user_orders';

function syncOfflineOrders() {
  const raw = localStorage.getItem(OFFLINE_ORDERS_KEY);
  if (!raw) return 0;

  let queue;
  try {
    queue = JSON.parse(raw);
  } catch {
    return 0;
  }

  if (!Array.isArray(queue) || queue.length === 0) return 0;

  let all = {};
  const ordersRaw = localStorage.getItem(ORDERS_KEY);
  if (ordersRaw) {
    try {
      const parsed = JSON.parse(ordersRaw);
      if (parsed && typeof parsed === 'object') all = parsed;
    } catch {
      all = {};
    }
  }

  queue.forEach((order) => {
    const userId = order.userId;
    if (!userId) return;
    if (!all[userId]) all[userId] = [];
    all[userId].unshift({
      ...order,
      pendingSync: false,
      syncedAt: new Date().toISOString(),
    });
  });

  localStorage.setItem(ORDERS_KEY, JSON.stringify(all));
  localStorage.removeItem(OFFLINE_ORDERS_KEY);
  return queue.length;
}

function notifyOfflineSync(count) {
  if (count <= 0) return;
  const message = count === 1
    ? '1 compra pendiente se ha sincronizado correctamente.'
    : `${count} compras pendientes se han sincronizado correctamente.`;
  window.alert(message);
}

function handleOnline() {
  updateConnectionStatus();
  notifyOfflineSync(syncOfflineOrders());
}

function handleOffline() {
  updateConnectionStatus();
}

updateConnectionStatus();
window.addEventListener('online', handleOnline);
window.addEventListener('offline', handleOffline);

if (navigator.onLine) {
  notifyOfflineSync(syncOfflineOrders());
}

const newsletterForm = document.getElementById('newsletter-form');
newsletterForm?.addEventListener('submit', function (e) {
  e.preventDefault();
  newsletterForm.reset();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function (err) {
      console.warn('Service Worker no registrado:', err);
    });
  });
}
