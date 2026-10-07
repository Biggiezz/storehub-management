/**
 * ==========================================================================
 * StoreHub Management - Dashboard Controller
 * ==========================================================================
 */

// 1. Kiểm tra quyền truy cập (Auth Guard qua common.js)
const auth = (typeof checkAuth === 'function') ? checkAuth() : null;
const token = auth ? auth.token : (getAuthToken ? getAuthToken() : localStorage.getItem('admin_token'));
const currentUser = auth ? auth.user : (getCurrentUser ? getCurrentUser() : null);

// Khóa lưu cache phiên làm việc (tương đương DataCache trong Android App)
const CACHE_KEY_DASHBOARD = 'storehub_admin_dashboard_cache';
const CACHE_KEY_ORDERS = 'storehub_admin_orders_cache';

const serverStatusText = document.getElementById('serverStatusText');

// Lấy base URL từ common.js hoặc fallback
const baseUrl = (typeof API_BASE !== 'undefined') ? API_BASE : 'http://localhost:3000';

// Hiệu ứng đếm số tăng dần (Count-Up Animation)
function animateCountUp(element, target, duration = 800, formatFn = null) {
  if (!element) return;
  const start = 0;
  const startTime = performance.now();

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * ease);

    element.textContent = formatFn ? formatFn(current) : current;

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      element.textContent = formatFn ? formatFn(target) : target;
    }
  }

  requestAnimationFrame(step);
}

// Helper badge trạng thái đơn hàng theo class common.css
function getStatusBadge(status) {
  const normalized = (status || '').toLowerCase();
  let badgeClass = 'badge-pending';

  if (normalized.includes('hoàn thành') || normalized.includes('đã giao')) {
    badgeClass = 'badge-completed';
  } else if (normalized.includes('đang giao') || normalized.includes('vận chuyển') || normalized.includes('đang xử lý') || normalized.includes('rời kho')) {
    badgeClass = 'badge-shipping';
  } else if (normalized.includes('xác nhận')) {
    badgeClass = 'badge-confirmed';
  } else if (normalized.includes('hủy')) {
    badgeClass = 'badge-cancelled';
  } else if (normalized.includes('khiếu nại')) {
    badgeClass = 'badge-disputed';
  }

  return `<span class="status-badge ${badgeClass}">${status || 'Chờ xác nhận'}</span>`;
}

// Hiển thị khung Skeleton Placeholder khi tải dữ liệu
function showSkeletonAll() {
  const valSales = document.getElementById('valSales');
  const statusSales = document.getElementById('statusSales');
  const valUsers = document.getElementById('valUsers');
  const statusUsers = document.getElementById('statusUsers');
  const valProducts = document.getElementById('valProducts');
  const statusProducts = document.getElementById('statusProducts');
  const valOrders = document.getElementById('valOrders');
  const statusOrders = document.getElementById('statusOrders');
  const tbody = document.getElementById('ordersTableBody');

  if (valSales) valSales.innerHTML = '<span class="skeleton-box" style="width: 140px; height: 26px;"></span>';
  if (statusSales) statusSales.innerHTML = '<span class="skeleton-box" style="width: 150px; height: 14px;"></span>';

  if (valUsers) valUsers.innerHTML = '<span class="skeleton-box" style="width: 70px; height: 26px;"></span>';
  if (statusUsers) statusUsers.innerHTML = '<span class="skeleton-box" style="width: 140px; height: 14px;"></span>';

  if (valProducts) valProducts.innerHTML = '<span class="skeleton-box" style="width: 70px; height: 26px;"></span>';
  if (statusProducts) statusProducts.innerHTML = '<span class="skeleton-box" style="width: 110px; height: 14px;"></span>';

  if (valOrders) valOrders.innerHTML = '<span class="skeleton-box" style="width: 80px; height: 26px;"></span>';
  if (statusOrders) statusOrders.innerHTML = '<span class="skeleton-box" style="width: 160px; height: 14px;"></span>';

  if (tbody) {
    tbody.innerHTML = Array(4).fill(0).map(() => `
      <tr>
        <td><span class="skeleton-box" style="width: 70px; height: 18px;"></span></td>
        <td><span class="skeleton-box" style="width: 130px; height: 18px;"></span></td>
        <td><span class="skeleton-box" style="width: 90px; height: 18px;"></span></td>
        <td><span class="skeleton-box" style="width: 80px; height: 22px; border-radius: 9999px;"></span></td>
      </tr>
    `).join('');
  }
}

