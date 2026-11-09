/* ==================================================================
   ReliefRoute - frontend logic (vanilla JS, fetch API)
   ================================================================== */

const API = '';

const USER_KEY = 'reliefroute_user';

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function showAlert(el, message, type = 'error') {
  if (!el) return;
  el.hidden = false;
  el.className = `alert alert-${type}`;
  el.textContent = message;
}

function hideAlert(el) {
  if (!el) return;
  el.hidden = true;
  el.textContent = '';
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    data = { message: 'Unexpected server response' };
  }

  if (!res.ok) {
    const err = new Error(data.message || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch (_) {
    return null;
  }
}

function setSession(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(USER_KEY);
}

// ------------------------------------------------------------------
// Navbar (resources page)
// ------------------------------------------------------------------
function renderNavUser() {
  const user = getSession();
  const navUser = document.getElementById('nav-user');
  const loginLink = document.getElementById('login-link');
  if (!navUser) return;

  if (user) {
    navUser.hidden = false;
    if (loginLink) loginLink.hidden = true;
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-role').textContent = user.role;
    document.getElementById('user-avatar').textContent = (user.name || '?').charAt(0).toUpperCase();
  } else {
    navUser.hidden = true;
    if (loginLink) loginLink.hidden = false;
  }
}

// ------------------------------------------------------------------
// Auth page: register + login
// ------------------------------------------------------------------
function initAuthPage() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  if (!loginForm || !registerForm) return;

  // Already signed in? Skip straight to the inventory.
  if (getSession()) {
    window.location.replace('resources.html');
    return;
  }

  const loginAlert = document.getElementById('login-alert');
  const registerAlert = document.getElementById('register-alert');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(loginAlert);
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(formData(loginForm)),
      });
      setSession(data.user);
      showAlert(loginAlert, 'Login successful, redirecting…', 'success');
      window.location.href = 'resources.html';
    } catch (err) {
      showAlert(loginAlert, err.message);
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(registerAlert);
    try {
      const data = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(formData(registerForm)),
      });
      setSession(data.user);
      showAlert(registerAlert, 'Account created, redirecting…', 'success');
      window.location.href = 'resources.html';
    } catch (err) {
      showAlert(registerAlert, err.message);
    }
  });
}

// ------------------------------------------------------------------
// Inventory page: categories + resources
// ------------------------------------------------------------------
function statusBadge(status) {
  return `<span class="badge badge-${escapeHtml(status)}">${escapeHtml(status)}</span>`;
}

function renderResources(rows) {
  const body = document.getElementById('resources-body');
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">No resources yet — add the first one above.</td></tr>';
  } else {
    body.innerHTML = rows
      .map(
        (r) => `
      <tr>
        <td class="mono">${escapeHtml(r.id)}</td>
        <td>${escapeHtml(r.category_name || 'Uncategorised')}</td>
        <td class="strong">${escapeHtml(r.name)}</td>
        <td class="num">${escapeHtml(r.quantity)}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${escapeHtml(r.location)}</td>
      </tr>`
      )
      .join('');
  }

  const totalUnits = rows.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
  const available = rows.filter((r) => r.status === 'available').length;
  document.getElementById('stat-total').textContent = rows.length;
  document.getElementById('stat-available').textContent = available;
  document.getElementById('stat-units').textContent = totalUnits;
}

async function loadCategories() {
  const select = document.getElementById('category-select');
  if (!select) return;
  try {
    const categories = await api('/api/categories');
    select.innerHTML = categories.length
      ? categories
          .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
          .join('')
      : '<option value="">No categories found</option>';
  } catch (err) {
    select.innerHTML = '<option value="">Failed to load</option>';
    console.error(err);
  }
}

async function loadResources() {
  const body = document.getElementById('resources-body');
  try {
    const rows = await api('/api/resources');
    renderResources(rows);
  } catch (err) {
    if (body) body.innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

function initInventoryPage() {
  const form = document.getElementById('resource-form');
  if (!form) return;

  renderNavUser();
  loadCategories();
  loadResources();

  const alertBox = document.getElementById('resource-alert');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(alertBox);
    try {
      const payload = formData(form);
      payload.quantity = Number(payload.quantity);
      payload.category_id = Number(payload.category_id);

      await api('/api/resources', { method: 'POST', body: JSON.stringify(payload) });
      showAlert(alertBox, 'Resource added to inventory.', 'success');
      form.reset();
      form.querySelector('[name="quantity"]').value = 1;
      await loadResources();
    } catch (err) {
      showAlert(alertBox, err.message);
    }
  });

  document.getElementById('refresh-btn')?.addEventListener('click', loadResources);

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    clearSession();
    window.location.href = 'index.html';
  });
}

// ------------------------------------------------------------------
// Boot
// ------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initAuthPage();
  initInventoryPage();
});
