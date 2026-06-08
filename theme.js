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

updateConnectionStatus();
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

const newsletterForm = document.getElementById('newsletter-form');
newsletterForm?.addEventListener('submit', function (e) {
  e.preventDefault();
  newsletterForm.reset();
});
