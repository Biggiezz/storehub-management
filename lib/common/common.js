/**
 * ==========================================================================
 * StoreHub Management - Common JavaScript Utilities & Auth Guards
 * ==========================================================================
 */

// 1. Tự động nhận diện Máy chủ API (Localhost vs Production Vercel)
const API_BASE = "https://storehub-server.vercel.app";

// Khóa lưu phiên đăng nhập
const STORAGE_KEY_TOKEN = "admin_token";
const STORAGE_KEY_USER = "admin_user";

/**
 * Lấy Bearer Token từ bộ nhớ (Ưu tiên localStorage, sau đó sessionStorage)
 * @returns {string|null}
 */
function getAuthToken() {
  return (
    localStorage.getItem(STORAGE_KEY_TOKEN) ||
    sessionStorage.getItem(STORAGE_KEY_TOKEN)
  );
}

/**
 * Lấy thông tin tài khoản người dùng đang đăng nhập
 * @returns {object|null}
 */
function getCurrentUser() {
  const userRaw =
    localStorage.getItem(STORAGE_KEY_USER) ||
    sessionStorage.getItem(STORAGE_KEY_USER);
  if (!userRaw) return null;
  try {
    return JSON.parse(userRaw);
  } catch (e) {
    return null;
  }
}

/**
 * Kiểm tra xem tài khoản hiện tại có phải là Super Admin không
 * @returns {boolean}
 */
function isSuperAdmin() {
  const user = getCurrentUser();
  if (!user || !user.role) return false;
  const role = user.role.trim().toLowerCase();
  return role === "superadmin" || role === "quản trị viên tối cao";
}

/**
 * Hàm Auth Guard: Kiểm tra phiên đăng nhập và quyền truy cập
 * Nếu chưa đăng nhập hoặc không đúng quyền -> Tự động chuyển hướng về trang Login
 * @param {Array<string>} allowedRoles Mặc định cho phép ['admin', 'superadmin']
 * @returns {{ token: string, user: object } | null}
 */
function checkAuth(
  allowedRoles = [
    "admin",
    "superadmin",
    "quản lý cửa hàng",
    "quản trị viên",
    "quản trị viên tối cao",
  ],
) {
  const token = getAuthToken();
  const user = getCurrentUser();

  const redirectToLogin = () => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
    sessionStorage.removeItem(STORAGE_KEY_TOKEN);
    sessionStorage.removeItem(STORAGE_KEY_USER);

    // Tính đường dẫn tương đối tới login.html
    const isInsideSubdir = window.location.pathname.includes("/lib/");
    const loginUrl = isInsideSubdir
      ? "../login/login.html"
      : "login/login.html";
    window.location.href = loginUrl;
  };

  if (!token || !user || !user.role) {
    redirectToLogin();
    return null;
  }

  const userRole = user.role.trim().toLowerCase();
  const normalizedAllowed = allowedRoles.map((r) => r.trim().toLowerCase());

  if (!normalizedAllowed.includes(userRole)) {
    alert(
      `Quyền truy cập bị từ chối: Tài khoản của bạn (${user.role}) không được phép truy cập trang này.`,
    );
    redirectToLogin();
    return null;
  }

  return { token, user };
}

/**
 * Xử lý Đăng xuất an toàn khỏi hệ thống
 */
function logout() {
  if (
    confirm("Bạn có chắc chắn muốn đăng xuất khỏi trang quản trị StoreHub?")
  ) {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
    sessionStorage.removeItem(STORAGE_KEY_TOKEN);
    sessionStorage.removeItem(STORAGE_KEY_USER);

    const isInsideSubdir = window.location.pathname.includes("/lib/");
    const loginUrl = isInsideSubdir
      ? "../login/login.html"
      : "login/login.html";
    window.location.href = loginUrl;
  }
}

/**
 * Format số sang định dạng tiền tệ VND (Ví dụ: 150000 -> "150.000 ₫")
 * @param {number|string} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  const num = Number(amount);
  if (isNaN(num) || amount === null || amount === undefined) return "0 ₫";
  return new Intl.NumberFormat("vi-VN").format(num) + " ₫";
}

/**
 * Hiển thị thông báo Toast góc trên bên phải màn hình
 * @param {string} message Nội dung thông báo
 * @param {'success'|'error'|'warning'|'info'} type Loại thông báo
 * @param {number} duration Thời gian hiển thị (mili-giây)
 */
