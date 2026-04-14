/* ================================================================
   api.js — Folio Backend API Layer
   Single source of truth for:
     • BASE_URL
     • Token management
     • Every fetch call to the FastAPI backend
     • Shared utilities (escHtml, toast, normaliseBooks)
   All other JS files import from here via <script> tag order.
================================================================ */

'use strict';

/* ── CONFIG ─────────────────────────────────────────────────── */
// Relative path — works via the Express proxy (server.js).
// Change to 'http://127.0.0.1:8000' only when bypassing the proxy directly.
const BASE_URL = '/api';

/* ── TOKEN MANAGEMENT ───────────────────────────────────────── */
const Auth = {
  getToken  : ()      => localStorage.getItem('folio_token'),
  setToken  : (t)     => localStorage.setItem('folio_token', t),
  clearToken: ()      => localStorage.removeItem('folio_token'),
  isLoggedIn: ()      => !!localStorage.getItem('folio_token'),
};

/* ── SHARED HEADERS ─────────────────────────────────────────── */
function jsonHeaders(requireAuth = false) {
  const h = { 'Content-Type': 'application/json' };
  const token = Auth.getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  else if (requireAuth) throw new Error('Not authenticated');
  return h;
}

/* ── RESPONSE HANDLER ───────────────────────────────────────── */
async function handleResponse(res) {
  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new Error(data.detail || `Error ${res.status}`);
  return data;
}

/* ── AUTH ENDPOINTS ─────────────────────────────────────────── */

/**
 * POST /register
 * @param {string} email
 * @param {string} password
 * @param {object} studentInfo  — optional { first_name, last_name, student_id }
 * @returns {{ access_token: string }}
 */
async function apiRegister(email, password, studentInfo = {}) {
  const res = await fetch(`${BASE_URL}/register`, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ email, password, student_info: studentInfo }),
  });
  const data = await handleResponse(res);
  console.log('LOGIN RESPONSE:', data);
  const token = typeof data.access_token === 'object' 
  ? JSON.stringify(data.access_token) 
  : data.access_token;
if (token) Auth.setToken(token);  // ← correct
  return data;
}

/**
 * POST /login
 * @param {string} email
 * @param {string} password
 * @returns {{ access_token: string }}
 */
async function apiLogin(email, password) {
  const res = await fetch(`${BASE_URL}/login`, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ email, password }),
  });
  const data = await handleResponse(res);
  console.log('LOGIN RESPONSE:', data);
  const token = typeof data.access_token === 'object' 
  ? JSON.stringify(data.access_token) 
  : data.access_token;
if (token) Auth.setToken(token);
  return data;
}

/* ── SEARCH ENDPOINT ────────────────────────────────────────── */

/**
 * GET /search_books
 * Matches backend: BookSearch from src.search_books.by_author_or_name
 * @param {string} query  — search term
 * @param {'all'|'author'|'title'} type
 * @returns {Array<Book>}
 */
async function apiSearchBooks(query, type = 'all') {
  let url;

  if (type === 'author') {
    url = `${BASE_URL}/search_books?author=${encodeURIComponent(query)}`;
  } else if (type === 'title') {
    url = `${BASE_URL}/search_books?name=${encodeURIComponent(query)}`;
  } else {
    url = `${BASE_URL}/search_books?q=${encodeURIComponent(query)}`;
  }

  const res = await fetch(url);
  const data = await res.json();

  console.log("RAW BACKEND:", data);

  // 🔥 CRITICAL FIX
  const books = data.books?.results;

  console.log("EXTRACTED BOOKS:", books);

  return Array.isArray(books) ? books : [];
}
/* ── CART ENDPOINTS ─────────────────────────────────────────── */

/**
 * GET /view_cart
 * @returns {Array<CartItem>}
 */
async function apiGetCart() {
  const res  = await fetch(`${BASE_URL}/view_cart`, {
    headers: jsonHeaders(true),
  });
  const data = await handleResponse(res);
  // Backend returns { cart_items: [...] } or plain array
  if (Array.isArray(data))            return data;
  if (Array.isArray(data.cart_items)) return data.cart_items;
  if (Array.isArray(data.items))      return data.items;
  return [];
}

/**
 * POST /add_to_cart?book_id=<id>&quantity=<qty>
 * @param {number|string} bookId
 * @param {number} quantity
 * @returns {object}
 */
async function apiAddToCart(bookId, quantity = 1) {
  const res = await fetch(
    `${BASE_URL}/add_to_cart?book_id=${encodeURIComponent(bookId)}&quantity=${quantity}`,
    {
      method : 'POST',
      headers: jsonHeaders(true),
    }
  );
  return handleResponse(res);
}

