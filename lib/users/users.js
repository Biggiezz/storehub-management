/**
 * ==========================================================================
 * StoreHub Management - Users Controller (Quản lý Người dùng)
 * ==========================================================================
 */

// Auth guard
const auth = (typeof checkAuth === 'function') ? checkAuth() : null;
const token = auth ? auth.token : (getAuthToken ? getAuthToken() : localStorage.getItem('admin_token'));
const baseUrl = (typeof API_BASE !== 'undefined') ? API_BASE : 'http://localhost:3000';

// State
let currentPage = 1;
const PAGE_LIMIT = 10;
let currentType = ''; // '' = all, 'customer', 'staff'
let searchQuery = '';
let searchTimeout = null;

// DOM refs
const tbody = document.getElementById('usersTableBody');
const paginationInfo = document.getElementById('paginationInfo');
const paginationControls = document.getElementById('paginationControls');
const searchInput = document.getElementById('searchInput');
const tabBar = document.getElementById('tabBar');

// Stat elements
const statCustomers = document.getElementById('statCustomers');
const statStaff = document.getElementById('statStaff');

const tabCountAll = document.getElementById('tabCountAll');
const tabCountCustomer = document.getElementById('tabCountCustomer');
const tabCountStaff = document.getElementById('tabCountStaff');

// ============================
// Skeleton loading
// ============================
function showTableSkeleton(rows = 5) {
  if (!tbody) return;
  tbody.innerHTML = Array(rows).fill(0).map(() => `
    <tr>
      <td>
        <div class="user-cell">
          <span class="skeleton-box" style="width:36px;height:36px;border-radius:50%;"></span>
          <div>
            <span class="skeleton-box" style="width:120px;height:14px;display:block;margin-bottom:4px;"></span>
            <span class="skeleton-box" style="width:160px;height:12px;display:block;"></span>
          </div>
        </div>
      </td>
      <td><span class="skeleton-box" style="width:90px;height:16px;"></span></td>
      <td><span class="skeleton-box" style="width:70px;height:20px;border-radius:9999px;"></span></td>
      <td><span class="skeleton-box" style="width:65px;height:16px;"></span></td>
      <td><span class="skeleton-box" style="width:80px;height:16px;"></span></td>
      <td style="text-align:right;"><span class="skeleton-box" style="width:68px;height:30px;"></span></td>
    </tr>
  `).join('');
}

// ============================
// Role helpers
// ============================
const ADMIN_ROLES_SET = new Set(['admin', 'superadmin', 'quản lý cửa hàng', 'quản trị viên tối cao', 'quản trị viên']);

function getRoleBadge(role) {
  const r = (role || 'customer').toLowerCase();
  if (r === 'superadmin' || r === 'quản trị viên tối cao') {
    return '<span class="role-badge role-superadmin">Super Admin</span>';
  }
  if (ADMIN_ROLES_SET.has(r)) {
    return '<span class="role-badge role-admin">Quản trị viên</span>';
  }
  return '<span class="role-badge role-customer">Khách hàng</span>';
}

function formatLastActive(dateStr, isOnline = false) {
  if (!dateStr) return '<span style="color:var(--text-muted)">Chưa ghi nhận</span>';
  
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);

  // Chỉ xem là "Đang hoạt động" khi cờ isOnline là true VÀ có tương tác gần nhất trong vòng 5 phút
  if (isOnline && diff >= 0 && diff < 5 * 60 * 1000) {
    return '<span style="color:var(--success);font-weight:600;display:inline-flex;align-items:center;gap:6px;"><span style="width:7px;height:7px;background:var(--success);border-radius:50%;display:inline-block;"></span>Đang hoạt động</span>';
  }

  // Trường hợp đã off hoặc không hoạt động quá 5 phút: hiển thị thời gian tương đối
  if (mins < 1) return '<span style="color:var(--text-secondary);font-weight:500;">Vừa xong</span>';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return formatDate(dateStr);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getUserInitial(user) {
  return ((user.name || user.email || 'U').charAt(0)).toUpperCase();
}

