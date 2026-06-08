const PRODUCTS_KEY = 'local_products';
const ORDERS_KEY = 'user_orders';
const USERS_KEY = 'local_users';

const ORDER_STATUSES = ['Pendiente', 'Enviado', 'Entregado'];

const STATUS_ALIASES = {
  completed: 'Pendiente',
  pendiente: 'Pendiente',
  enviado: 'Enviado',
  entregado: 'Entregado',
};

const adminEls = {
  welcome: null,
  totalRevenue: null,
  topProducts: null,
  userStats: null,
  usersBody: null,
  productsBody: null,
  ordersBody: null,
  productCreateBtn: null,
  modal: null,
  modalTitle: null,
  modalForm: null,
  modalAlert: null,
};

let productModalMode = 'create';
let editingProductId = null;

function formatPrice(price) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

function parseJson(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function getProducts() {
  const data = parseJson(PRODUCTS_KEY, []);
  return Array.isArray(data) ? data : [];
}

function saveProducts(products) {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}

function getAllOrdersByUser() {
  const data = parseJson(ORDERS_KEY, {});
  return data && typeof data === 'object' ? data : {};
}

function saveAllOrders(ordersByUser) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(ordersByUser));
}

function getUsers() {
  const data = parseJson(USERS_KEY, []);
  return Array.isArray(data) ? data : [];
}