/* ── ORDER ENDPOINTS ────────────────────────────────────────── */

/**
 * POST /execute_order?cart_id=<id>
 * @param {number|string} cartId
 * @param {object} orderInfo  — { address, phone, notes }
 * @returns {object}
 */
async function apiPlaceOrder(cartId, orderInfo) {
  const res = await fetch(
    `${BASE_URL}/execute_order?cart_id=${encodeURIComponent(cartId)}`,
    {
      method : 'POST',
      headers: jsonHeaders(true),
      body   : JSON.stringify(orderInfo),
    }
  );
  return handleResponse(res);
}

/**
 * GET /view_orders
 * @returns {Array<Order>}
 */
async function apiGetOrders() {
  const res  = await fetch(`${BASE_URL}/view_orders`, {
    headers: jsonHeaders(true),
  });
  const data = await handleResponse(res);
  if (Array.isArray(data))        return data;
  if (Array.isArray(data.orders)) return data.orders;
  return [];
}

/* ── SHARED UTILITIES ───────────────────────────────────────── */

/**
 * Normalise ANY book response shape from the backend into a
 * consistent array of plain objects: { id, title, author, price, stock }
 *
 * Backend /search_books returns:
 *   {
 *     "books": {
 *       "book_ids": [2],
 *       "results": [
 *         [book_id, title, publisher/author, price, stock]
 *       ]
 *     }
 *   }
 *
 * Each row in results is a positional array:
 *   index 0 → book_id
 *   index 1 → title
 *   index 2 → author / publisher
 *   index 3 → price
 *   index 4 → stock / quantity
 */
function normaliseBooks(data) {
  // ── Shape 1: { books: { results: [[id, title, author, price, stock], ...] } }
  // This is the actual backend response shape (confirmed from Swagger)
  if (data && data.books && data.books.results && Array.isArray(data.books.results)) {
    return data.books.results.map(row => ({
      id    : row[0],
      title : row[1],
      author: row[2],
      price : row[3],
      stock : row[4],
    }));
  }

  // ── Shape 2: { results: [[...], ...] }  (flat wrapper)
  if (data && Array.isArray(data.results)) {
    const first = data.results[0];
    // If results contains arrays (positional rows), map them
    if (Array.isArray(first)) {
      return data.results.map(row => ({
        id    : row[0],
        title : row[1],
        author: row[2],
        price : row[3],
        stock : row[4],
      }));
    }
    // If results contains objects already, return as-is
    return data.results;
  }

  // ── Shape 3: { books: [...] }  — plain array of objects
  if (data && Array.isArray(data.books)) return data.books;

  // ── Shape 4: plain array of objects
  if (Array.isArray(data)) {
    const first = data[0];
    if (Array.isArray(first)) {
      // Array of positional arrays
      return data.map(row => ({
        id    : row[0],
        title : row[1],
        author: row[2],
        price : row[3],
        stock : row[4],
      }));
    }
    return data;
  }

  return [];
}

/** Escape HTML special characters to prevent XSS */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Show a toast notification */
let _toastTimer;
function showToast(msg, type = 'ok') {
  // Works with both id="toast" (search) and class="toast" (cart/orders)
  const el = document.getElementById('toast') || document.querySelector('.toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = `toast show ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/**
 * Update nav Sign In / Sign Out button state.
 * Looks for id="nav-auth-btn" on any page.
 */
function initNav() {
  const btn = document.getElementById('nav-auth-btn');
  if (!btn) return;
  if (Auth.isLoggedIn()) {
    btn.textContent = 'Sign Out';
    btn.href        = '#';
    btn.onclick     = e => {
      e.preventDefault();
      Auth.clearToken();
      window.location.href = 'index.html';
    };
  } else {
    btn.textContent = 'Sign In';
    btn.href        = 'login.html';
    btn.onclick     = null;
  }
}
async function addBook() {
  const token = localStorage.getItem("token");

  const res = await fetch("http://localhost:8000/admin/add-book", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({
      title: document.getElementById("title").value,
      isbn: document.getElementById("isbn").value,
      publisher: "test",
      price: 500,
      quantity: 10,
      type: "new",
      purchase_option: "buy",
      format: "hardcover",
      language: "English",
      edition: 1,
      category: "CS"
    })
  });

  const data = await res.json();
  console.log(data);
}
/** Book spine colour palette — deterministic by index */
const SPINE_COLORS = [
  '#b85c38', '#4a6fa5', '#2d4a3e', '#7a4f7d',
  '#5c4a3a', '#3d6b5e', '#8c3b2a', '#4a7c8e',
  '#6b5a4e', '#c47b3a', '#3a5c7a', '#856a44',
];