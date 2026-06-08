const USERS_KEY = 'local_users';
const SESSION_KEY = 'active_session';

const ROLES = {
  CLIENT: 'Cliente',
  ADMIN: 'Administrador',
};

const MODULES = {
  [ROLES.CLIENT]: 'client.html',
  [ROLES.ADMIN]: 'admin.html',
};

const DEFAULT_ADMIN = {
  id: 'admin-1',
  email: 'admin@shopverse.com',
  password: encodePassword('admin123'),
  name: 'Administrador',
  avatarUrl: '',
  shippingAddress: '',
  role: ROLES.ADMIN,
};

function encodePassword(password) {
  return btoa(unescape(encodeURIComponent(password)));
}

function verifyPassword(password, encoded) {
  return encodePassword(password) === encoded;
}

function generateId() {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getUsers() {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function seedDefaultAdmin() {
  const users = getUsers();
  const adminExists = users.some((u) => u.role === ROLES.ADMIN);
  if (!adminExists) {
    users.push({ ...DEFAULT_ADMIN });
    saveUsers(users);
  }
}

function findUserByEmail(email) {
  return getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
}

function findUserById(id) {
  return getUsers().find((u) => u.id === id);
}

function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setSession(user) {
  const session = {
    userId: user.id,
    email: user.email,
    role: user.role,
    loginAt: new Date().toISOString(),
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

function getCurrentUser() {
  const session = getSession();
  if (!session) return null;
  return findUserById(session.userId) || null;
}

function register({ name, email, password, confirmPassword }) {
  if (!name?.trim() || !email?.trim() || !password) {
    return { success: false, message: 'Completa todos los campos obligatorios.' };
  }
  if (password.length < 6) {
    return { success: false, message: 'La contraseña debe tener al menos 6 caracteres.' };
  }
  if (password !== confirmPassword) {
    return { success: false, message: 'Las contraseñas no coinciden.' };
  }
  if (findUserByEmail(email)) {
    return { success: false, message: 'Ya existe una cuenta con ese correo.' };
  }

  const user = {
    id: generateId(),
    email: email.trim().toLowerCase(),
    password: encodePassword(password),
    name: name.trim(),
    avatarUrl: '',
    shippingAddress: '',
    role: ROLES.CLIENT,
    resetToken: null,
    resetTokenExpiry: null,
  };

  const users = getUsers();
  users.push(user);
  saveUsers(users);

  return { success: true, message: 'Cuenta creada correctamente. Ya puedes iniciar sesión.', user };
}

function login(email, password) {
  if (!email?.trim() || !password) {
    return { success: false, message: 'Introduce correo y contraseña.' };
  }

  const user = findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password)) {
    return { success: false, message: 'Correo o contraseña incorrectos.' };
  }

  setSession(user);
  return { success: true, message: 'Sesión iniciada.', user, session: getSession() };
}

function logout() {
  clearSession();
  return { success: true, message: 'Sesión cerrada.' };
}

function updateProfile(userId, { name, avatarUrl, shippingAddress }) {
  const users = getUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) {
    return { success: false, message: 'Usuario no encontrado.' };
  }

  if (name !== undefined) users[index].name = name.trim();
  if (avatarUrl !== undefined) users[index].avatarUrl = avatarUrl.trim();
  if (shippingAddress !== undefined) users[index].shippingAddress = shippingAddress.trim();

  saveUsers(users);
  return { success: true, message: 'Perfil actualizado.', user: users[index] };
}

function requestPasswordReset(email) {
  if (!email?.trim()) {
    return { success: false, message: 'Introduce tu correo electrónico.' };
  }

  const user = findUserByEmail(email);
  if (!user) {
    return { success: false, message: 'No existe ninguna cuenta con ese correo.' };
  }

  const token = Math.random().toString(36).slice(2, 10).toUpperCase();
  const expiry = Date.now() + 15 * 60 * 1000;

  const users = getUsers();
  const index = users.findIndex((u) => u.id === user.id);
  users[index].resetToken = token;
  users[index].resetTokenExpiry = expiry;
  saveUsers(users);

  return {
    success: true,
    message: 'Recuperación simulada: en producción recibirías un email.',
    token,
    email: user.email,
  };
}

function resetPassword(email, token, newPassword, confirmPassword) {
  if (!email || !token || !newPassword) {
    return { success: false, message: 'Completa todos los campos.' };
  }
  if (newPassword.length < 6) {
    return { success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres.' };
  }
  if (newPassword !== confirmPassword) {
    return { success: false, message: 'Las contraseñas no coinciden.' };
  }

  const user = findUserByEmail(email);
  if (!user) {
    return { success: false, message: 'Usuario no encontrado.' };
  }
  if (user.resetToken !== token.toUpperCase()) {
    return { success: false, message: 'Código de recuperación inválido.' };
  }
  if (!user.resetTokenExpiry || Date.now() > user.resetTokenExpiry) {
    return { success: false, message: 'El código ha expirado. Solicita uno nuevo.' };
  }

  const users = getUsers();
  const index = users.findIndex((u) => u.id === user.id);
  users[index].password = encodePassword(newPassword);
  users[index].resetToken = null;
  users[index].resetTokenExpiry = null;
  saveUsers(users);

  return { success: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' };
}

const AuthGuard = {
  requireAuth(redirectTo = 'auth.html') {
    if (!getSession()) {
      window.location.href = redirectTo;
      return false;
    }
    return true;
  },

  requireRole(requiredRole, redirectTo = 'auth.html') {
    const session = getSession();
    if (!session) {
      window.location.href = redirectTo;
      return false;
    }
    if (session.role !== requiredRole) {
      window.location.href = MODULES[session.role] || redirectTo;
      return false;
    }
    return true;
  },

  blockCrossAccess(requiredRole) {
    return AuthGuard.requireRole(requiredRole);
  },

  redirectIfAuthenticated() {
    const session = getSession();
    if (session && MODULES[session.role]) {
      window.location.href = MODULES[session.role];
      return true;
    }
    return false;
  },
};

seedDefaultAdmin();

const Auth = {
  ROLES,
  MODULES,
  getSession,
  getCurrentUser,
  register,
  login,
  logout,
  updateProfile,
  requestPasswordReset,
  resetPassword,
};

window.Auth = Auth;
window.AuthGuard = AuthGuard;

function initAuthPage() {
  if (!document.body.classList.contains('auth-page')) return;

  const session = getSession();
  const user = getCurrentUser();

  const panels = {
    login: document.getElementById('panel-login'),
    register: document.getElementById('panel-register'),
    recovery: document.getElementById('panel-recovery'),
    reset: document.getElementById('panel-reset'),
    profile: document.getElementById('panel-profile'),
  };

  const tabs = document.querySelectorAll('[data-auth-tab]');
  const alertEl = document.getElementById('auth-alert');

  function showAlert(message, type = 'info') {
    if (!alertEl) return;
    alertEl.textContent = message;
    alertEl.className = `auth-alert auth-alert--${type}`;
    alertEl.hidden = false;
  }

  function hideAlert() {
    if (alertEl) alertEl.hidden = true;
  }

  function showPanel(name) {
    Object.entries(panels).forEach(([key, el]) => {
      if (el) el.hidden = key !== name;
    });
    tabs.forEach((tab) => {
      tab.classList.toggle('auth-tabs__btn--active', tab.dataset.authTab === name);
      tab.setAttribute('aria-selected', tab.dataset.authTab === name ? 'true' : 'false');
    });
    hideAlert();
  }

  function renderProfile(userData) {
    const avatarEl = document.getElementById('profile-avatar');
    const nameEl = document.getElementById('profile-name-display');
    const roleEl = document.getElementById('profile-role-display');
    const form = document.getElementById('profile-form');

    if (avatarEl) {
      avatarEl.src = userData.avatarUrl || 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%234361ee" width="100" height="100"/><text x="50" y="58" text-anchor="middle" fill="white" font-size="40" font-family="sans-serif">' +
        (userData.name?.charAt(0)?.toUpperCase() || '?') + '</text></svg>'
      );
      avatarEl.alt = `Avatar de ${userData.name}`;
    }
    if (nameEl) nameEl.textContent = userData.name;
    if (roleEl) {
      roleEl.textContent = userData.role;
      roleEl.className = `auth-badge auth-badge--${userData.role === ROLES.ADMIN ? 'admin' : 'client'}`;
    }
    if (form) {
      form.elements.name.value = userData.name || '';
      form.elements.avatarUrl.value = userData.avatarUrl || '';
      form.elements.shippingAddress.value = userData.shippingAddress || '';
    }

    const moduleLink = document.getElementById('profile-module-link');
    if (moduleLink) {
      moduleLink.href = MODULES[userData.role];
      moduleLink.textContent = userData.role === ROLES.ADMIN
        ? 'Ir al panel de administración'
        : 'Ir a mi área de cliente';
    }
  }

  if (session && user) {
    document.querySelector('.auth-tabs')?.setAttribute('hidden', '');
    showPanel('profile');
    renderProfile(user);
  } else {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'register') showPanel('register');
    else if (hash === 'recovery') showPanel('recovery');
    else if (hash === 'reset') showPanel('reset');
    else showPanel('login');
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => showPanel(tab.dataset.authTab));
  });

  document.querySelectorAll('.auth-link[data-auth-tab]').forEach((link) => {
    link.addEventListener('click', () => showPanel(link.dataset.authTab));
  });

  document.getElementById('login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const result = login(form.email.value, form.password.value);
    if (result.success) {
      window.location.href = MODULES[result.user.role];
    } else {
      showAlert(result.message, 'error');
    }
  });

  document.getElementById('register-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const result = register({
      name: form.name.value,
      email: form.email.value,
      password: form.password.value,
      confirmPassword: form.confirmPassword.value,
    });
    if (result.success) {
      showAlert(result.message, 'success');
      showPanel('login');
      form.reset();
    } else {
      showAlert(result.message, 'error');
    }
  });

  document.getElementById('recovery-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const result = requestPasswordReset(form.email.value);
    if (result.success) {
      showAlert(
        `${result.message} Código simulado: ${result.token} (válido 15 min).`,
        'success'
      );
      document.getElementById('reset-email').value = result.email;
      showPanel('reset');
    } else {
      showAlert(result.message, 'error');
    }
  });

  document.getElementById('reset-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const result = resetPassword(
      form.email.value,
      form.token.value,
      form.newPassword.value,
      form.confirmPassword.value
    );
    if (result.success) {
      showAlert(result.message, 'success');
      showPanel('login');
      form.reset();
    } else {
      showAlert(result.message, 'error');
    }
  });

  document.getElementById('profile-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const current = getCurrentUser();
    if (!current) return;
    const form = e.target;
    const result = updateProfile(current.id, {
      name: form.name.value,
      avatarUrl: form.avatarUrl.value,
      shippingAddress: form.shippingAddress.value,
    });
    if (result.success) {
      renderProfile(result.user);
      showAlert(result.message, 'success');
    } else {
      showAlert(result.message, 'error');
    }
  });

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    logout();
    window.location.href = 'auth.html';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initAuthPage();
  initHeaderAuthLink();
});

function initHeaderAuthLink() {
  const link = document.getElementById('header-auth-link');
  if (!link) return;

  const user = getCurrentUser();
  const label = link.querySelector('.site-header__action-label');

  if (user) {
    link.href = MODULES[user.role] || 'auth.html';
    if (label) label.textContent = user.name.split(' ')[0];
    link.setAttribute('aria-label', `Mi cuenta — ${user.name}`);
  }
}
