// app.js · estado y vistas de la SPA. Aquí no hay ni un gtag(): todo lo que
// va a GA4 pasa por analytics.js.
import { PRODUCTS, LISTS, getProduct, getFeatured } from './catalog.js';
import { addRoute, navigate, start, href } from './router.js';
import {
  initAnalytics, getStoredConsent, updateConsent,
  trackViewItemList, trackSelectItem, trackViewItem,
  trackAddToCart, trackRemoveFromCart, trackViewCart,
  trackBeginCheckout, trackAddShippingInfo, trackAddPaymentInfo, trackPurchase,
} from './analytics.js';

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------
const TAX_RATE = 0.10;            // IVA plano, simplificación didáctica
const SHIPPING_CENTS = { 'Recogida en obrador': 0, 'Envío a domicilio': 350 };

const state = {
  cart: new Map(),      // item_id → { product, quantity, list, index }
  lastList: new Map(),  // item_id → { list, index } · de dónde vino el último select_item
  shipping: null,       // shipping_tier elegido
  payment: null,        // payment_type elegido
};

// El carrito sobrevive a una recarga (sessionStorage) para que un F5 a mitad
// de compra no vacíe la cesta ni rompa el flujo de la demo.
function persist() {
  const cart = [...state.cart.values()].map((l) => ({ id: l.product.item_id, quantity: l.quantity, list: l.list, index: l.index }));
  const lastList = [...state.lastList.entries()];
  try { sessionStorage.setItem('mm_state', JSON.stringify({ cart, lastList })); } catch { /* modo privado */ }
}
function restore() {
  try {
    const raw = sessionStorage.getItem('mm_state');
    if (!raw) return;
    const { cart, lastList } = JSON.parse(raw);
    cart.forEach((l) => { const p = getProduct(l.id); if (p) state.cart.set(l.id, { product: p, quantity: l.quantity, list: l.list, index: l.index }); });
    lastList.forEach(([id, ctx]) => state.lastList.set(id, ctx));
  } catch { /* estado corrupto: se ignora */ }
}

const cartLines = () => [...state.cart.values()];
const cartCount = () => cartLines().reduce((n, l) => n + l.quantity, 0);
const cents = (eur) => Math.round(eur * 100);
const subtotalCents = () => cartLines().reduce((n, l) => n + cents(l.product.price) * l.quantity, 0);
const fmt = (c) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(c / 100);

// ---------------------------------------------------------------------------
// Vistas
// ---------------------------------------------------------------------------
const app = document.getElementById('app');

function productCard(p, list, index) {
  return `
    <a class="card" href="${href(`/panes/${p.item_id}`)}"
       data-item-id="${p.item_id}" data-list="${list.id}" data-index="${index}"
       data-testid="product-card-${p.item_id}">
      <span class="card__cat">${p.item_category2}</span>
      <span class="card__name">${p.item_name}</span>
      <span class="card__price">${fmt(cents(p.price))}</span>
    </a>`;
}

function renderHome() {
  const featured = getFeatured();
  app.innerHTML = `
    <section class="hero">
      ${LOAF_SVG}
      <h1>Pan de masa madre, hecho aquí.</h1>
      <p>Horneamos cada mañana desde las cinco. Encarga hoy y recoge mañana en el obrador, o te lo llevamos a casa.</p>
      <a class="btn" href="${href('/panes')}" data-route="/panes" data-testid="hero-cta">Ver los panes</a>
    </section>
    <section>
      <h2>Los de siempre</h2>
      <div class="grid">${featured.map((p, i) => productCard(p, LISTS.destacados_home, i)).join('')}</div>
    </section>
    <section class="info">
      <h2>Horario</h2>
      <p>De martes a sábado, de 8:00 a 14:00. Domingos hasta las 13:00. Lunes descansamos.</p>
    </section>`;
  trackViewItemList(LISTS.destacados_home, featured);
}

function renderCatalog() {
  app.innerHTML = `
    <h1>Panes</h1>
    <p class="lead">Todo con masa madre propia y harinas de molino. Lo que ves es lo que hay hoy.</p>
    <div class="grid">${PRODUCTS.map((p, i) => productCard(p, LISTS.catalogo, i)).join('')}</div>`;
  trackViewItemList(LISTS.catalogo, PRODUCTS);
}

