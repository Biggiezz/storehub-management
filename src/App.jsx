import { useEffect, useState } from "react";
import {
  API_BASE,
  U,
  request,
  getSession,
  setSession,
  isAdmin,
  isCanonicalAdmin,
} from "./api";
import { Field, Icon } from "./components/UI";
import Dashboard from "./pages/Dashboard";
import Catalog from "./pages/Catalog";
import Orders from "./pages/Orders";
import Settings from "./pages/Settings";
const navigation = [
  ["dashboard", "Tổng quan"],
  ["products", "Sản phẩm"],
  ["categories", "Danh mục"],
  ["orders", "Đơn hàng"],
  ["users", "Người dùng"],
  ["news", "Tin tức"],
  ["settings", "Cài đặt"],
];
function initialPage() {
  const page = window.location.hash.slice(1);
  return navigation.some(([key]) => key === page) ? page : "dashboard";
}
export default function App() {
  const [session, updateSession] = useState(getSession),
    [page, setPage] = useState(initialPage),
    [menu, setMenu] = useState(false),
    [toast, setToast] = useState("");
  useEffect(() => {
    const expired = () => {
      updateSession(null);
      setToast("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    };
    const hash = () => setPage(initialPage());
    window.addEventListener("session-expired", expired);
    window.addEventListener("hashchange", hash);
    return () => {
      window.removeEventListener("session-expired", expired);
      window.removeEventListener("hashchange", hash);
    };
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 5500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  function navigate(key) {
    window.location.hash = key;
    setPage(key);
    setMenu(false);
  }
  async function logout() {
    const current = getSession();
    setSession(null);
    updateSession(null);
    try {
      await request(`${U}/logout`, { method: "POST", token: current?.token });
    } catch {
      /* Local logout remains effective without network. */
    }
  }
  if (!session || !isAdmin(session.user))
    return (
      <>
        <Login
          loggedIn={(value) => {
            setSession(value);
            updateSession(value);
            navigate("dashboard");
          }}
        />
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </>
    );
  const user = session.user,
    allowed = !["orders", "news"].includes(page) || isCanonicalAdmin(user);
  return (
    <div className="app-shell">
      {menu && (
        <button
          className="nav-scrim"
          onClick={() => setMenu(false)}
          aria-label="Đóng menu"
        />
      )}
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <a
          href="#dashboard"
          className="brand"
          onClick={() => navigate("dashboard")}
        >
          <span className="brand-logo">
            <Icon name="products" size={27} />
          </span>
          <span>
            store<span className="brand-light">hub</span>
            <small>ADMIN WORKSPACE</small>
          </span>
        </a>
        <p className="nav-caption">QUẢN LÝ CỬA HÀNG</p>
        <nav>
          {navigation.map(([key, label]) => (
            <a
              href={`#${key}`}
              key={key}
              className={page === key ? "active" : ""}
              aria-current={page === key ? "page" : undefined}
              onClick={() => navigate(key)}
            >
              <Icon name={key} />
              {label}
              {page === key && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="store-symbol">
            <Icon name="products" />
          </span>
          <div>
            <strong>Store Hub</strong>
            <small>Thương mại điện tử</small>
          </div>
          <span className="online-dot" />
        </div>
        <button className="logout" onClick={logout}>
          <Icon name="logout" />
          Đăng xuất
        </button>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu(!menu)}
              aria-label="Mở menu"
            >
              <Icon name="menu" />
            </button>
            <span>Trang quản trị</span>
            <span>/</span>
            <strong>{navigation.find(([key]) => key === page)?.[1]}</strong>
          </div>
          <div className="account">
            <span className="avatar">
              {user.name?.slice(0, 1).toUpperCase() || "A"}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </div>
          </div>
        </header>
        <main>
          {!allowed ? (
            <div className="card empty">
              <h2>Vai trò chưa được BE hỗ trợ ở mục này</h2>
              <p>
                API đơn hàng và tin tức chỉ chấp nhận role admin hoặc
                superadmin.
              </p>
            </div>
          ) : page === "dashboard" ? (
            <Dashboard {...{ user, navigate }} />
          ) : page === "orders" ? (
            <Orders user={user} notify={setToast} />
          ) : page === "settings" ? (
            <Settings
              user={user}
              notify={setToast}
              onUser={(newUser) => updateSession({ ...session, user: newUser })}
            />
          ) : (
            <Catalog key={page} kind={page} user={user} notify={setToast} />
          )}
        </main>
        <div className="app-footer">
          Store Hub Admin <span>Không gian quản lý cửa hàng của bạn</span>
        </div>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" />
          {toast}
          <button onClick={() => setToast("")} aria-label="Đóng thông báo">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
function Login({ loggedIn }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const result = await request(`${U}/login`, {
        method: "POST",
        token: null,
        body: {
          email: form.get("email").trim(),
          password: form.get("password"),
        },
      });
      if (!isAdmin(result.data))
        throw new Error(
          "Tài khoản này không có quyền truy cập trang quản trị.",
        );
      if (!result.token) throw new Error("BE không trả về token đăng nhập.");
      loggedIn({ token: result.token, user: result.data });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-art">
        <div className="brand">
          <span className="brand-logo">
            <Icon name="products" size={29} />
          </span>
          <span>
            store<span className="brand-light">hub</span>
          </span>
        </div>
        <div className="login-message">
          <span className="eyebrow">MỘT KHÔNG GIAN. MỌI HOẠT ĐỘNG.</span>
          <h1>
            Quản lý dễ dàng.
            <br />
            Kinh doanh hiệu quả.
          </h1>
          <p>
            Kết nối sản phẩm, đơn hàng và khách hàng trong một trang quản trị
            dành riêng cho cửa hàng của bạn.
          </p>
          <div className="art-card">
            <span>
              <Icon name="products" size={29} />
            </span>
            <div>
              <strong>Cửa hàng trong tầm tay</strong>
              <p>Đồng bộ dữ liệu cùng ứng dụng mobile</p>
            </div>
            <Icon name="check" />
          </div>
          <div className="art-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
        <small>STORE HUB · ADMIN WORKSPACE</small>
      </section>
      <section className="login-form">
        <form onSubmit={submit}>
          <span className="login-mark">
            <Icon name="dashboard" size={28} />
          </span>
          <h2>Chào mừng trở lại</h2>
          <p className="muted">Đăng nhập để bắt đầu quản lý cửa hàng.</p>
          <fieldset disabled={busy}>
            <Field
              label="Email quản trị"
              name="email"
              type="email"
              placeholder="admin@example.com"
              autoComplete="username"
              required
            />
            <Field
              label="Mật khẩu"
              name="password"
              type="password"
              placeholder="Nhập mật khẩu của bạn"
              autoComplete="current-password"
              required
            />
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary login-submit">
              {busy ? "Đang đăng nhập…" : "Đăng nhập"}
              <Icon name="arrow" />
            </button>
          </fieldset>
          <p className="login-note">
            Dùng tài khoản quản trị đã có trên hệ thống.
            <br />
            Liên hệ người quản lý hệ thống nếu bạn chưa có quyền.
          </p>
          <details>
            <summary>Cấu hình kết nối</summary>
            <code>{API_BASE}</code>
            <p>
              Đặt VITE_API_BASE_URL trong .env bằng URL gốc của BE (không thêm
              /api), sau đó khởi động lại FE.
            </p>
          </details>
        </form>
      </section>
    </div>
  );
}
