/* ================================================================
   cart.js — Shopping Cart page logic
   Depends on: api.js (loaded first via <script> tag)
================================================================ */

'use strict';

/* ── STATE ──────────────────────────────────────────────────── */
let cartItems = [];   // Array of CartItem objects from backend

/* ── MOCK DATA (offline fallback) ───────────────────────────── */
function getMockCart() {
  return [
    { book_id: 1, title: 'The Midnight Library', author: 'Matt Haig',    price: 349, quantity: 1 },
    { book_id: 2, title: 'Atomic Habits',         author: 'James Clear',  price: 399, quantity: 2 },
  ];
}

/* ── LOAD CART FROM BACKEND ─────────────────────────────────── */
async function loadCart() {
  const wrap = document.getElementById('cart-wrap');
  if (!wrap) return;

  // Auth guard
  if (!Auth.isLoggedIn()) {
    wrap.innerHTML = `
      <div class="auth-wall">
        <div class="empty-icon">🔒</div>
        <h2 class="auth-wall-title">Sign in to view your cart</h2>
        <p class="auth-wall-sub">Your cart is saved to your account</p>
        <a href="login.html" class="auth-wall-btn">Sign In</a>
      </div>`;
    return;
  }

  // Show loading skeletons
  wrap.innerHTML = `
    <div style="padding:3rem 4rem">
      ${Array.from({ length: 3 }, (_, i) => `
        <div class="sk-card" style="animation-delay:${i * 0.07}s">
          <div style="flex:1">
            <div class="sk-line" style="width:40%;margin-bottom:10px"></div>
            <div class="sk-line" style="width:25%"></div>
          </div>
          <div class="sk-line" style="width:80px;height:32px;align-self:center"></div>
        </div>`).join('')}
    </div>`;

  try {
    cartItems = await apiGetCart();
  } catch (err) {
    console.warn('Cart fetch failed — using mock data:', err.message);
    cartItems = getMockCart();
  }

  renderCart();
}

/* ── RENDER CART ────────────────────────────────────────────── */
function renderCart() {
  const wrap = document.getElementById('cart-wrap');
  if (!wrap) return;

  if (!cartItems.length) {
    const needsAddress = cartItems.some(item => item.format !== 'ebook');
    wrap.innerHTML = `
      <div class="cart-empty" style="grid-column:1/-1">
        <div class="cart-empty-icon">🛒</div>
        <div class="cart-empty-title">Your cart is empty</div>
        <div class="cart-empty-sub">Add some books to get started</div>
        <a href="search.html" class="browse-link">Browse Books</a>
      </div>`;
    return;
  }

  const subtotal = cartItems.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0
  );
  const shipping = subtotal > 0 ? 49 : 0;
  const total    = subtotal + shipping;

  wrap.innerHTML = `
    <!-- ── ITEMS COLUMN ── -->
    <div class="cart-items">
      ${cartItems.map((item, i) => cartItemHTML(item, i)).join('')}
    </div>

    <!-- ── ORDER SUMMARY PANEL ── -->
    <div class="order-panel">
      <h2 class="panel-title">Place <em>Order</em></h2>

      <div class="summary-row">
        <span class="summary-label">Subtotal</span>
        <span class="summary-value">₹${subtotal}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Shipping</span>
        <span class="summary-value">₹${shipping}</span>
      </div>
      <div class="summary-total">
        <span class="summary-label">Total</span>
        <span class="summary-value">₹${total}</span>
      </div>

      <div class="order-form">
       ${needsAddress ? `
<div class="order-field">
  <label for="delivery-address">Delivery Address</label>
  <textarea id="delivery-address" rows="3"
    placeholder="Enter your full delivery address…"></textarea>
  <span class="field-hint">Required for physical books</span>
</div>` : `
<div class="order-field">
  <p class="ebook-note">📱 All items are ebooks — no delivery address needed.</p>