function renderDetail({ item_id }) {
  const p = getProduct(item_id);
  if (!p) return renderNotFound();
  const listCtx = state.lastList.get(item_id); // undefined si llegó por URL directa
  let qty = 1;
  app.innerHTML = `
    <article class="detail">
      <span class="card__cat">${p.item_category} · ${p.item_category2}</span>
      <h1>${p.item_name}</h1>
      <p class="detail__price">${fmt(cents(p.price))}</p>
      <p>${p.blurb}</p>
      <div class="qty">
        <button type="button" class="qty__btn" data-testid="detail-qty-minus" aria-label="Menos">−</button>
        <span class="qty__n" data-testid="detail-qty">1</span>
        <button type="button" class="qty__btn" data-testid="detail-qty-plus" aria-label="Más">+</button>
      </div>
      <button type="button" class="btn btn--block" data-testid="add-to-cart">Añadir a la cesta</button>
      <p class="muted" data-testid="add-feedback"></p>
      <a class="link" href="${href('/panes')}" data-route="/panes">← Todos los panes</a>
    </article>`;

  const qtyEl = app.querySelector('[data-testid=detail-qty]');
  app.querySelector('[data-testid=detail-qty-minus]').onclick = () => { qty = Math.max(1, qty - 1); qtyEl.textContent = qty; };
  app.querySelector('[data-testid=detail-qty-plus]').onclick = () => { qty = Math.min(12, qty + 1); qtyEl.textContent = qty; };
  app.querySelector('[data-testid=add-to-cart]').onclick = () => {
    addToCart(p, qty, listCtx);
    app.querySelector('[data-testid=add-feedback]').textContent = `Añadido. Llevas ${cartCount()} en la cesta.`;
  };

  trackViewItem(p, listCtx);
}

function renderCart() {
  const lines = cartLines();
  if (!lines.length) {
    app.innerHTML = `
      <h1>Tu cesta</h1>
      <p class="lead">Está vacía. Ya sabes dónde están los panes.</p>
      <a class="btn" href="${href('/panes')}" data-route="/panes">Ver los panes</a>`;
    return;
  }
  app.innerHTML = `
    <h1>Tu cesta</h1>
    <ul class="lines">
      ${lines.map((l) => `
        <li class="line" data-testid="cart-line-${l.product.item_id}">
          <div class="line__main">
            <span class="line__name">${l.product.item_name}</span>
            <span class="muted">${fmt(cents(l.product.price))} / ud.</span>
          </div>
          <div class="qty">
            <button type="button" class="qty__btn" data-action="minus" data-id="${l.product.item_id}" data-testid="qty-minus-${l.product.item_id}" aria-label="Menos">−</button>
            <span class="qty__n">${l.quantity}</span>
            <button type="button" class="qty__btn" data-action="plus" data-id="${l.product.item_id}" data-testid="qty-plus-${l.product.item_id}" aria-label="Más">+</button>
          </div>
          <span class="line__total">${fmt(cents(l.product.price) * l.quantity)}</span>
          <button type="button" class="link" data-action="remove" data-id="${l.product.item_id}" data-testid="cart-remove-${l.product.item_id}">Quitar</button>
        </li>`).join('')}
    </ul>
    <p class="total"><span>Subtotal</span><strong data-testid="cart-subtotal">${fmt(subtotalCents())}</strong></p>
    <p class="muted">Impuestos y envío se calculan en el siguiente paso.</p>
    <a class="btn btn--block" href="${href('/checkout')}" data-route="/checkout" data-testid="cart-checkout">Hacer el pedido</a>`;

  app.querySelectorAll('[data-action]').forEach((btn) => {
    btn.onclick = () => {
      const line = state.cart.get(btn.dataset.id);
      if (!line) return;
      const ctx = { list: line.list, index: line.index };
      if (btn.dataset.action === 'plus') addToCart(line.product, 1, ctx);
      if (btn.dataset.action === 'minus') removeFromCart(line.product, 1, ctx);
      if (btn.dataset.action === 'remove') removeFromCart(line.product, line.quantity, ctx);
      renderCart(); // re-render sin nuevo page_view ni view_cart: es la misma vista
    };
  });
}

// view_cart solo se dispara al ENTRAR en la vista; los +/− re-renderizan la
// lista pero no son una vista nueva. Por eso el render y el tracking se separan.
function viewCart() {
  renderCart();
  const lines = cartLines();
  if (lines.length) trackViewCart(lines);
}

