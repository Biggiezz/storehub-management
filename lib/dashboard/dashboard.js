// Cấu hình máy chủ API
const API_BASE = (window.location.protocol === 'https:' || window.location.hostname !== 'localhost')
  ? 'https://storehub-server.vercel.app'
  : 'http://localhost:3000';

// Kiểm tra quyền truy cập (Auth Guard)
const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
const userRaw = localStorage.getItem('admin_user') || sessionStorage.getItem('admin_user');

if (!token || !userRaw) {
  window.location.href = '../login/login.html';
}

let currentUser = null;
try {
  currentUser = JSON.parse(userRaw);
} catch (e) {
  window.location.href = '../login/login.html';
}

if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
  sessionStorage.removeItem('admin_token');
  sessionStorage.removeItem('admin_user');
  window.location.href = '../login/login.html';
}

// Cập nhật thông tin admin lên Topbar
const adminName = document.getElementById('adminName');
const adminRole = document.getElementById('adminRole');
const avatarText = document.getElementById('avatarText');
const serverStatusText = document.getElementById('serverStatusText');

if (adminName) adminName.textContent = currentUser.name || currentUser.email;
if (adminRole) {
  adminRole.textContent = currentUser.role === 'superadmin' ? 'Quản trị cấp cao' : 'Quản trị viên';
}
if (avatarText) {
  const initial = (currentUser.name || currentUser.email || 'A').charAt(0).toUpperCase();
  avatarText.textContent = initial;
}

// Xử lý Đăng xuất
const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
  btnLogout.addEventListener('click', () => {
    if (confirm('Bạn có chắc chắn muốn đăng xuất khỏi trang quản trị StoreHub?')) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      sessionStorage.removeItem('admin_token');
      sessionStorage.removeItem('admin_user');
      window.location.href = '../login/login.html';
    }
  });
}

// Format tiền tệ VND
function formatCurrency(amount) {
  if (isNaN(amount) || amount === null) return '0 ₫';
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

// Helper badge trạng thái đơn hàng
function getStatusBadge(status) {
  const normalized = (status || '').toLowerCase();
  let badgeClass = 'status-pending';

  if (normalized.includes('hoàn thành') || normalized.includes('đã giao')) {
    badgeClass = 'status-completed';
  } else if (normalized.includes('đang giao') || normalized.includes('vận chuyển') || normalized.includes('đang xử lý')) {
    badgeClass = 'status-shipping';
  } else if (normalized.includes('hủy') || normalized.includes('khiếu nại')) {
    badgeClass = 'status-cancelled';
  }

  return `<span class="status-badge ${badgeClass}">${status || 'Chờ xác nhận'}</span>`;
}

// Lấy dữ liệu thống kê từ API (/users/admin/dashboard)
async function fetchDashboardStats() {
  const valSales = document.getElementById('valSales');
  const statusSales = document.getElementById('statusSales');
  const valUsers = document.getElementById('valUsers');
  const statusUsers = document.getElementById('statusUsers');
  const valProducts = document.getElementById('valProducts');
  const statusProducts = document.getElementById('statusProducts');
  const valOrders = document.getElementById('valOrders');
  const statusOrders = document.getElementById('statusOrders');

  try {
    const res = await fetch(`${API_BASE}/users/admin/dashboard`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (res.status === 401 || res.status === 403) {
      alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      window.location.href = '../login/login.html';
      return;
    }

    const json = await res.json();
    if (res.ok && json.data) {
      const data = json.data;
      if (valSales) valSales.textContent = formatCurrency(data.totalSales);
      if (statusSales) statusSales.innerHTML = `<span>Đã bán ${data.totalSalesCount || 0} sản phẩm</span>`;

      if (valUsers) valUsers.textContent = data.totalUsers || 0;
      if (statusUsers) statusUsers.innerHTML = `<span>Tổng số khách hàng: ${data.totalUsers || 0}</span>`;

      if (valProducts) valProducts.textContent = data.totalProducts || 0;
      if (statusProducts) statusProducts.innerHTML = `<span>${data.productsStatus || 'Đang kinh doanh'}</span>`;

      if (valOrders) valOrders.textContent = `${data.totalOrders || 0} đơn`;
      if (statusOrders) statusOrders.innerHTML = `<span>${data.pendingOrders || 0} đơn đang chờ xác nhận</span>`;

      if (serverStatusText) {
        serverStatusText.textContent = 'Hoạt động tốt';
        serverStatusText.style.color = 'var(--success)';
      }
    }
  } catch (error) {
    console.error('Lỗi khi tải thống kê dashboard:', error);
    if (serverStatusText) {
      serverStatusText.textContent = 'Mất kết nối máy chủ';
      serverStatusText.style.color = 'var(--danger)';
    }
  }
}

// Lấy danh sách 5 đơn hàng mới nhất (/api/oderRouter/admin/orders)
async function fetchRecentOrders() {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/api/oderRouter/admin/orders?page=1&limit=5`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (res.ok) {
      const json = await res.json();
      const orders = json.data || [];

      if (orders.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
              Chưa có đơn hàng nào được ghi nhận.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = orders.map(order => {
        const orderCode = order._id ? '#' + order._id.slice(-6).toUpperCase() : '#ĐƠN';
        const customerName = order.user?.name || order.shippingAddress?.fullName || 'Khách vãng lai';
        const total = formatCurrency(order.totalPrice || order.totalAmount || 0);
        const statusHtml = getStatusBadge(order.status);

        return `
          <tr>
            <td style="font-weight:600; color:var(--primary);">${orderCode}</td>
            <td>${customerName}</td>
            <td style="font-weight:600;">${total}</td>
            <td>${statusHtml}</td>
          </tr>
        `;
      }).join('');
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
            Không thể tải danh sách đơn hàng (${res.status}).
          </td>
        </tr>
      `;
    }
  } catch (error) {
    console.error('Lỗi khi tải đơn hàng:', error);
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--danger); padding: 1.5rem;">
          Lỗi kết nối tới máy chủ khi lấy đơn hàng.
        </td>
      </tr>
    `;
  }
}

// Nút làm mới
const btnRefresh = document.getElementById('btnRefresh');
if (btnRefresh) {
  btnRefresh.addEventListener('click', async () => {
    btnRefresh.disabled = true;
    btnRefresh.textContent = 'Đang tải...';
    await Promise.all([fetchDashboardStats(), fetchRecentOrders()]);
    btnRefresh.textContent = 'Làm mới';
    btnRefresh.disabled = false;
  });
}

// Khởi chạy khi load trang
document.addEventListener('DOMContentLoaded', () => {
  fetchDashboardStats();
  fetchRecentOrders();
});
