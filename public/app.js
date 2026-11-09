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
// Requests page: submit form + list + approve actions
// ------------------------------------------------------------------
async function loadUsersOptions() {
  const select = document.getElementById('request-user');
  if (!select) return;
  try {
    const users = await api('/api/users');
    select.innerHTML = users.length
      ? users
          .map(
            (u) =>
              `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)} (${escapeHtml(u.role)})</option>`
          )
          .join('')
      : '<option value="">No users found</option>';
  } catch (err) {
    select.innerHTML = '<option value="">Failed to load users</option>';
    console.error(err);
  }
}

async function loadCategoryOptions() {
  const select = document.getElementById('request-category');
  if (!select) return;
  try {
    const categories = await api('/api/categories');
    select.innerHTML = categories.length
      ? categories
          .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
          .join('')
      : '<option value="">No categories found</option>';
  } catch (err) {
    select.innerHTML = '<option value="">Failed to load categories</option>';
    console.error(err);
  }
}

function requestBadge(status) {
  return `<span class="badge badge-${escapeHtml(status)}">${escapeHtml(status)}</span>`;
}

function renderRequests(rows) {
  const body = document.getElementById('requests-body');
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="9" class="empty">No relief requests yet.</td></tr>';
  } else {
    body.innerHTML = rows
      .map(
        (r) => `
      <tr>
        <td class="num mono">${escapeHtml(r.id)}</td>
        <td>${escapeHtml(r.user_name || '—')}</td>
        <td class="num">${escapeHtml(r.user_role || '—')}</td>
        <td>${escapeHtml(r.category_name || 'Uncategorised')}</td>
        <td>${escapeHtml(r.location)}</td>
        <td class="num">${requestBadge(r.status)}</td>
        <td class="num">${escapeHtml(r.priority)}</td>
        <td>${escapeHtml(r.created_at)}</td>
        <td class="num actions">
          ${r.status === 'pending'
            ? `<button type="button" class="btn btn-sm btn-outline" data-action="approve" data-id="${escapeHtml(r.id)}">Approve</button>`
            : `<span class="badge badge-${escapeHtml(r.status)}">${escapeHtml(r.status)}</span>`}
        </td>
      </tr>`
      )
      .join('');
  }
}

async function loadRequests() {
  const body = document.getElementById('requests-body');
  try {
    const rows = await api('/api/requests');
    renderRequests(rows);
  } catch (err) {
    if (body) body.innerHTML = `<tr><td colspan="9" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

function initRequestsPage() {
  const form = document.getElementById('request-form');
  if (!form) return;

  renderNavUser();
  loadUsersOptions();
  loadCategoryOptions();
  loadRequests();

  const alertBox = document.getElementById('request-alert');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(alertBox);
    try {
      const payload = {
        requested_by_user_id: Number(form.elements.user_id.value),
        category_id: Number(form.elements.category_id.value),
        location: String(form.elements.location.value).trim(),
        priority: String(form.elements.priority.value),
        status: 'pending',
      };
      await api('/api/requests', { method: 'POST', body: JSON.stringify(payload) });
      showAlert(alertBox, 'Relief request submitted — awaiting approval.', 'success');
      form.reset();
      await loadRequests();
    } catch (err) {
      showAlert(alertBox, err.message);
    }
  });

  // Approve buttons via event delegation
  document.getElementById('requests-body')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="approve"]');
    if (!btn) return;
    const id = btn.dataset.id;
    try {
      await api(`/api/requests/${id}/approve`, { method: 'PUT' });
      await loadRequests();
    } catch (err) {
      showAlert(alertBox, err.message);
    }
  });

  document.getElementById('refresh-requests-btn')?.addEventListener('click', loadRequests);
}

// ------------------------------------------------------------------
// Dashboard page: aggregate metric cards
// ------------------------------------------------------------------
async function loadDashboardStats() {
  const statTotal = document.getElementById('stat-total-requests');
  const statInventory = document.getElementById('stat-inventory');
  const statDispatches = document.getElementById('stat-dispatches');
  const updated = document.getElementById('dashboard-updated');
  if (!statTotal) return;

  try {
    const stats = await api('/api/dashboard/stats');
    statTotal.textContent = Number(stats.total_requests || 0);
    statInventory.textContent = Number(stats.total_resources || 0);
    statDispatches.textContent = Number(stats.total_dispatched || 0);
    if (updated) updated.textContent = `Last refreshed: ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    if (updated) updated.textContent = `Failed to load stats: ${escapeHtml(err.message)}`;
    console.error(err);
  }
}

function initDashboardPage() {
  if (!document.getElementById('stat-total-requests')) return;

  renderNavUser();
  loadDashboardStats();

  document.getElementById('refresh-dashboard-btn')?.addEventListener('click', loadDashboardStats);
}

// ------------------------------------------------------------------
// Boot
// ------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initAuthPage();
  initInventoryPage();
  initRequestsPage();
  initDashboardPage();
});