function renderCheckout() {
  const lines = cartLines();
  if (!lines.length) {
    app.innerHTML = `
      <h1>Pedido</h1>
      <p class="lead">No hay nada en la cesta.</p>
      <a class="btn" href="${href('/panes')}" data-route="/panes">Ver los panes</a>`;
    return;
  }
  state.shipping = null;
  state.payment = null;
  app.innerHTML = `
    <h1>Pedido</h1>
    <h2>Entrega</h2>
    <div class="choices" data-group="shipping">
      <button type="button" class="choice" data-value="Recogida en obrador" data-testid="shipping-pickup">Recogida en obrador <small>gratis</small></button>
      <button type="button" class="choice" data-value="Envío a domicilio" data-testid="shipping-delivery">Envío a domicilio <small>3,50 €</small></button>
    </div>
    <h2>Pago</h2>
    <div class="choices" data-group="payment">
      <button type="button" class="choice" data-value="Tarjeta" data-testid="payment-card">Tarjeta</button>
      <button type="button" class="choice" data-value="Bizum" data-testid="payment-bizum">Bizum</button>
    </div>
    <div class="summary" id="summary"></div>
    <button type="button" class="btn btn--block" data-testid="confirm-order" disabled>Confirmar pedido</button>
    <p class="muted">Es una tienda de mentira: no se cobra nada.</p>`;

  const confirm = app.querySelector('[data-testid=confirm-order]');
  app.querySelectorAll('.choices').forEach((group) => {
    group.querySelectorAll('.choice').forEach((btn) => {
      btn.onclick = () => {
        const value = btn.dataset.value;
        const key = group.dataset.group;
        if (state[key] === value) return; // misma opción: ni re-tracking ni cambios
        state[key] = value;
        group.querySelectorAll('.choice').forEach((b) => b.classList.toggle('is-selected', b === btn));
        if (key === 'shipping') trackAddShippingInfo(lines, value);
        if (key === 'payment') trackAddPaymentInfo(lines, value);
        renderSummary();
        confirm.disabled = !(state.shipping && state.payment);
      };
    });
  });
  confirm.onclick = () => confirmOrder(lines);
  renderSummary();

  trackBeginCheckout(lines);
}

function orderTotals() {
  const subtotal = subtotalCents();
  const tax = Math.round(subtotal * TAX_RATE);
  const shipping = state.shipping ? SHIPPING_CENTS[state.shipping] : 0;
  return { subtotal, tax, shipping, total: subtotal + tax + shipping };
}

function renderSummary() {
  const t = orderTotals();
  document.getElementById('summary').innerHTML = `
    <p><span>Subtotal</span><span data-testid="sum-subtotal">${fmt(t.subtotal)}</span></p>
    <p><span>IVA (10 %)</span><span data-testid="sum-tax">${fmt(t.tax)}</span></p>
    <p><span>Envío</span><span data-testid="sum-shipping">${state.shipping ? fmt(t.shipping) : '—'}</span></p>
    <p class="total"><span>Total</span><strong data-testid="sum-total">${fmt(t.total)}</strong></p>`;
}

