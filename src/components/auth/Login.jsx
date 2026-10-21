import { useState } from "react";
import { U, request, isAdmin } from "../../api";
import { Field } from "../UI";
import logo from "../../assets/logo.png";

export default function Login({ loggedIn }) {
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
