/**
 * StoreHub Management - Users Controller
 */

const auth = (typeof checkAuth === 'function') ? checkAuth() : null;
const token = auth ? auth.token : (getAuthToken ? getAuthToken() : localStorage.getItem('admin_token'));
const baseUrl = (typeof API_BASE !== 'undefined') ? API_BASE : 'http://localhost:3000';

let currentPage = 1;
const PAGE_LIMIT = 10;
let searchQuery = '';
let searchTimeout = null;

const tbody = document.getElementById('usersTableBody');
const paginationInfo = document.getElementById('paginationInfo');
const paginationControls = document.getElementById('paginationControls');
const searchInput = document.getElementById('searchInput');

function showTableSkeleton(rows = 5) {
  if (!tbody) return;
  tbody.innerHTML = Array(rows).fill(0).map(() => `
    <tr>
      <td>
        <div class="user-cell">
          <span class="skeleton-box" style="width:38px;height:38px;border-radius:50%;"></span>
          <div>
            <span class="skeleton-box" style="width:120px;height:14px;display:block;margin-bottom:4px;"></span>
            <span class="skeleton-box" style="width:160px;height:12px;display:block;"></span>
          </div>
        </div>
      </td>
      <td><span class="skeleton-box" style="width:90px;height:16px;"></span></td>
      <td><span class="skeleton-box" style="width:70px;height:20px;border-radius:9999px;"></span></td>
      <td><span class="skeleton-box" style="width:80px;height:16px;"></span></td>
      <td style="text-align:right;"><span class="skeleton-box" style="width:68px;height:30px;"></span></td>
    </tr>
  `).join('');
}

function getRoleBadge(role) {
  const r = (role || '').trim().toLowerCase();
  if (r === 'superadmin' || r === 'quản trị viên tối cao') {
    return '<span class="role-badge role-superadmin">Quản trị viên tối cao</span>';
  }
  if (r === 'admin' || r === 'quản trị viên' || r === 'quản lý cửa hàng') {
    return '<span class="role-badge role-admin">Quản trị viên</span>';
  }
  return '<span class="role-badge role-customer">Khách hàng</span>';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getUserInitial(user) {
  return ((user.name || user.email || 'U').charAt(0)).toUpperCase();
}

async function fetchUsers() {
  showTableSkeleton();
  try {
    const params = new URLSearchParams({
      page: currentPage,
      limit: PAGE_LIMIT,
    });
    if (searchQuery) params.set('search', searchQuery);

    const res = await fetch(`${baseUrl}/users/get-all-users?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (res.status === 401 || res.status === 403) {
      if (typeof showToast === 'function') showToast('Phiên đăng nhập hết hạn!', 'error');
      if (typeof logout === 'function') logout();
      return;
    }

    const json = await res.json();
    if (res.ok && json.data) {
      renderUsers(json.data, json.data.length);
    } else {
      renderEmpty('Không thể tải danh sách người dùng.');
    }
  } catch (err) {
    console.error('Lỗi khi tải danh sách người dùng:', err);
    renderEmpty('Lỗi kết nối tới máy chủ.');
  }
}

function renderUsers(users, total) {
  if (!tbody) return;

  if (!users || users.length === 0) {
    renderEmpty(searchQuery ? 'Không tìm thấy người dùng phù hợp.' : 'Chưa có người dùng nào.');
    renderPagination(0, 0);
    return;
  }

  tbody.innerHTML = users.map(u => {
    const avatarHtml = u.image
      ? `<img class="user-cell-avatar" src="${u.image}" alt="${u.name}" onerror="this.outerHTML='<div class=\'user-cell-avatar\'>${getUserInitial(u)}</div>'" />`
      : `<div class="user-cell-avatar">${getUserInitial(u)}</div>`;

    return `
      <tr>
        <td>
          <div class="user-cell">
            ${avatarHtml}
            <div class="user-cell-info">
              <span class="user-cell-name">${u.name || '—'}</span>
              <span class="user-cell-email">${u.email || '—'}</span>
            </div>
          </div>
        </td>
        <td>${u.phone || '—'}</td>
        <td>${getRoleBadge(u.role)}</td>
        <td>${formatDate(u.createdAt)}</td>
        <td style="text-align:right;">—</td>
      </tr>
    `;
  }).join('');

  renderPagination(total, users.length);
}

function renderEmpty(msg) {
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="5">
        <div class="empty-state">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p>${msg}</p>
        </div>
      </td>
    </tr>
  `;
}

function renderPagination(total, count) {
  if (!paginationInfo) return;
  const start = total === 0 ? 0 : (currentPage - 1) * PAGE_LIMIT + 1;
  const end = Math.min(currentPage * PAGE_LIMIT, total);
  paginationInfo.textContent = `Hiển thị ${start} - ${end} trong tổng số ${total} người dùng`;

  if (!paginationControls) return;
  const totalPages = Math.ceil(total / PAGE_LIMIT) || 1;
  let buttons = '';
  buttons += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">&laquo;</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      buttons += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      buttons += `<span style="padding:0 4px;align-self:center;">...</span>`;
    }
  }
  buttons += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">&raquo;</button>`;
  paginationControls.innerHTML = buttons;
}

window.changePage = function(page) {
  currentPage = page;
  fetchUsers();
};

if (searchInput) {
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchQuery = searchInput.value.trim();
      currentPage = 1;
      fetchUsers();
    }, 400);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  fetchUsers();
});
