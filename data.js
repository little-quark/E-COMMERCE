const PRODUCTS_KEY = 'local_products';
const API_URL = 'https://fakestoreapi.com/products';
const FEATURED_COUNT = 4;

let allProducts = [];
let carouselIndex = 0;
let carouselTimer = null;

const filters = {
  category: '',
  minPrice: '',
  maxPrice: '',
  search: '',
};

const els = {
  carouselTrack: null,
  carouselDots: null,
  catalogGrid: null,
  catalogCount: null,
  catalogEmpty: null,
  filterCategory: null,
  filterMinPrice: null,
  filterMaxPrice: null,
  filterSearch: null,
  headerSearch: null,
};

function saveProducts(products) {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}

function loadProductsFromStorage() {
  const raw = localStorage.getItem(PRODUCTS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function fetchProductsFromAPI() {
  return fetch(API_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      saveProducts(data);
      return data;
    });
}

function initProducts() {
  const cached = loadProductsFromStorage();

  if (cached) {
    allProducts = cached;
    return Promise.resolve(cached);
  }

  return fetchProductsFromAPI().then((data) => {
    allProducts = data;
    return data;
  });
}

function getFeaturedProducts(products, count = FEATURED_COUNT) {
  return [...products]
    .sort((a, b) => b.rating.rate - a.rating.rate)
    .slice(0, count);
}

function formatPrice(price) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

function capitalizeCategory(category) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function createProductCard(product, variant = 'catalog') {
  const article = document.createElement('article');
  article.className = variant === 'carousel'
    ? 'carousel__slide product-card product-card--carousel'
    : 'product-card';
  article.dataset.productId = product.id;

  article.innerHTML = `
    <div class="product-card__image-wrap">
      <img
        class="product-card__image"
        src="${product.image}"
        alt="${product.title}"
        loading="lazy"
        width="200"
        height="200"
      >
    </div>
    <div class="product-card__body">
      <span class="product-card__category">${capitalizeCategory(product.category)}</span>
      <h3 class="product-card__title">${product.title}</h3>
      <div class="product-card__meta">
        <span class="product-card__price">${formatPrice(product.price)}</span>
        <span class="product-card__rating" aria-label="Valoración ${product.rating.rate} de 5">
          ★ ${product.rating.rate}
        </span>
      </div>
      <button type="button" class="btn btn--primary product-card__add-btn" data-add-to-cart="${String(product.id)}">
        Añadir al carrito
      </button>
    </div>
  `;

  return article;
}

function renderFeaturedCarousel(products) {
  const track = els.carouselTrack;
  const dots = els.carouselDots;
  if (!track || !dots) return;

  const featured = getFeaturedProducts(products);
  track.innerHTML = '';
  dots.innerHTML = '';

  featured.forEach((product, index) => {
    track.appendChild(createProductCard(product, 'carousel'));
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel__dot' + (index === 0 ? ' carousel__dot--active' : '');
    dot.setAttribute('aria-label', `Ir al producto ${index + 1}`);
    dot.dataset.index = index;
    dot.addEventListener('click', () => goToSlide(index));
    dots.appendChild(dot);
  });

  carouselIndex = 0;
  updateCarouselPosition();
  startCarouselAutoplay();
}

function updateCarouselPosition() {
  const track = els.carouselTrack;
  if (!track) return;

  const slides = track.querySelectorAll('.carousel__slide');
  if (!slides.length) return;

  const viewport = track.parentElement;
  const slideWidth = viewport ? viewport.offsetWidth : slides[0].offsetWidth;
  track.style.transform = `translateX(-${carouselIndex * slideWidth}px)`;

  slides.forEach((slide, i) => {
    slide.classList.toggle('carousel__slide--active', i === carouselIndex);
    slide.setAttribute('aria-hidden', i !== carouselIndex ? 'true' : 'false');
  });

  els.carouselDots?.querySelectorAll('.carousel__dot').forEach((dot, i) => {
    dot.classList.toggle('carousel__dot--active', i === carouselIndex);
  });
}

function goToSlide(index) {
  const slides = els.carouselTrack?.querySelectorAll('.carousel__slide');
  if (!slides?.length) return;

  const total = slides.length;
  carouselIndex = ((index % total) + total) % total;
  updateCarouselPosition();
  resetCarouselAutoplay();
}

function startCarouselAutoplay() {
  stopCarouselAutoplay();
  carouselTimer = setInterval(() => {
    goToSlide(carouselIndex + 1);
  }, 5000);
}

function stopCarouselAutoplay() {
  if (carouselTimer) {
    clearInterval(carouselTimer);
    carouselTimer = null;
  }
}

function resetCarouselAutoplay() {
  stopCarouselAutoplay();
  startCarouselAutoplay();
}

function getUniqueCategories(products) {
  return [...new Set(products.map((p) => p.category))].sort();
}

function populateCategoryFilter(products) {
  const select = els.filterCategory;
  if (!select) return;

  const current = select.value;
  select.innerHTML = '<option value="">Todas las categorías</option>';

  getUniqueCategories(products).forEach((cat) => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = capitalizeCategory(cat);
    select.appendChild(option);
  });

  select.value = current;
}

