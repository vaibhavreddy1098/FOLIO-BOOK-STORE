/* ================================================================
   search.js — Browse / Search page logic
   Depends on: api.js (loaded first via <script> tag)
================================================================ */

'use strict';

/* ── PAGE STATE ─────────────────────────────────────────────── */
const state = {
  query   : '',
  type    : 'all',   // 'all' | 'author' | 'title'
  sort    : '',
  view    : 'grid',
  books   : [],      // raw results from last API call
  filtered: [],      // after client-side sort is applied
};

/* ── MOCK DATA (offline fallback) ───────────────────────────── */
const MOCK_BOOKS = [
  { id:1,  title:'The Midnight Library',     author:'Matt Haig',          price:349 },
  { id:2,  title:'Sapiens',                   author:'Yuval Noah Harari',  price:499 },
  { id:3,  title:'Atomic Habits',             author:'James Clear',        price:399 },
  { id:4,  title:'The Alchemist',             author:'Paulo Coelho',       price:299 },
  { id:5,  title:'1984',                       author:'George Orwell',      price:249 },
  { id:6,  title:'Dune',                       author:'Frank Herbert',      price:449 },
  { id:7,  title:'Thinking, Fast and Slow',   author:'Daniel Kahneman',    price:549 },
  { id:8,  title:'The Name of the Wind',      author:'Patrick Rothfuss',   price:399 },
  { id:9,  title:'A Brief History of Time',   author:'Stephen Hawking',    price:329 },
  { id:10, title:'The Psychology of Money',   author:'Morgan Housel',      price:379 },
  { id:11, title:'Crime and Punishment',      author:'Fyodor Dostoevsky',  price:279 },
  { id:12, title:'The Brothers Karamazov',    author:'Fyodor Dostoevsky',  price:319 },
];
// --- PUT THIS AT THE VERY TOP OF search.js ---
/* ── GLOBAL NAVIGATION ── */
window.navigateToDetails = function(id) {
    if (!id) return;
    window.location.href = `book_details.html?id=${id}`;
};
function getMockBooks(query, type) {
  if (!query) return MOCK_BOOKS;
  const q = query.toLowerCase();
  return MOCK_BOOKS.filter(b => {
    if (type === 'author') return b.author.toLowerCase().includes(q);
    if (type === 'title')  return b.title.toLowerCase().includes(q);
    return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
  });
}

/* ── SEARCH TYPE TOGGLE ─────────────────────────────────────── */
function setType(type) {
  state.type = type;
  ['all', 'author', 'title'].forEach(id => {
    document.getElementById(`type-${id}`)
      ?.classList.toggle('active', id === type);
  });
  // Update placeholder to hint the user
  const hints = {
    all   : 'Type a title, author name, or keyword…',
    author: 'Enter an author name…',
    title : 'Enter a book title…',
  };
  const input = document.getElementById('search-input');
  if (input) input.placeholder = hints[type];
}

/* ── VIEW TOGGLE (grid / list) — no re-fetch ────────────────── */
function setView(view) {
  state.view = view;
  document.getElementById('btn-grid')?.classList.toggle('active', view === 'grid');
  document.getElementById('btn-list')?.classList.toggle('active', view === 'list');
  // Update grid class then re-render cards with correct layout
  renderBooks(state.filtered);
}