// Render dữ liệu thống kê lên giao diện
function renderDashboardStats(data, withAnimation = true) {
  const valSales = document.getElementById('valSales');
  const statusSales = document.getElementById('statusSales');
  const valUsers = document.getElementById('valUsers');
  const statusUsers = document.getElementById('statusUsers');
  const valProducts = document.getElementById('valProducts');
  const statusProducts = document.getElementById('statusProducts');
  const valOrders = document.getElementById('valOrders');
  const statusOrders = document.getElementById('statusOrders');

  const currFormat = (typeof formatCurrency === 'function') ? formatCurrency : (val => val + ' ₫');

  if (withAnimation) {
    animateCountUp(valSales, data.totalSales || 0, 1000, currFormat);
    animateCountUp(valUsers, data.totalUsers || 0, 800);
    animateCountUp(valProducts, data.totalProducts || 0, 800);
    animateCountUp(valOrders, data.totalOrders || 0, 800, (n) => `${n} đơn`);
  } else {
    if (valSales) valSales.textContent = currFormat(data.totalSales || 0);
    if (valUsers) valUsers.textContent = data.totalUsers || 0;
    if (valProducts) valProducts.textContent = data.totalProducts || 0;
    if (valOrders) valOrders.textContent = `${data.totalOrders || 0} đơn`;
  }

  if (statusSales) statusSales.innerHTML = `<span>Đã bán ${data.totalSalesCount || 0} sản phẩm</span>`;
  if (statusUsers) statusUsers.innerHTML = `<span>Tổng số khách hàng: ${data.totalUsers || 0}</span>`;
  if (statusProducts) statusProducts.innerHTML = `<span>${data.productsStatus || 'Đang kinh doanh'}</span>`;
  if (statusOrders) statusOrders.innerHTML = `<span>${data.pendingOrders || 0} đơn đang chờ xác nhận</span>`;

  if (serverStatusText) {
    serverStatusText.textContent = 'Hoạt động tốt';
    serverStatusText.style.color = 'var(--success)';
  }
}

// Render danh sách đơn hàng gần đây
function renderRecentOrders(orders) {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  const currFormat = (typeof formatCurrency === 'function') ? formatCurrency : (val => val + ' ₫');

  if (!orders || orders.length === 0) {
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
    const total = currFormat(order.totalPrice || order.totalAmount || 0);
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
}

// Tải số liệu Dashboard từ API
async function fetchDashboardStats(isInitialWithCache = false) {
  try {
    const res = await fetch(`${baseUrl}/users/admin/dashboard`, {
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
      sessionStorage.setItem(CACHE_KEY_DASHBOARD, JSON.stringify(json.data));
      renderDashboardStats(json.data, !isInitialWithCache);
    }
  } catch (error) {
    console.error('Lỗi khi tải thống kê dashboard:', error);
    if (serverStatusText) {
      serverStatusText.textContent = 'Mất kết nối máy chủ';
      serverStatusText.style.color = 'var(--danger)';
    }
  }
}

// Tải danh sách đơn hàng gần đây từ API
async function fetchRecentOrders() {
  const tbody = document.getElementById('ordersTableBody');
  try {
    const res = await fetch(`${baseUrl}/api/oderRouter/admin/orders?page=1&limit=5`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (res.ok) {
      const json = await res.json();
      const orders = json.data || [];
      sessionStorage.setItem(CACHE_KEY_ORDERS, JSON.stringify(orders));
      renderRecentOrders(orders);
    } else {
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
              Không thể tải danh sách đơn hàng (${res.status}).
            </td>
          </tr>
        `;
      }
    }
  } catch (error) {
    console.error('Lỗi khi tải đơn hàng:', error);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--danger); padding: 1.5rem;">
            Lỗi kết nối tới máy chủ khi lấy đơn hàng.
          </td>
        </tr>
      `;
    }
  }
}

// Xử lý nạp dữ liệu với Lazy Load & Cache First (Stale-While-Revalidate)
async function loadDashboardData(forceRefresh = false) {
  const cachedDashRaw = sessionStorage.getItem(CACHE_KEY_DASHBOARD);
  const cachedOrdersRaw = sessionStorage.getItem(CACHE_KEY_ORDERS);

  let hasValidCache = false;

  if (!forceRefresh && cachedDashRaw && cachedOrdersRaw) {
    try {
      const cachedDash = JSON.parse(cachedDashRaw);
      const cachedOrders = JSON.parse(cachedOrdersRaw);
      renderDashboardStats(cachedDash, false);
      renderRecentOrders(cachedOrders);
      hasValidCache = true;
    } catch (e) {
      hasValidCache = false;
    }
  }

  if (!hasValidCache) {
    showSkeletonAll();
  }

  await Promise.all([
    fetchDashboardStats(hasValidCache),
    fetchRecentOrders()
  ]);
}

// Gắn sự kiện cho các nút Thao tác nhanh & Nút làm mới
function setupQuickActionListeners() {
  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      btnRefresh.disabled = true;
      btnRefresh.innerHTML = '<span>Đang tải...</span>';
      sessionStorage.removeItem(CACHE_KEY_DASHBOARD);
      sessionStorage.removeItem(CACHE_KEY_ORDERS);
      await loadDashboardData(true);
      btnRefresh.innerHTML = `
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Làm mới dữ liệu
      `;
      btnRefresh.disabled = false;
      if (typeof showToast === 'function') {
        showToast('Dữ liệu đã được cập nhật mới nhất!', 'success');
      }
    });
  }

  // Chuyển hướng tới các phân hệ khi bấm Thao tác nhanh
  const btnOrders = document.getElementById('btnActionOrders');
  const btnProducts = document.getElementById('btnActionProducts');
  const btnUsers = document.getElementById('btnActionUsers');
  const btnNews = document.getElementById('btnActionNews');

  if (btnOrders) {
    btnOrders.addEventListener('click', () => {
      window.location.href = '../orders/orders.html';
    });
  }
  if (btnProducts) {
    btnProducts.addEventListener('click', () => {
      window.location.href = '../products/products.html';
    });
  }
  if (btnUsers) {
    btnUsers.addEventListener('click', () => {
      window.location.href = '../users/customers.html';
    });
  }
  if (btnNews) {
    btnNews.addEventListener('click', () => {
      window.location.href = '../news/news.html';
    });
  }
}

// Khởi chạy khi tài liệu sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  setupQuickActionListeners();
  loadDashboardData();
});