function confirmOrder(lines) {
  const t = orderTotals();
  const order = {
    // Único por pedido. Un id fijo o reutilizado haría que GA4 descartara
    // compras reales como duplicadas.
    transaction_id: `MM-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    lines,
    tax: t.tax / 100,
    shipping: t.shipping / 100,
  };
  trackPurchase(order);              // 1. purchase, una sola vez
  try { sessionStorage.setItem('mm_last_order', JSON.stringify({ transaction_id: order.transaction_id, total: t.total, lines: lines.map((l) => ({ product: l.product, quantity: l.quantity })) })); } catch { /* modo privado */ }
  state.cart.clear();                // 2. vaciar cesta (volver atrás no repite nada)
  persist();
  updateCartBadge();
  navigate('/gracias');              // 3. page_view de /gracias, sin purchase
}

function renderThanks() {
  let order = null;
  try { order = JSON.parse(sessionStorage.getItem('mm_last_order')); } catch { /* nada */ }
  if (order && order.lines) trackPurchase(order);
  app.innerHTML = order ? `
    <h1>Gracias.</h1>
    <p class="lead">Pedido <strong data-testid="order-id">${order.transaction_id}</strong> · ${fmt(order.total)}</p>
    <p>Te esperamos en el obrador. Si es envío, sale con el reparto de la mañana.</p>
    <a class="btn" href="${href('/')}" data-route="/">Volver al inicio</a>` : `
    <h1>Gracias.</h1>
    <p class="lead">No hay ningún pedido reciente.</p>
    <a class="btn" href="${href('/panes')}" data-route="/panes">Ver los panes</a>`;
}

function renderNotFound() {
  app.innerHTML = `
    <h1>Esto no está en el horno.</h1>
    <p class="lead">La página no existe.</p>
    <a class="btn" href="${href('/')}" data-route="/">Volver al inicio</a>`;
}

// ---------------------------------------------------------------------------
// Acciones del carrito (mutan estado + tracking)
// ---------------------------------------------------------------------------
function addToCart(product, quantity, listCtx) {
  const line = state.cart.get(product.item_id) || { product, quantity: 0, ...(listCtx || {}) };
  line.quantity += quantity;
  state.cart.set(product.item_id, line);
  persist();
  updateCartBadge();
  trackAddToCart(product, quantity, listCtx);
}

function removeFromCart(product, quantity, listCtx) {
  const line = state.cart.get(product.item_id);
  if (!line) return;
  const removed = Math.min(quantity, line.quantity);
  line.quantity -= removed;
  if (line.quantity === 0) state.cart.delete(product.item_id);
  persist();
  updateCartBadge();
  trackRemoveFromCart(product, removed, listCtx);
}

function updateCartBadge() {
  const n = cartCount();
  const badge = document.getElementById('cart-count');
  badge.textContent = n || '';
  badge.hidden = !n;
}

// Clic en una tarjeta: select_item con su lista y posición, se guarda el
// contexto para propagarlo a view_item/add_to_cart, y se navega.
document.addEventListener('click', (e) => {
  const card = e.target.closest('a[data-item-id][data-list]');
  if (!card || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  const product = getProduct(card.dataset.itemId);
  const list = LISTS[card.dataset.list];
  const index = Number(card.dataset.index);
  trackSelectItem(list, product, index);
  state.lastList.set(product.item_id, { list, index });
  persist();
  navigate(`/panes/${product.item_id}`);
});

// ---------------------------------------------------------------------------
// Banner de consentimiento
// ---------------------------------------------------------------------------
const banner = document.getElementById('consent-banner');
function showBanner(show) { banner.hidden = !show; }
document.querySelector('[data-testid=consent-accept]').onclick = () => { updateConsent(true); showBanner(false); };
document.querySelector('[data-testid=consent-reject]').onclick = () => { updateConsent(false); showBanner(false); };
document.querySelector('[data-testid=consent-reopen]').onclick = (e) => { e.preventDefault(); showBanner(true); };

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------
const LOAF_SVG = `
  <svg class="loaf" viewBox="0 0 120 64" aria-hidden="true">
    <path d="M8 44c0-18 22-32 52-32s52 14 52 32c0 6-4 10-10 10H18c-6 0-10-4-10-10z" fill="none" stroke="currentColor" stroke-width="3"/>
    <path d="M34 22l10 14M52 16l10 16M70 16l10 16M88 22l8 12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
  </svg>`;

initAnalytics();                       // consent default → gtag/js → config
// Los enlaces estáticos del header llevan href absoluto con base path (para
// abrir en pestaña nueva / sin JS); la navegación normal la intercepta el router.
document.querySelectorAll('a[data-route]').forEach((a) => { a.href = href(a.dataset.route); });
showBanner(!getStoredConsent());       // sin elección guardada, se pregunta
restore();
updateCartBadge();

addRoute('/',                 { title: () => 'La Masa Madre · Obrador',               render: renderHome });
addRoute('/panes',            { title: () => 'Panes · La Masa Madre',                 render: renderCatalog });
addRoute('/panes/:item_id',   { title: (p) => `${getProduct(p.item_id)?.item_name ?? 'Pan'} · La Masa Madre`, render: renderDetail });
addRoute('/carrito',          { title: () => 'Tu cesta · La Masa Madre',              render: viewCart });
addRoute('/checkout',         { title: () => 'Pedido · La Masa Madre',                render: renderCheckout });
addRoute('/gracias',          { title: () => 'Gracias · La Masa Madre',               render: renderThanks });
addRoute('/404',              { title: () => 'No encontrado · La Masa Madre',         render: renderNotFound });

start();                               // primer page_view + render
