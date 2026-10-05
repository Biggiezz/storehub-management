const API_BASE = (window.location.protocol === 'https:' || window.location.hostname !== 'localhost')
  ? 'https://storehub-server.vercel.app'
  : 'http://localhost:3000';

// Toggle hiện/ẩn mật khẩu
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
togglePasswordBtn.addEventListener('click', () => {
  const isPassword = passwordInput.getAttribute('type') === 'password';
  passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
});

// Xử lý thông báo
const alertBox = document.getElementById('alertBox');
function showAlert(message, type = 'error') {
  alertBox.textContent = message;
  alertBox.className = `alert alert-${type}`;
  alertBox.style.display = 'block';
}
function hideAlert() {
  alertBox.style.display = 'none';
  alertBox.textContent = '';
}

// Submit form đăng nhập
const loginForm = document.getElementById('loginForm');
const submitBtn = document.getElementById('submitBtn');
const spinner = document.getElementById('spinner');
const btnText = document.getElementById('btnText');

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  spinner.style.display = isLoading ? 'inline-block' : 'none';
  btnText.textContent = isLoading ? 'Đang xác thực...' : 'Đăng nhập';
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const rememberMe = document.getElementById('rememberMe').checked;

  if (!email || !password) {
    showAlert('Vui lòng nhập đầy đủ email và mật khẩu.');
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(`${API_BASE}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      showAlert(data?.message || `Lỗi máy chủ (${response.status})`, 'error');
      setLoading(false);
      return;
    }

    const user = data?.data;
    const role = user?.role?.toLowerCase();

    // Chỉ cho phép admin và superadmin
    if (role !== 'admin' && role !== 'superadmin') {
      showAlert(
        `Quyền truy cập bị từ chối: Tài khoản này (${user?.role || 'Khách hàng'}) không có quyền quản trị.`,
        'error'
      );
      setLoading(false);
      return;
    }

    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('admin_token', data.token);
    storage.setItem('admin_user', JSON.stringify(user));

    showAlert(`Đăng nhập thành công! Chào mừng ${user.name || user.email}.`, 'success');

    setTimeout(() => {
      if (window.location.pathname.endsWith('login.html')) {
        window.location.href = window.location.pathname.replace('login.html', 'dashboard.html');
      }
    }, 1000);

  } catch (err) {
    console.error('Login error:', err);
    showAlert('Không thể kết nối tới máy chủ. Vui lòng kiểm tra lại kết nối.', 'error');
  } finally {
    setLoading(false);
  }
});