// ============================
// Fetch users list
// ============================
async function fetchUsers() {
  showTableSkeleton();
  try {
    const params = new URLSearchParams({
      page: currentPage,
      limit: PAGE_LIMIT,
    });
    if (currentType) params.set('type', currentType);
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

    // Read header stats
    const totalStaffCount = parseInt(res.headers.get('X-Total-Staff')) || 0;
    const totalCustomerCount = parseInt(res.headers.get('X-Total-Customers')) || 0;

    // Update stat chips & tab counts
    if (statCustomers) statCustomers.textContent = totalCustomerCount;
    if (statStaff) statStaff.textContent = totalStaffCount;
    if (tabCountAll) tabCountAll.textContent = totalCustomerCount + totalStaffCount;
    if (tabCountCustomer) tabCountCustomer.textContent = totalCustomerCount;
    if (tabCountStaff) tabCountStaff.textContent = totalStaffCount;

    const json = await res.json();
    if (res.ok && json.data) {
      renderUsers(json.data, totalCustomerCount + totalStaffCount);

    } else {
      renderEmpty('Không thể tải danh sách người dùng.');
    }
  } catch (err) {
    console.error('Lỗi khi tải danh sách người dùng:', err);
    renderEmpty('Lỗi kết nối tới máy chủ.');
  }
}

// ============================
// Render table
// ============================
function renderUsers(users, total) {
  if (!tbody) return;

  if (!users || users.length === 0) {
    renderEmpty(searchQuery ? 'Không tìm thấy người dùng phù hợp.' : 'Chưa có người dùng nào.');
    renderPagination(0, 0);
    return;
  }

  const currUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  const userIsSuperAdmin = (typeof isSuperAdmin === 'function') ? isSuperAdmin() : false;

  tbody.innerHTML = users.map(u => {
    const avatarHtml = u.image
      ? `<img class="user-cell-avatar" src="${u.image}" alt="${u.name}" onerror="this.outerHTML='<div class=\\'user-cell-avatar\\'>${getUserInitial(u)}</div>'" />`
      : `<div class="user-cell-avatar">${getUserInitial(u)}</div>`;

    const isSelf = currUser && (currUser._id === u._id || currUser.id === u._id);
    // Đảm bảo hiển thị đúng nhãn tài khoản đang đăng nhập trên các tab
    const selfTag = isSelf ? ' <span style="font-size:0.6875rem;color:var(--primary);font-weight:600;">(Bạn)</span>' : '';

    const deleteBtnHtml = `
      <button class="btn-icon danger" title="Xóa" onclick="openDeleteModal('${u._id}', '${(u.name || '').replace(/'/g, "\\'")}')">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    `;

    return `
      <tr>
        <td>
          <div class="user-cell">
            ${avatarHtml}
            <div class="user-cell-info">
              <span class="user-cell-name">${u.name || '—'}${selfTag}</span>
              <span class="user-cell-email">${u.email || '—'}</span>
            </div>
          </div>
        </td>
        <td>${u.phone || '—'}</td>
        <td>${getRoleBadge(u.role)}</td>
        <td>${formatLastActive(u.lastActive, !!(u.isOnline || isSelf))}</td>
        <td>${formatDate(u.createdAt)}</td>
        <td>
          <div class="action-cell" style="justify-content:flex-end;">
            <button class="btn-icon" title="Chỉnh sửa" onclick="openEditModal('${u._id}')">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            ${deleteBtnHtml}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination(total, users.length);
}

function renderEmpty(msg) {
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="6">
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

// ============================
// Pagination
// ============================
function renderPagination(total, currentCount) {
  const totalPages = Math.ceil(total / PAGE_LIMIT) || 1;
  const start = (currentPage - 1) * PAGE_LIMIT + 1;
  const end = start + currentCount - 1;

  if (paginationInfo) {
    paginationInfo.textContent = total > 0
      ? `Hiển thị ${start}-${end > total ? total : end} trong tổng ${total} người dùng`
      : 'Không có dữ liệu';
  }

  if (!paginationControls) return;

  if (totalPages <= 1) {
    paginationControls.innerHTML = '';
    return;
  }

  let html = `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">&laquo;</button>`;

  // Show max 5 page buttons
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }

  html += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">&raquo;</button>`;

  paginationControls.innerHTML = html;
}

function goToPage(page) {
  currentPage = page;
  fetchUsers();
}

// ============================
// Tab switching
// ============================
if (tabBar) {
  tabBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    tabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentType = btn.dataset.type || '';
    currentPage = 1;
    fetchUsers();
  });
}