</div>`}
        <div class="order-field">
          <label for="phone">Phone Number</label>
          <input type="tel" id="phone" placeholder="+91 XXXXX XXXXX"/>
        </div>
        <div class="order-field">
          <label for="order-notes">Notes (optional)</label>
          <input type="text" id="order-notes" placeholder="Any special instructions…"/>
        </div>

        <button class="place-order-btn" id="place-btn" onclick="handlePlaceOrder()">
          <span class="btn-text">Place Order</span>
          <span class="spinner"></span>
        </button>

        <p class="panel-note">
          By placing your order you agree to our terms of service.
          Delivery within 3–7 business days.
        </p>
      </div>
    </div>`;
}

/* ── CART ITEM HTML ─────────────────────────────────────────── */
function cartItemHTML(item, idx) {
  const color  = SPINE_COLORS[idx % SPINE_COLORS.length];
  const title  = escHtml(item.title  || item.book_title  || 'Book');
  const author = escHtml(item.author || item.book_author || '');
  const price  = item.price ? `<div class="item-price">₹${item.price}</div>` : '';
const badge  = item.purchase_option
  ? `<span class="item-badge ${item.purchase_option}">${item.purchase_option.toUpperCase()}</span>` : '';
const meta   = `<span class="item-meta">${item.format || ''} · ${item.type || ''}</span>`;
  const qty    = item.quantity || 1;
  const delay  = `${idx * 0.06}s`;

  return `
    <div class="cart-item" style="animation-delay:${delay}">
      <div class="item-cover" style="background:${color}">${title}</div>
      <div class="item-info">
        <div class="item-title">${title}</div>
        <div class="item-author">${author}</div>
        ${price}
        ${badge}
        ${meta}
      </div>
      <div class="item-controls">
        <div class="qty-wrap">
          <button class="qty-btn" onclick="changeQty(${idx}, -1)">−</button>
          <span class="qty-val" id="qty-${idx}">${qty}</span>
          <button class="qty-btn" onclick="changeQty(${idx}, +1)">+</button>
        </div>
        <button class="remove-btn" onclick="removeFromCart(${item.book_id})">Remove</button>
      </div>
    </div>`;
}

/* ── QUANTITY CHANGE ────────────────────────────────────────── */
function changeQty(idx, delta) {
  cartItems[idx].quantity = Math.max(1, (cartItems[idx].quantity || 1) + delta);
  renderCart();
}
/* ── REMOVE ITEM (API + UI) ── */
async function removeFromCart(bookId) {
    const token = localStorage.getItem("folio_token") || localStorage.getItem("access_token");
    const url = `${BACKEND}/remove_from_cart?book_id=${bookId}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            // Success: Remove from local array and re-render
            cartItems = cartItems.filter(item => item.book_id !== bookId);
            renderCart();
            showToast('Item removed from selection', 'ok');
        } else {
            const data = await response.json();
            showToast(data.detail || 'Could not remove item', 'err');
        }
    } catch (err) {
        console.error("Remove error:", err);
        showToast('Server connection failed', 'err');
    }
}
/* ── REMOVE ITEM ────────────────────────────────────────────── */
function removeItem(idx) {
  cartItems.splice(idx, 1);
  renderCart();
  showToast('Item removed from cart', 'ok');
}

/* ── PLACE ORDER ────────────────────────────────────────────── */
async function handlePlaceOrder() {
  const address = document.getElementById('delivery-address')?.value.trim() || '';
  const phone   = document.getElementById('phone')?.value.trim()            || '';
  const notes   = document.getElementById('order-notes')?.value.trim()      || '';
  const btn     = document.getElementById('place-btn');

if (needsAddress && !address) {
  showToast('Please enter a delivery address for physical books', 'err');
  return;
}

  btn.classList.add('loading');
  btn.disabled = true;

  // Use cart_id from first item if backend provides it, else default to 1
  const cartId   = cartItems[0]?.cart_id ?? 1;
  const orderInfo = { address, phone, notes };

  try {
    await apiPlaceOrder(cartId, orderInfo);
    showToast('Order placed successfully! 🎉', 'ok');
    setTimeout(() => window.location.href = 'orders.html', 1500);
  } catch (err) {
    showToast(err.message, 'err');
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

/* ── INIT ───────────────────────────────────────────────────── */
initNav();
window.addEventListener('DOMContentLoaded', () => loadCart());