function filterProducts(products) {
  const { category, minPrice, maxPrice, search } = filters;
  const min = minPrice !== '' ? parseFloat(minPrice) : null;
  const max = maxPrice !== '' ? parseFloat(maxPrice) : null;
  const term = search.trim().toLowerCase();

  return products.filter((product) => {
    if (category && product.category !== category) return false;
    if (min !== null && product.price < min) return false;
    if (max !== null && product.price > max) return false;
    if (term) {
      const haystack = `${product.title} ${product.description} ${product.category}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

function renderCatalog(products) {
  const grid = els.catalogGrid;
  const countEl = els.catalogCount;
  const emptyEl = els.catalogEmpty;
  if (!grid) return;

  const filtered = filterProducts(products);
  grid.innerHTML = '';

  if (countEl) {
    countEl.textContent = `${filtered.length} producto${filtered.length !== 1 ? 's' : ''}`;
  }

  if (emptyEl) {
    emptyEl.hidden = filtered.length > 0;
  }

  filtered.forEach((product) => {
    grid.appendChild(createProductCard(product));
  });
}

function applyFiltersAndRender() {
  renderCatalog(allProducts);
}

function bindFilterEvents() {
  els.filterCategory?.addEventListener('change', (e) => {
    filters.category = e.target.value;
    applyFiltersAndRender();
  });

  els.filterMinPrice?.addEventListener('input', (e) => {
    filters.minPrice = e.target.value;
    applyFiltersAndRender();
  });

  els.filterMaxPrice?.addEventListener('input', (e) => {
    filters.maxPrice = e.target.value;
    applyFiltersAndRender();
  });

  els.filterSearch?.addEventListener('input', (e) => {
    filters.search = e.target.value;
    applyFiltersAndRender();
  });

  els.headerSearch?.addEventListener('input', (e) => {
    filters.search = e.target.value;
    if (els.filterSearch) els.filterSearch.value = e.target.value;
    applyFiltersAndRender();
  });

  els.headerSearch?.closest('form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('carousel-prev')?.addEventListener('click', () => {
    goToSlide(carouselIndex - 1);
  });

  document.getElementById('carousel-next')?.addEventListener('click', () => {
    goToSlide(carouselIndex + 1);
  });

  els.carouselTrack?.closest('.carousel')?.addEventListener('mouseenter', stopCarouselAutoplay);
  els.carouselTrack?.closest('.carousel')?.addEventListener('mouseleave', startCarouselAutoplay);
}

function showCatalogError(message) {
  const grid = els.catalogGrid;
  if (!grid) return;
  grid.innerHTML = `<p class="catalog__error" role="alert">${message}</p>`;
}

function cacheDomElements() {
  els.carouselTrack = document.getElementById('carousel-track');
  els.carouselDots = document.getElementById('carousel-dots');
  els.catalogGrid = document.getElementById('catalog-grid');
  els.catalogCount = document.getElementById('catalog-count');
  els.catalogEmpty = document.getElementById('catalog-empty');
  els.filterCategory = document.getElementById('filter-category');
  els.filterMinPrice = document.getElementById('filter-min-price');
  els.filterMaxPrice = document.getElementById('filter-max-price');
  els.filterSearch = document.getElementById('filter-search');
  els.headerSearch = document.getElementById('search-input');
}

function initCatalog() {
  cacheDomElements();
  bindFilterEvents();

  initProducts()
    .then((products) => {
      renderFeaturedCarousel(products);
      populateCategoryFilter(products);
      renderCatalog(products);
    })
    .catch(() => {
      showCatalogError('No se pudieron cargar los productos. Comprueba tu conexión e inténtalo de nuevo.');
    });
}

document.addEventListener('DOMContentLoaded', initCatalog);