// ============================
// Search with debounce
// ============================
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

// ============================
// Add / Edit Modal
// ============================
const userModal = document.getElementById('userModal');
const modalTitle = document.getElementById('modalTitle');
const modalSkeleton = document.getElementById('modalSkeleton');
const userForm = document.getElementById('userForm');
const formUserId = document.getElementById('formUserId');
const formName = document.getElementById('formName');
const formEmail = document.getElementById('formEmail');
const formPhone = document.getElementById('formPhone');
const formRole = document.getElementById('formRole');
const roleHint = document.getElementById('roleHint');
const formPassword = document.getElementById('formPassword');
const formAddress = document.getElementById('formAddress');
const passwordHint = document.getElementById('passwordHint');
const modalSaveBtn = document.getElementById('modalSaveBtn');
const modalSaveText = document.getElementById('modalSaveText');
const modalSaveSpinner = document.getElementById('modalSaveSpinner');

function openModal() {
  if (userModal) userModal.style.display = 'flex';
}

function closeModal() {
  if (userModal) userModal.style.display = 'none';
  if (userForm) {
    userForm.reset();
    userForm.style.display = 'block';
  }
  if (modalSkeleton) modalSkeleton.style.display = 'none';
  if (formUserId) formUserId.value = '';
  if (formEmail) formEmail.removeAttribute('readonly');
  if (formRole) formRole.disabled = false;
  if (roleHint) roleHint.style.display = 'none';
  if (modalSaveBtn) modalSaveBtn.disabled = false;
}

// Add new
document.getElementById('btnAddUser')?.addEventListener('click', () => {
  closeModal(); // reset form
  if (modalTitle) modalTitle.textContent = 'Thêm người dùng mới';
  if (passwordHint) passwordHint.style.display = 'none';
  if (formPassword) formPassword.required = true;
  if (formEmail) formEmail.removeAttribute('readonly');
  if (formRole) formRole.disabled = false;
  if (roleHint) roleHint.style.display = 'none';
  if (modalSkeleton) modalSkeleton.style.display = 'none';
  if (userForm) userForm.style.display = 'block';
  if (modalSaveBtn) modalSaveBtn.disabled = false;
  openModal();
});

