async function addBook() {
  const token = localStorage.getItem('folio_token') || localStorage.getItem('access_token');

  const res = await fetch('http://127.0.0.1:8000/<your-admin-book-route>', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      title: document.getElementById('title').value,
      isbn: document.getElementById('isbn').value,
      publisher: document.getElementById('publisher').value,
      price: Number(document.getElementById('price').value),
      quantity: Number(document.getElementById('quantity').value),
      type: document.getElementById('type').value,
      purchase_option: document.getElementById('purchase_option').value,
      format: document.getElementById('format').value,
      language: document.getElementById('language').value,
      edition: Number(document.getElementById('edition').value),
      category: document.getElementById('category').value,
      image_url: document.getElementById('image_url').value
    })
  });

  const data = await res.json();
  console.log(data);
}
async function loadAssignedTickets() {
  const token = localStorage.getItem('folio_token') || localStorage.getItem('access_token');

  const res = await fetch('http://127.0.0.1:8000/<your-assigned-tickets-route>', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await res.json();
  console.log(data);
}