function showToast(message, type = "info", duration = 3500) {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    document.body.appendChild(container);
  }

  const icons = {
    success: `<svg class="toast-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    error: `<svg class="toast-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    warning: `<svg class="toast-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
    info: `<svg class="toast-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  };

  const toastItem = document.createElement("div");
  toastItem.className = `toast-item toast-${type}`;
  toastItem.innerHTML = `
    ${icons[type] || icons.info}
    <div class="toast-content">${message}</div>
    <button class="toast-close" title="Đóng">&times;</button>
  `;

  const closeBtn = toastItem.querySelector(".toast-close");
  const removeToast = () => {
    toastItem.classList.add("toast-hiding");
    setTimeout(() => {
      if (toastItem.parentNode) toastItem.parentNode.removeChild(toastItem);
    }, 200);
  };

  if (closeBtn) closeBtn.addEventListener("click", removeToast);
  container.appendChild(toastItem);

  if (duration > 0) {
    setTimeout(removeToast, duration);
  }
}

/**
 * Tự động tạo và gắn Topbar/Navbar chuẩn StoreHub vào phần tử mục tiêu
 * @param {string} activeTab Tab đang mở: 'dashboard' | 'orders' | 'products' | 'users' | 'news' | 'analytics'
 * @param {string} targetElementId ID phần tử chứa navbar (Mặc định: 'appNavbar')
 */
function renderNavbar(activeTab = "", targetElementId = "appNavbar") {
  const container = document.getElementById(targetElementId);
  if (!container) return;

  const user = getCurrentUser() || { name: "Admin", role: "admin" };
  const initial = (user.name || user.email || "A").charAt(0).toUpperCase();
  const roleName = isSuperAdmin() ? "Quản trị cấp cao" : "Quản trị viên";

  container.className = "topbar";
  container.innerHTML = `
    <div style="display:flex; align-items:center;">
      <a href="../dashboard/dashboard.html" class="brand-section">
        <div class="brand-logo">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <span class="brand-text">StoreHub</span>
        <span class="brand-tag">Quản trị</span>
      </a>

      <nav class="topbar-nav">
        <a href="../dashboard/dashboard.html" class="nav-link-item ${activeTab === "dashboard" ? "active" : ""}">Trang chủ</a>
        <a href="../orders/orders.html" class="nav-link-item ${activeTab === "orders" ? "active" : ""}">Đơn hàng</a>
        <a href="../products/products.html" class="nav-link-item ${activeTab === "products" ? "active" : ""}">Sản phẩm</a>
        <a href="../users/customers.html" class="nav-link-item ${activeTab === "users" ? "active" : ""}">Khách hàng</a>
        <a href="../news/news.html" class="nav-link-item ${activeTab === "news" ? "active" : ""}">Bài viết</a>
      </nav>
    </div>

    <div class="topbar-actions">
      <div class="user-pill" id="userPill">
        <div class="user-avatar" id="avatarText">${initial}</div>
        <div class="user-info">
          <span class="user-name" id="adminName">${user.name || user.email}</span>
          <span class="user-role-badge" id="adminRole">${roleName}</span>
        </div>
      </div>
      <button class="btn-header btn-logout" id="btnLogout" title="Đăng xuất">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        <span>Đăng xuất</span>
      </button>
    </div>
  `;

  // Gắn sự kiện nút Đăng xuất
  const btnLogout = container.querySelector("#btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", logout);
  }
}

/**
 * Helper hàm gọi API có sẵn Bearer Token và xử lý lỗi 401 tự động
 * @param {string} endpoint Đường dẫn API (ví dụ: '/api/productsRouter/get-all-product')
 * @param {object} options Các tùy chọn fetch thông thường
 * @returns {Promise<any>}
 */
async function fetchWithAuth(endpoint, options = {}) {
  const token = getAuthToken();
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers = {
    ...(options.headers || null),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Nếu body là Object (không phải FormData), gán header json
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      showToast("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.", "error");
      setTimeout(logout, 1500);
      throw new Error("Unauthorized");
    }
    return res;
  } catch (err) {
    console.error(`[API Error] ${endpoint}:`, err);
    throw err;
  }
}

// Khởi chạy khi tài liệu nạp xong: Kiểm tra auth và tự động mount Navbar nếu có #appNavbar
document.addEventListener("DOMContentLoaded", () => {
  const navbarEl = document.getElementById("appNavbar");
  if (navbarEl) {
    const activeTab = navbarEl.getAttribute("data-active") || "";
    renderNavbar(activeTab, "appNavbar");
  }
});