// Edit existing
async function openEditModal(userId) {
  closeModal();
  if (modalTitle) modalTitle.textContent = 'Chỉnh sửa người dùng';
  if (passwordHint) passwordHint.style.display = 'block';
  if (formPassword) formPassword.required = false;



  // Lazy load: Hiển thị skeleton placeholder trong dialog khi đang tải dữ liệu
  if (modalSkeleton) modalSkeleton.style.display = 'block';
  if (userForm) userForm.style.display = 'none';
  if (modalSaveBtn) modalSaveBtn.disabled = true;

  openModal();

  try {
    const res = await fetch(`${baseUrl}/users/get-user-by-id/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const json = await res.json();
    if (res.ok && json.data) {
      const u = json.data;
      if (formUserId) formUserId.value = u._id;
      if (formName) formName.value = u.name || '';
      if (formEmail) {
        formEmail.value = u.email || '';
        formEmail.setAttribute('readonly', 'readonly');
      }
      if (formPhone) formPhone.value = u.phone || '';
      if (formRole) formRole.value = u.role || 'customer';
      if (formAddress) formAddress.value = u.address || '';

      // Tải xong dữ liệu -> Ẩn skeleton, hiển thị form
      if (modalSkeleton) modalSkeleton.style.display = 'none';
      if (userForm) userForm.style.display = 'block';
      if (modalSaveBtn) modalSaveBtn.disabled = false;
    } else {
      if (typeof showToast === 'function') showToast(json.message || 'Không thể tải thông tin người dùng.', 'error');
      closeModal();
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('Không thể tải thông tin người dùng.', 'error');
    closeModal();
  }
}

// Save (Create or Update)
modalSaveBtn?.addEventListener('click', async () => {
  const isEdit = !!(formUserId && formUserId.value);
  const name = formName?.value.trim();
  const email = formEmail?.value.trim();
  const phone = formPhone?.value.trim();
  const role = formRole?.value || 'customer';
  const password = formPassword?.value || '';
  const address = formAddress?.value.trim() || '';

  // Basic client validation
  if (!name || !email || !phone) {
    if (typeof showToast === 'function') showToast('Vui lòng điền đầy đủ thông tin bắt buộc.', 'warning');
    return;
  }

  if (!isEdit && !password) {
    if (typeof showToast === 'function') showToast('Vui lòng nhập mật khẩu cho người dùng mới.', 'warning');
    return;
  }

  // Show spinner
  if (modalSaveSpinner) modalSaveSpinner.style.display = 'inline-block';
  if (modalSaveText) modalSaveText.textContent = 'Đang lưu...';
  modalSaveBtn.disabled = true;

  try {
    const body = { name, email, phone, role, address };
    if (password) body.password = password;

    const url = isEdit
      ? `${baseUrl}/users/update-user/${formUserId.value}`
      : `${baseUrl}/users/add-user`;

    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const json = await res.json();
    if (res.ok) {
      if (typeof showToast === 'function') showToast(json.message || (isEdit ? 'Cập nhật thành công!' : 'Thêm người dùng thành công!'), 'success');
      closeModal();
      fetchUsers();
    } else {
      if (typeof showToast === 'function') showToast(json.message || 'Có lỗi xảy ra.', 'error');
    }
  } catch (err) {
    console.error('Lỗi khi lưu người dùng:', err);
    if (typeof showToast === 'function') showToast('Lỗi kết nối máy chủ.', 'error');
  } finally {
    if (modalSaveSpinner) modalSaveSpinner.style.display = 'none';
    if (modalSaveText) modalSaveText.textContent = 'Lưu';
    modalSaveBtn.disabled = false;
  }
});

// Close modal handlers
document.getElementById('modalCloseBtn')?.addEventListener('click', closeModal);
document.getElementById('modalCancelBtn')?.addEventListener('click', closeModal);
userModal?.addEventListener('click', (e) => {
  if (e.target === userModal) closeModal();
});

// ============================
// Delete Modal
// ============================
const deleteModal = document.getElementById('deleteModal');
const deleteUserName = document.getElementById('deleteUserName');
const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
let pendingDeleteId = null;

function openDeleteModal(userId, userName) {
  if (typeof isSuperAdmin === 'function' && !isSuperAdmin()) {
    if (typeof showToast === 'function') showToast('Chỉ Quản trị viên tối cao (Superadmin) mới có quyền xóa tài khoản.', 'warning');
    return;
  }
  pendingDeleteId = userId;
  if (deleteUserName) deleteUserName.textContent = userName;
  if (deleteModal) deleteModal.style.display = 'flex';
}

function closeDeleteModal() {
  pendingDeleteId = null;
  if (deleteModal) deleteModal.style.display = 'none';
}

deleteConfirmBtn?.addEventListener('click', async () => {
  if (!pendingDeleteId) return;

  if (typeof isSuperAdmin === 'function' && !isSuperAdmin()) {
    if (typeof showToast === 'function') showToast('Bạn không có quyền thực hiện thao tác này.', 'error');
    closeDeleteModal();
    return;
  }

  deleteConfirmBtn.disabled = true;
  deleteConfirmBtn.textContent = 'Đang xóa...';

  try {
    const res = await fetch(`${baseUrl}/users/delete-user/${pendingDeleteId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const json = await res.json();
    if (res.ok) {
      if (typeof showToast === 'function') showToast(json.message || 'Xóa thành công!', 'success');
      closeDeleteModal();
      fetchUsers();
    } else {
      if (typeof showToast === 'function') showToast(json.message || 'Không thể xóa người dùng.', 'error');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('Lỗi kết nối máy chủ.', 'error');
  } finally {
    deleteConfirmBtn.disabled = false;
    deleteConfirmBtn.textContent = 'Xóa người dùng';
  }
});

document.getElementById('deleteCloseBtn')?.addEventListener('click', closeDeleteModal);
document.getElementById('deleteCancelBtn')?.addEventListener('click', closeDeleteModal);
deleteModal?.addEventListener('click', (e) => {
  if (e.target === deleteModal) closeDeleteModal();
});

// ============================
// Init
// ============================
document.addEventListener('DOMContentLoaded', () => {
  fetchUsers();
});
