import { useEffect, useState, lazy, Suspense } from "react";
import {
  API_BASE,
  U,
  request,
  getSession,
  setSession,
  isAdmin,
  isCanonicalAdmin,
} from "./api";
import { Field, Icon, State } from "./components/UI";
import logo from "./assets/logo.png";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Catalog = lazy(() => import("./pages/Catalog"));
const Orders = lazy(() => import("./pages/Orders"));
const Settings = lazy(() => import("./pages/Settings"));
const Users = lazy(() => import("./pages/Users"));
const VipCustomers = lazy(() => import("./pages/VipCustomers"));
const ActivityLog = lazy(() => import("./pages/ActivityLog"));
const navigation = [
  ["dashboard", "Tổng quan"],
  ["products", "Sản phẩm"],
  ["categories", "Danh mục"],
  ["orders", "Đơn hàng"],
  ["users", "Người dùng"],
  ["vip", "Khách hàng thân thiết"],
  ["news", "Tin tức"],
  ["activity-log", "Nhật ký hoạt động"],
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
    allowed =
      !["orders", "news", "activity-log"].includes(page) ||
      isCanonicalAdmin(user);
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
          <span
            className="brand-logo"
            aria-hidden="true"
            style={{ background: "transparent", boxShadow: "none" }}
          >
            <img src={logo} alt="StoreHub Logo" className="brand-logo-img" />
          </span>
          <span>
            Store<span className="brand-light">Hub</span>
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
              <Icon name={key === "vip" ? "users" : key} />
              {label}
              {page === key && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <button
          className="logout"
          onClick={logout}
          style={{ marginTop: "auto" }}
        >
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
          <Suspense fallback={<State loading={true} message="Đang tải..." />}>
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
                onUser={(newUser) =>
                  updateSession({ ...session, user: newUser })
                }
              />
            ) : page === "users" ? (
              <Users user={user} notify={setToast} />
            ) : page === "vip" ? (
              <VipCustomers />
            ) : page === "activity-log" ? (
              <ActivityLog />
            ) : (
              <Catalog key={page} kind={page} user={user} notify={setToast} />
            )}
          </Suspense>
        </main>
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f7fb",
        padding: "20px",
      }}
    >
      <form
        className="card"
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: "380px",
          padding: "36px 28px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "4px" }}>
          <img
            src={logo}
            alt="StoreHub Logo"
            style={{
              width: "56px",
              height: "64px",
              objectFit: "contain",
              margin: "0 auto 10px",
              display: "block",
            }}
          />
          <h2 style={{ margin: "0 0 6px", fontSize: "24px" }}>Đăng nhập</h2>
          <small>StoreHub Admin Workspace</small>
        </div>

        <Field label="Email">
          <input
            name="email"
            type="email"
            placeholder="admin@example.com"
            autoComplete="username"
            required
            disabled={busy}
          />
        </Field>

        <Field label="Mật khẩu">
          <input
            name="password"
            type="password"
            placeholder="Nhập mật khẩu..."
            autoComplete="current-password"
            required
            disabled={busy}
          />
        </Field>

        {error && (
          <p className="error" role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        )}

        <button
          className="primary"
          type="submit"
          disabled={busy}
          style={{ width: "100%", padding: "12px", marginTop: "4px" }}
        >
          {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    </div>
  );
}