/* ── CLIENT-SIDE FILTER & SORT ─────────────────────────────── */
/* ── THE MASTER FILTER & SORT FUNCTION ── */
function applyFiltersAndSort() {
  console.log("Applying filters...");

  // 1. Get all checked category values
  const checkedBoxes = document.querySelectorAll('.genre-filter:checked');
  const selectedCategories = Array.from(checkedBoxes).map(cb => cb.value.toUpperCase());
  
  console.log("Selected Categories:", selectedCategories);

  // 2. Filter from the raw data (state.books)
  let result = state.books.filter(book => {
    // If nothing is checked, show all books
    if (selectedCategories.length === 0) return true;
    
    // Ensure the book has a category before comparing
    if (!book.category) return false;
    
    return selectedCategories.includes(book.category.toUpperCase());
  });

  // 3. Apply Sorting from the dropdown
  const sortVal = document.getElementById('sort-select').value;
  state.sort = sortVal;

  if (sortVal === 'title_asc')  result.sort((a,b) => (a.title||'').localeCompare(b.title||''));
  if (sortVal === 'title_desc') result.sort((a,b) => (b.title||'').localeCompare(a.title||''));
  if (sortVal === 'price_asc')  result.sort((a,b) => (a.price||0) - (b.price||0));
  if (sortVal === 'price_desc') result.sort((a,b) => (b.price||0) - (a.price||0));

  // 4. Update the filtered state and RENDER
  state.filtered = result;
  console.log("Number of books after filter:", state.filtered.length);
  renderBooks(state.filtered);
}

/* ── UPDATE YOUR CLEAR FILTERS ── */
function clearFilters() {
  // Uncheck all boxes
  document.querySelectorAll('.genre-filter').forEach(c => c.checked = false);
  
  // Reset sort dropdown
  const sortDropdown = document.getElementById('sort-select');
  if (sortDropdown) sortDropdown.value = '';
  
  state.sort = '';
  state.filtered = [...state.books]; // Reset filtered list to full list
  renderBooks(state.filtered);
}
/* ── MAIN SEARCH — calls backend ────────────────────────────── */
async function doSearch() {
  const query   = document.getElementById('search-input')?.value.trim() || '';
  state.query   = query;

  showSkeletons();
  setResultsInfo('Searching…');

  try {
    const books = await apiSearchBooks(query, state.type);

    console.log("BOOKS AFTER API:", books); // 🔥 ADD THIS

    state.books    = books;
    state.filtered = books;

    console.log("STATE FILTERED:", state.filtered); // 🔥 ADD THIS

    applyFiltersAndSort(); // 🔥 CHANGED FROM sortBooks()

  } catch (err) {
    console.error(err);
  }
}
/* ── RENDER BOOKS ───────────────────────────────────────────── */
function renderBooks(books) {
  const grid = document.getElementById('books-grid');
  if (!grid) return;

  // Sync grid CSS class with current view
  grid.className = state.view === 'list' ? 'is-list' : '';

  // Results info bar
  const count = books.length;
  console.log("RENDER INPUT:", books);
  setResultsInfo(
    count === 0
      ? 'No results'
      : `<strong>${count}</strong> result${count !== 1 ? 's' : ''}` +
        (state.query ? ` for "<em>${escHtml(state.query)}</em>"` : '')
  );

  if (!count) {
    grid.innerHTML = `
      <div class="state-box">
        <div class="state-icon">📚</div>
        <div class="state-title">
          ${state.query ? `Nothing found for "${escHtml(state.query)}"` : 'No books to show'}
        </div>
        <div class="state-sub">Try a different search term or clear the filters</div>
      </div>`;
    return;
  }

  grid.innerHTML = books.map((book, i) => bookCardHTML(book, i)).join('');
}

/**
 * Generates the HTML for a book card in the search grid.
 * Fixes clickability using an anchor wrapper and restores condition/format badges.
 */