function getAllOrdersFlat() {
  const byUser = getAllOrdersByUser();
  const orders = [];

  Object.entries(byUser).forEach(([userId, userOrders]) => {
    if (!Array.isArray(userOrders)) return;
    userOrders.forEach((order) => {
      orders.push({ ...order, userId: order.userId || userId });
    });
  });

  return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function normalizeOrderStatus(status) {
  if (!status) return 'Pendiente';
  const key = String(status).toLowerCase();
  if (STATUS_ALIASES[key]) return STATUS_ALIASES[key];
  if (ORDER_STATUSES.includes(status)) return status;
  return 'Pendiente';
}

function calculateTotalRevenue() {
  return getAllOrdersFlat().reduce((sum, order) => sum + (Number(order.total) || 0), 0);
}

function calculateTopProducts(limit = 3) {
  const counts = new Map();

  getAllOrdersFlat().forEach((order) => {
    if (!Array.isArray(order.items)) return;
    order.items.forEach((item) => {
      const id = item.productId;
      const current = counts.get(id) || {
        productId: id,
        title: item.title || `Producto #${id}`,
        quantity: 0,
      };
      current.quantity += Number(item.quantity) || 0;
      counts.set(id, current);
    });
  });

  return [...counts.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}

function getActiveUserIds() {
  const byUser = getAllOrdersByUser();
  return new Set(
    Object.entries(byUser)
      .filter(([, orders]) => Array.isArray(orders) && orders.length > 0)
      .map(([userId]) => userId)
  );
}

function getRegisteredUserCount() {
  return getUsers().length;
}

function getActiveUserCount() {
  return getActiveUserIds().size;
}

function getNextProductId(products) {
  if (!products.length) return 1;
  return Math.max(...products.map((p) => Number(p.id) || 0)) + 1;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderDashboard() {
  if (adminEls.totalRevenue) {
    adminEls.totalRevenue.textContent = formatPrice(calculateTotalRevenue());
  }

  if (adminEls.topProducts) {
    const top = calculateTopProducts(3);
    adminEls.topProducts.innerHTML = '';

    if (top.length === 0) {
      adminEls.topProducts.innerHTML = '<li>Sin ventas registradas</li>';
    } else {
      top.forEach((item, index) => {
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${item.title} (${item.quantity} uds.)`;
        adminEls.topProducts.appendChild(li);
      });
    }
  }

  if (adminEls.userStats) {
    const registered = getRegisteredUserCount();
    const active = getActiveUserCount();
    adminEls.userStats.textContent = `${registered} / ${active}`;
    adminEls.userStats.setAttribute('aria-label', `${registered} registrados, ${active} activos`);
  }
}

function renderUsersTable() {
  const tbody = adminEls.usersBody;
  if (!tbody) return;

  const users = getUsers();
  tbody.innerHTML = '';

  users.forEach((u) => {
    const tr = document.createElement('tr');
    const badgeClass = u.role === 'Administrador' ? 'admin' : 'client';
    tr.innerHTML = `
      <td>${escapeHtml(u.name || '')}</td>
      <td>${escapeHtml(u.email || '')}</td>
      <td><span class="auth-badge auth-badge--${badgeClass}">${escapeHtml(u.role || '')}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderProductsTable() {
  const tbody = adminEls.productsBody;
  if (!tbody) return;

  const products = getProducts();
  tbody.innerHTML = '';

  if (products.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="5">No hay productos en el inventario.</td>';
    tbody.appendChild(tr);
    return;
  }

  products.forEach((product) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(String(product.id))}</td>
      <td>${escapeHtml(product.title || '')}</td>
      <td>${escapeHtml(product.category || '')}</td>
      <td>${formatPrice(Number(product.price) || 0)}</td>
      <td>
        <div class="admin-table-actions">
          <button type="button" class="btn btn--outline btn--sm" data-product-edit="${product.id}">Editar</button>
          <button type="button" class="btn btn--outline btn--sm" data-product-delete="${product.id}">Eliminar</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderOrdersTable() {
  const tbody = adminEls.ordersBody;
  if (!tbody) return;

  const orders = getAllOrdersFlat();
  tbody.innerHTML = '';

  if (orders.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="4">No hay pedidos registrados.</td>';
    tbody.appendChild(tr);
    return;
  }

  orders.forEach((order) => {
    const tr = document.createElement('tr');
    const status = normalizeOrderStatus(order.status);
    const options = ORDER_STATUSES.map(
      (s) => `<option value="${s}"${s === status ? ' selected' : ''}>${s}</option>`
    ).join('');

    tr.innerHTML = `
      <td>${escapeHtml(order.id || '')}</td>
      <td>${escapeHtml(order.userName || order.userEmail || '—')}</td>
      <td>${formatPrice(Number(order.total) || 0)}</td>
      <td>
        <select class="admin-order-status" data-order-id="${escapeHtml(order.id)}" data-user-id="${escapeHtml(order.userId)}" aria-label="Estado del pedido ${escapeHtml(order.id)}">
          ${options}
        </select>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAll() {
  renderDashboard();
  renderUsersTable();
  renderProductsTable();
  renderOrdersTable();
}

function showModalAlert(message, type = 'error') {
  if (!adminEls.modalAlert) return;
  adminEls.modalAlert.textContent = message;
  adminEls.modalAlert.className = `auth-alert auth-alert--${type}`;
  adminEls.modalAlert.hidden = false;
}

function hideModalAlert() {
  if (adminEls.modalAlert) adminEls.modalAlert.hidden = true;
}

function openProductModal(mode, product = null) {
  productModalMode = mode;
  editingProductId = product?.id ?? null;

  if (!adminEls.modal || !adminEls.modalForm) return;

  hideModalAlert();
  adminEls.modalTitle.textContent = mode === 'create' ? 'Nuevo producto' : 'Editar producto';
  adminEls.modalForm.reset();

  if (product) {
    adminEls.modalForm.elements.title.value = product.title || '';
    adminEls.modalForm.elements.price.value = product.price ?? '';
    adminEls.modalForm.elements.category.value = product.category || '';
    adminEls.modalForm.elements.image.value = product.image || '';
    adminEls.modalForm.elements.description.value = product.description || '';
    adminEls.modalForm.elements.rate.value = product.rating?.rate ?? '';
    adminEls.modalForm.elements.count.value = product.rating?.count ?? '';
  }

  adminEls.modal.hidden = false;
  adminEls.modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('admin-modal-open');
  adminEls.modalForm.elements.title.focus();
}

function closeProductModal() {
  if (!adminEls.modal) return;
  adminEls.modal.hidden = true;
  adminEls.modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('admin-modal-open');
  hideModalAlert();
  editingProductId = null;
  productModalMode = 'create';
}

function validateProductForm(form) {
  const title = form.title.value.trim();
  const price = parseFloat(form.price.value);
  const category = form.category.value.trim();
  const image = form.image.value.trim();

  if (!title) return { valid: false, message: 'El título es obligatorio.' };
  if (Number.isNaN(price) || price < 0) return { valid: false, message: 'Introduce un precio válido.' };
  if (!category) return { valid: false, message: 'La categoría es obligatoria.' };
  if (!image) return { valid: false, message: 'La URL de imagen es obligatoria.' };

  const rate = form.rate.value !== '' ? parseFloat(form.rate.value) : 0;
  const count = form.count.value !== '' ? parseInt(form.count.value, 10) : 0;

  return {
    valid: true,
    data: {
      title,
      price,
      category,
      image,
      description: form.description.value.trim(),
      rating: {
        rate: Number.isNaN(rate) ? 0 : rate,
        count: Number.isNaN(count) ? 0 : count,
      },
    },
  };
}

function handleProductFormSubmit(e) {
  e.preventDefault();
  const validation = validateProductForm(adminEls.modalForm);
  if (!validation.valid) {
    showModalAlert(validation.message, 'error');
    return;
  }

  const products = getProducts();

  if (productModalMode === 'create') {
    const newProduct = {
      id: getNextProductId(products),
      ...validation.data,
    };
    products.push(newProduct);
    saveProducts(products);
    closeProductModal();
    renderProductsTable();
    renderDashboard();
    return;
  }

  const index = products.findIndex((p) => String(p.id) === String(editingProductId));
  if (index === -1) {
    showModalAlert('Producto no encontrado.', 'error');
    return;
  }

  products[index] = {
    ...products[index],
    ...validation.data,
    id: editingProductId,
  };
  saveProducts(products);
  closeProductModal();
  renderProductsTable();
  renderDashboard();
}

function deleteProduct(productId) {
  const products = getProducts();
  const product = products.find((p) => String(p.id) === String(productId));
  if (!product) return;

  const confirmed = window.confirm(`¿Eliminar "${product.title}" del inventario?`);
  if (!confirmed) return;

  const updated = products.filter((p) => String(p.id) !== String(productId));
  saveProducts(updated);
  renderProductsTable();
  renderDashboard();
}

function updateOrderStatus(userId, orderId, newStatus) {
  if (!ORDER_STATUSES.includes(newStatus)) return;

  const all = getAllOrdersByUser();
  const userOrders = all[userId];
  if (!Array.isArray(userOrders)) return;

  const index = userOrders.findIndex((o) => o.id === orderId);
  if (index === -1) return;

  userOrders[index] = {
    ...userOrders[index],
    status: newStatus,
  };
  all[userId] = userOrders;
  saveAllOrders(all);
}

function handleProductsTableClick(e) {
  const editBtn = e.target.closest('[data-product-edit]');
  if (editBtn) {
    const id = editBtn.dataset.productEdit;
    const product = getProducts().find((p) => String(p.id) === String(id));
    if (product) openProductModal('edit', product);
    return;
  }

  const deleteBtn = e.target.closest('[data-product-delete]');
  if (deleteBtn) {
    deleteProduct(deleteBtn.dataset.productDelete);
  }
}

function handleOrdersTableChange(e) {
  const select = e.target.closest('.admin-order-status');
  if (!select) return;

  updateOrderStatus(select.dataset.userId, select.dataset.orderId, select.value);
}

function createProductModal() {
  const modal = document.createElement('div');
  modal.className = 'cart-checkout admin-product-modal';
  modal.id = 'admin-product-modal';
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'admin-product-modal-title');

  modal.innerHTML = `
    <div class="cart-checkout__backdrop" id="admin-product-modal-backdrop"></div>
    <div class="cart-checkout__panel">
      <header class="cart-checkout__header">
        <h2 class="cart-checkout__title" id="admin-product-modal-title">Nuevo producto</h2>
        <button type="button" class="cart-checkout__close" id="admin-product-modal-close" aria-label="Cerrar">×</button>
      </header>
      <div class="auth-alert auth-alert--error" id="admin-product-modal-alert" hidden role="alert"></div>
      <form class="cart-checkout__form auth-form" id="admin-product-form" novalidate>
        <div class="auth-form__group">
          <label for="product-title">Título</label>
          <input type="text" id="product-title" name="title" required>
        </div>
        <div class="auth-form__group">
          <label for="product-price">Precio (USD)</label>
          <input type="number" id="product-price" name="price" min="0" step="0.01" required>
        </div>
        <div class="auth-form__group">
          <label for="product-category">Categoría</label>
          <input type="text" id="product-category" name="category" required>
        </div>
        <div class="auth-form__group">
          <label for="product-image">URL de imagen</label>
          <input type="url" id="product-image" name="image" required>
        </div>
        <div class="auth-form__group">
          <label for="product-description">Descripción</label>
          <textarea id="product-description" name="description" rows="3"></textarea>
        </div>
        <div class="cart-checkout__row">
          <div class="auth-form__group">
            <label for="product-rate">Valoración (0–5)</label>
            <input type="number" id="product-rate" name="rate" min="0" max="5" step="0.1">
          </div>
          <div class="auth-form__group">
            <label for="product-count">Nº valoraciones</label>
            <input type="number" id="product-count" name="count" min="0" step="1">
          </div>
        </div>
        <button type="submit" class="btn btn--primary cart-checkout__submit">Guardar producto</button>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  adminEls.modal = modal;
  adminEls.modalTitle = modal.querySelector('#admin-product-modal-title');
  adminEls.modalForm = modal.querySelector('#admin-product-form');
  adminEls.modalAlert = modal.querySelector('#admin-product-modal-alert');

  modal.querySelector('#admin-product-modal-close')?.addEventListener('click', closeProductModal);
  modal.querySelector('#admin-product-modal-backdrop')?.addEventListener('click', closeProductModal);
  adminEls.modalForm?.addEventListener('submit', handleProductFormSubmit);
}

function cacheAdminElements() {
  adminEls.welcome = document.getElementById('admin-welcome');
  adminEls.totalRevenue = document.getElementById('admin-total-revenue');
  adminEls.topProducts = document.getElementById('admin-top-products');
  adminEls.userStats = document.getElementById('admin-user-stats');
  adminEls.usersBody = document.getElementById('admin-users-body');
  adminEls.productsBody = document.getElementById('admin-products-body');
  adminEls.ordersBody = document.getElementById('admin-orders-body');
  adminEls.productCreateBtn = document.getElementById('admin-product-create-btn');
}

function bindAdminEvents() {
  adminEls.productCreateBtn?.addEventListener('click', () => openProductModal('create'));
  adminEls.productsBody?.addEventListener('click', handleProductsTableClick);
  adminEls.ordersBody?.addEventListener('change', handleOrdersTableChange);

  document.getElementById('module-logout')?.addEventListener('click', () => {
    Auth.logout();
    window.location.href = 'auth.html';
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && adminEls.modal && !adminEls.modal.hidden) {
      closeProductModal();
    }
  });
}

function initAdminPage() {
  if (!document.body.classList.contains('module-page')) return;
  if (!document.getElementById('admin-total-revenue')) return;

  cacheAdminElements();
  createProductModal();
  bindAdminEvents();

  const user = Auth.getCurrentUser();
  if (user && adminEls.welcome) {
    adminEls.welcome.textContent = `Hola, ${user.name}`;
  }

  renderAll();
}

document.addEventListener('DOMContentLoaded', initAdminPage);
