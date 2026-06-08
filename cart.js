(function () {
'use strict';

const CART_KEY_PREFIX = 'cart_';
const ORDERS_KEY = 'user_orders';
const OFFLINE_ORDERS_KEY = 'offline_orders_queue';
const PRODUCTS_KEY = 'local_products';
const SHIPPING_FREE_THRESHOLD = 50;
const SHIPPING_COST = 5.99;

const cartEls = {
  itemsList: null,
  emptyMsg: null,
  subtotal: null,
  shipping: null,
  total: null,
  checkoutBtn: null,
  badge: null,
  checkoutModal: null,
  checkoutForm: null,
  checkoutAlert: null,
  checkoutSuccess: null,
};

let cartItems = [];

function formatPrice(price) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

function getCartStorageKey() {
  const user = typeof Auth !== 'undefined' ? Auth.getCurrentUser() : null;
  return `${CART_KEY_PREFIX}${user ? user.id : 'guest'}`;
}

function loadCartFromStorage() {
  const raw = localStorage.getItem(getCartStorageKey());
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCartToStorage() {
  localStorage.setItem(getCartStorageKey(), JSON.stringify(cartItems));
}

function getProductById(productId) {
  const normalizedId = String(productId);
  const raw = localStorage.getItem(PRODUCTS_KEY);
  if (!raw) return null;

  try {
    const products = JSON.parse(raw);
    if (!Array.isArray(products)) return null;
    return products.find((p) => String(p.id) === normalizedId) || null;
  } catch {
    return null;
  }
}

function normalizeCartItem(product, quantity = 1) {
  return {
    productId: product.id,
    title: product.title,
    price: product.price,
    image: product.image,
    category: product.category,
    quantity,
  };
}

function getLineSubtotal(item) {
  return item.price * item.quantity;
}

function getSubtotal() {
  return cartItems.reduce((sum, item) => sum + getLineSubtotal(item), 0);
}

function getShippingCost() {
  const subtotal = getSubtotal();
  return subtotal > 0 && subtotal < SHIPPING_FREE_THRESHOLD ? SHIPPING_COST : 0;
}

function getTotal() {
  return getSubtotal() + getShippingCost();
}

function getItemCount() {
  return cartItems.reduce((sum, item) => sum + item.quantity, 0);
}

function addItem(product) {
  if (!product || product.id === undefined || product.id === null) {
    return { success: false, message: 'Producto no encontrado.' };
  }

  const normalizedId = String(product.id);
  const existing = cartItems.find((item) => String(item.productId) === normalizedId);

  if (existing) {
    existing.quantity += 1;
  } else {
    cartItems.push(normalizeCartItem(product));
  }

  saveCartToStorage();
  renderCart();
  return { success: true, message: 'Producto añadido al carrito.' };
}

function incrementItem(productId) {
  const item = cartItems.find((i) => i.productId === productId);
  if (!item) return { success: false, message: 'Producto no está en el carrito.' };

  item.quantity += 1;
  saveCartToStorage();
  renderCart();
  return { success: true };
}

function decrementItem(productId) {
  const item = cartItems.find((i) => i.productId === productId);
  if (!item) return { success: false, message: 'Producto no está en el carrito.' };

  if (item.quantity > 1) {
    item.quantity -= 1;
  } else {
    cartItems = cartItems.filter((i) => i.productId !== productId);
  }

  saveCartToStorage();
  renderCart();
  return { success: true };
}

function removeItem(productId) {
  const before = cartItems.length;
  cartItems = cartItems.filter((i) => i.productId !== productId);
  if (cartItems.length === before) {
    return { success: false, message: 'Producto no está en el carrito.' };
  }

  saveCartToStorage();
  renderCart();
  return { success: true };
}

function clearCart() {
  cartItems = [];
  saveCartToStorage();
  renderCart();
}

function getAllOrders() {
  const raw = localStorage.getItem(ORDERS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveAllOrders(ordersByUser) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(ordersByUser));
}

function getOrderHistory(userId) {
  if (!userId) return [];
  const all = getAllOrders();
  return Array.isArray(all[userId]) ? all[userId] : [];
}

function saveOrder(order) {
  const all = getAllOrders();
  const userId = order.userId;
  if (!all[userId]) all[userId] = [];
  all[userId].unshift(order);
  saveAllOrders(all);
}

function getOfflineOrdersQueue() {
  const raw = localStorage.getItem(OFFLINE_ORDERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOfflineOrdersQueue(queue) {
  localStorage.setItem(OFFLINE_ORDERS_KEY, JSON.stringify(queue));
}

function enqueueOfflineOrder(order) {
  const queue = getOfflineOrdersQueue();
  queue.push(order);
  saveOfflineOrdersQueue(queue);
}

function generateOrderId() {
  return `order-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function luhnCheck(number) {
  const digits = number.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function validateCardField(field, value) {
  const trimmed = value.trim();

  switch (field) {
    case 'cardName':
      return trimmed.length >= 3 && /^[a-zA-ZÀ-ÿ\s'-]+$/.test(trimmed);
    case 'cardNumber': {
      const digits = trimmed.replace(/\s/g, '');
      return /^\d{13,19}$/.test(digits) && luhnCheck(digits);
    }
    case 'cardExpiry': {
      const match = trimmed.match(/^(\d{2})\/(\d{2})$/);
      if (!match) return false;
      const month = parseInt(match[1], 10);
      const year = 2000 + parseInt(match[2], 10);
      if (month < 1 || month > 12) return false;
      const now = new Date();
      const expiry = new Date(year, month, 0, 23, 59, 59);
      return expiry >= now;
    }
    case 'cardCvv':
      return /^\d{3,4}$/.test(trimmed);
    default:
      return false;
  }
}

function setFieldValidation(input, isValid) {
  if (!input) return;
  input.classList.remove('cart-checkout__input--valid', 'cart-checkout__input--invalid');
  if (input.value.trim() === '') return;
  input.classList.add(isValid ? 'cart-checkout__input--valid' : 'cart-checkout__input--invalid');
}

function validateCheckoutForm(form) {
  const fields = {
    cardName: form.cardName.value,
    cardNumber: form.cardNumber.value,
    cardExpiry: form.cardExpiry.value,
    cardCvv: form.cardCvv.value,
  };

  const results = {};
  let allValid = true;

  Object.entries(fields).forEach(([key, value]) => {
    const valid = validateCardField(key, value);
    results[key] = valid;
    setFieldValidation(form.elements[key], valid);
    if (!valid) allValid = false;
  });

  return { allValid, results, fields };
}

function maskCardNumber(number) {
  const digits = number.replace(/\D/g, '');
  return `**** **** **** ${digits.slice(-4)}`;
}

function processCheckout(form) {
  const user = typeof Auth !== 'undefined' ? Auth.getCurrentUser() : null;
  if (!user) {
    return { success: false, message: 'Debes iniciar sesión para completar la compra.' };
  }
  if (cartItems.length === 0) {
    return { success: false, message: 'Tu carrito está vacío.' };
  }

  const validation = validateCheckoutForm(form);
  if (!validation.allValid) {
    return { success: false, message: 'Revisa los datos de la tarjeta. Los campos marcados en rojo no son válidos.' };
  }

  const subtotal = getSubtotal();
  const shipping = getShippingCost();
  const total = getTotal();

  const order = {
    id: generateOrderId(),
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    items: cartItems.map((item) => ({
      productId: item.productId,
      title: item.title,
      price: item.price,
      image: item.image,
      quantity: item.quantity,
      lineTotal: getLineSubtotal(item),
    })),
    subtotal,
    shipping,
    total,
    shippingAddress: user.shippingAddress || '',
    payment: {
      cardholderName: validation.fields.cardName.trim(),
      cardLast4: validation.fields.cardNumber.replace(/\D/g, '').slice(-4),
      cardMasked: maskCardNumber(validation.fields.cardNumber),
      method: 'card',
    },
    status: 'completed',
    createdAt: new Date().toISOString(),
  };

  if (!navigator.onLine) {
    const offlineOrder = {
      ...order,
      status: 'Pendiente',
      pendingSync: true,
    };
    enqueueOfflineOrder(offlineOrder);
    clearCart();
    closeCheckoutModal();
    return {
      success: true,
      message: 'Compra guardada localmente. Se procesará al recuperar la conexión.',
      order: offlineOrder,
      offline: true,
    };
  }

  saveOrder(order);
  clearCart();
  closeCheckoutModal();

  return {
    success: true,
    message: `¡Compra realizada! Pedido ${order.id} registrado correctamente.`,
    order,
  };
}

function createCartItemElement(item) {
  const li = document.createElement('li');
  li.className = 'cart-item';
  li.dataset.productId = item.productId;

  li.innerHTML = `
    <div class="cart-item__image-wrap">
      <img class="cart-item__image" src="${item.image}" alt="" width="72" height="72" loading="lazy">
    </div>
    <div class="cart-item__info">
      <h3 class="cart-item__title">${item.title}</h3>
      <p class="cart-item__price">${formatPrice(item.price)}</p>
    </div>
    <div class="cart-item__qty" role="group" aria-label="Cantidad de ${item.title}">
      <button type="button" class="cart-item__qty-btn" data-cart-action="decrement" data-product-id="${item.productId}" aria-label="Restar uno">−</button>
      <span class="cart-item__qty-value" aria-live="polite">${item.quantity}</span>
      <button type="button" class="cart-item__qty-btn" data-cart-action="increment" data-product-id="${item.productId}" aria-label="Sumar uno">+</button>
    </div>
    <p class="cart-item__line-total">${formatPrice(getLineSubtotal(item))}</p>
    <button type="button" class="cart-item__remove" data-cart-action="remove" data-product-id="${item.productId}" aria-label="Eliminar ${item.title}">×</button>
  `;

  return li;
}

function updateTotals() {
  const subtotal = getSubtotal();
  const shipping = getShippingCost();
  const total = getTotal();

  if (cartEls.subtotal) cartEls.subtotal.textContent = formatPrice(subtotal);
  if (cartEls.shipping) {
    cartEls.shipping.textContent = shipping === 0
      ? (subtotal > 0 ? 'Gratis' : formatPrice(0))
      : formatPrice(shipping);
  }
  if (cartEls.total) cartEls.total.textContent = formatPrice(total);
  if (cartEls.checkoutBtn) cartEls.checkoutBtn.disabled = cartItems.length === 0;
}

function updateBadge() {
  if (!cartEls.badge) return;
  const count = getItemCount();
  cartEls.badge.textContent = count > 99 ? '99+' : String(count);
  cartEls.badge.hidden = count === 0;
}

function renderCart() {
  const list = cartEls.itemsList;
  if (!list) return;

  list.innerHTML = '';

  if (cartEls.emptyMsg) {
    cartEls.emptyMsg.hidden = cartItems.length > 0;
  }

  cartItems.forEach((item) => {
    list.appendChild(createCartItemElement(item));
  });

  updateTotals();
  updateBadge();
}

function openCheckoutModal() {
  const modal = cartEls.checkoutModal;
  if (!modal) return;

  const user = typeof Auth !== 'undefined' ? Auth.getCurrentUser() : null;
  if (!user) {
    showCheckoutAlert('Debes iniciar sesión para pagar.', 'error');
    window.location.href = 'auth.html';
    return;
  }
  if (cartItems.length === 0) return;

  if (cartEls.checkoutForm) {
    cartEls.checkoutForm.reset();
    cartEls.checkoutForm.querySelectorAll('.cart-checkout__input--valid, .cart-checkout__input--invalid')
      .forEach((el) => el.classList.remove('cart-checkout__input--valid', 'cart-checkout__input--invalid'));
  }
  if (cartEls.checkoutSuccess) cartEls.checkoutSuccess.hidden = true;
  if (cartEls.checkoutForm) cartEls.checkoutForm.hidden = false;
  hideCheckoutAlert();

  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('cart-checkout-open');
  cartEls.checkoutForm?.elements.cardName?.focus();
}

function closeCheckoutModal() {
  const modal = cartEls.checkoutModal;
  if (!modal) return;

  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('cart-checkout-open');
  hideCheckoutAlert();
}

function showCheckoutAlert(message, type = 'error') {
  const alert = cartEls.checkoutAlert;
  if (!alert) return;
  alert.textContent = message;
  alert.className = `cart-checkout__alert cart-checkout__alert--${type}`;
  alert.hidden = false;
}

function hideCheckoutAlert() {
  if (cartEls.checkoutAlert) cartEls.checkoutAlert.hidden = true;
}

function showCheckoutSuccess(message, order) {
  if (!cartEls.checkoutSuccess) return;
  cartEls.checkoutSuccess.hidden = false;
  cartEls.checkoutSuccess.innerHTML = `
    <p class="cart-checkout__success-text">${message}</p>
    <p class="cart-checkout__success-order">Nº pedido: <strong>${order.id}</strong></p>
    <p class="cart-checkout__success-total">Total pagado: <strong>${formatPrice(order.total)}</strong></p>
    <button type="button" class="btn btn--primary" id="cart-checkout-close-success">Cerrar</button>
  `;
  document.getElementById('cart-checkout-close-success')?.addEventListener('click', closeCheckoutModal, { once: true });
}

function formatCardNumberInput(input) {
  const digits = input.value.replace(/\D/g, '').slice(0, 19);
  const groups = digits.match(/.{1,4}/g);
  input.value = groups ? groups.join(' ') : '';
}

function formatExpiryInput(input) {
  let digits = input.value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) {
    digits = `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  input.value = digits;
}

function bindCheckoutFieldValidation(form) {
  const fieldMap = {
    cardName: 'cardName',
    cardNumber: 'cardNumber',
    cardExpiry: 'cardExpiry',
    cardCvv: 'cardCvv',
  };

  Object.entries(fieldMap).forEach(([field, name]) => {
    const input = form.elements[name];
    if (!input) return;

    input.addEventListener('input', () => {
      if (name === 'cardNumber') formatCardNumberInput(input);
      if (name === 'cardExpiry') formatExpiryInput(input);
      if (name === 'cardCvv') input.value = input.value.replace(/\D/g, '').slice(0, 4);
      setFieldValidation(input, validateCardField(field, input.value));
    });

    input.addEventListener('blur', () => {
      setFieldValidation(input, validateCardField(field, input.value));
    });
  });
}

function handleCartAction(e) {
  const btn = e.target.closest('[data-cart-action]');
  if (!btn) return;

  const productId = Number(btn.dataset.productId);
  const action = btn.dataset.cartAction;

  switch (action) {
    case 'increment':
      incrementItem(productId);
      break;
    case 'decrement':
      decrementItem(productId);
      break;
    case 'remove':
      removeItem(productId);
      break;
    default:
      break;
  }
}

function handleAddToCart(e) {
  const btn = e.target.closest('[data-add-to-cart]');
  if (!btn) return;

  const rawId = btn.dataset.addToCart;
  if (rawId === undefined || rawId === '') return;

  const product = getProductById(String(rawId));
  const result = addItem(product);

  if (result.success) {
    btn.classList.add('product-card__add-btn--added');
    btn.textContent = '¡Añadido!';

    setTimeout(() => {
      btn.classList.remove('product-card__add-btn--added');
      btn.textContent = 'Añadir al carrito';
    }, 1500);
  }
}

function cacheCartElements() {
  cartEls.itemsList = document.getElementById('cart-items');
  cartEls.emptyMsg = document.getElementById('cart-empty');
  cartEls.subtotal = document.getElementById('cart-subtotal');
  cartEls.shipping = document.getElementById('cart-shipping');
  cartEls.total = document.getElementById('cart-total');
  cartEls.checkoutBtn = document.getElementById('cart-checkout-btn');
  cartEls.badge = document.getElementById('cart-badge');
  cartEls.checkoutModal = document.getElementById('cart-checkout');
  cartEls.checkoutForm = document.getElementById('cart-checkout-form');
  cartEls.checkoutAlert = document.getElementById('cart-checkout-alert');
  cartEls.checkoutSuccess = document.getElementById('cart-checkout-success');
}

let cartEventsBound = false;

function bindCartEvents() {
  if (cartEventsBound) return;
  cartEventsBound = true;

  document.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add-to-cart]');
    if (addBtn) {
      handleAddToCart(e);
      return;
    }

    const actionBtn = e.target.closest('[data-cart-action]');
    if (actionBtn && cartEls.itemsList?.contains(actionBtn)) {
      handleCartAction(e);
      return;
    }

    if (e.target.closest('#cart-checkout-btn')) {
      openCheckoutModal();
      return;
    }

    if (e.target.closest('#cart-checkout-close') || e.target.closest('#cart-checkout-backdrop')) {
      closeCheckoutModal();
      return;
    }

    if (e.target.closest('#cart-checkout-close-success')) {
      closeCheckoutModal();
    }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('#cart-checkout-form');
    if (!form) return;

    e.preventDefault();
    const result = processCheckout(form);
    if (result.success) {
      hideCheckoutAlert();
      showCheckoutSuccess(result.message, result.order);
      form.hidden = true;
    } else {
      showCheckoutAlert(result.message, 'error');
    }
  });

  if (cartEls.checkoutForm) {
    bindCheckoutFieldValidation(cartEls.checkoutForm);
  }
}

function initCart() {
  cacheCartElements();
  bindCartEvents();

  if (!document.getElementById('cart-items')) return;

  cartItems = loadCartFromStorage();
  renderCart();
}

document.addEventListener('DOMContentLoaded', initCart);

const Cart = {
  addItem,
  incrementItem,
  decrementItem,
  removeItem,
  clearCart,
  getItems: () => [...cartItems],
  getSubtotal,
  getShippingCost,
  getTotal,
  getItemCount,
  getOrderHistory,
  renderCart,
  formatPrice,
};

window.Cart = Cart;

})();