function bookCardHTML(book_data, index) {
    const book_id = book_data.book_id || book_data.id;
    const title_text = escHtml(book_data.title || 'Untitled');
    const author_name = escHtml(book_data.author || 'Unknown');
    const spine_color = SPINE_COLORS[index % SPINE_COLORS.length];
    
    // Logic to generate the tags/badges string
    const tags_html = [
        book_data.type ? `<span class="folio-tag ${book_data.type}">${book_data.type.toUpperCase()}</span>` : '',
        book_data.purchase_option ? `<span class="folio-tag ${book_data.purchase_option}">${book_data.purchase_option.toUpperCase()}</span>` : '',
        book_data.format ? `<span class="folio-tag format">${book_data.format.toUpperCase()}</span>` : ''
    ].filter(Boolean).join('');

    const rating_value = parseFloat(book_data.rating || 0);
    const rating_display = rating_value > 0 
        ? `<div class="rating-row">★ ${rating_value.toFixed(1)} (${book_data.review_count})</div>`
        : `<div class="rating-row" style="opacity:0.3">No reviews</div>`;

    return `
    <div class="book-card">
        <a href="book_details.html?id=${book_id}" class="card-main-link">
            <div class="book-spine" style="background:${spine_color};">
                <span class="book-spine-text">${title_text}</span>
            </div>
            
            <div class="book-body">
                <div class="book-title">${title_text}</div>
                ${rating_display}
                
                <div class="tag-row">
                    ${tags_html}
                </div>
                
                <div class="book-author">${author_name}</div>
                <div class="book-price">₹${book_data.price}</div>
            </div>
        </a>

        <div class="book-footer">
            <button class="add-cart-btn" 
                    onclick="event.preventDefault(); event.stopPropagation(); handleAddToCart(this)" 
                    data-id="${book_id}" 
                    data-title="${title_text}">
                Add to Cart
            </button>
        </div>
    </div>`;
}
// Function to handle the navigation
function navigateToDetails(id) {
    console.log("Navigating to book ID:", id);
    window.location.href = `book_details.html?id=${id}`;
}
/* ── ADD TO CART ────────────────────────────────────────────── */
async function handleAddToCart(btn) {
  if (!Auth.isLoggedIn()) {
    showToast('Sign in to add books to your cart', 'err');
    setTimeout(() => window.location.href = 'login.html', 1100);
    return;
  }

  const bookId = btn.dataset.id;
  const title  = btn.dataset.title;

  btn.disabled    = true;
  btn.textContent = '…';

  try {
    await apiAddToCart(bookId, 1);
    btn.textContent = '✓ Added';
    btn.classList.add('is-added');
    showToast(`"${title}" added to cart`, 'ok');
    setTimeout(() => {
      btn.textContent = 'Add to Cart';
      btn.classList.remove('is-added');
      btn.disabled = false;
    }, 2000);
  } catch (err) {
    btn.textContent = 'Add to Cart';
    btn.disabled    = false;
    showToast(err.message, 'err');
  }
}

/* ── UI HELPERS ─────────────────────────────────────────────── */
function showSkeletons() {
  const grid = document.getElementById('books-grid');
  if (!grid) return;
  grid.className = '';
  grid.innerHTML = Array.from({ length: 8 }, (_, i) => `
    <div class="skel" style="animation-delay:${i * 0.04}s">
      <div class="skel-cover"></div>
      <div class="skel-line"></div>
      <div class="skel-line half"></div>
    </div>`).join('');
}
async function addBook() {
  const token = localStorage.getItem("folio_token") || localStorage.getItem("access_token");

  const res = await fetch("http://127.0.0.1:8000/admin/add-book", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({
      title: document.getElementById("title").value,
      isbn: document.getElementById("isbn").value,
      publisher: "test",
      price: parseInt(document.getElementById("price").value),
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
  console.log("BOOK ADDED:", data);
  alert("Book Added!");
}

function setResultsInfo(html) {
  const el = document.getElementById('results-info');
  if (el) el.innerHTML = html;
}

/* ── INIT ───────────────────────────────────────────────────── */
initNav();

// Pre-fill query from URL ?q= param (from landing page hero search)
const _urlQ = new URLSearchParams(window.location.search).get('q') || '';
if (_urlQ) {
  const input = document.getElementById('search-input');
  if (input) input.value = _urlQ;
  state.query = _urlQ;
}

// Run initial search when DOM is ready
window.addEventListener('DOMContentLoaded', () => doSearch());

// Enter key triggers search
document.getElementById('search-input')
  ?.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
// Listen for clicks on the category checkboxes
// Add this right near the bottom of search.js, above document.addEventListener('DOMContentLoaded', ...)

document.addEventListener('change', e => {
  if (e.target.classList.contains('genre-filter') || e.target.id === 'sort-select') {
    applyFiltersAndSort();
  }
});