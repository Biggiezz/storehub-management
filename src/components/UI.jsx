import { useEffect, useRef, useState } from "react";
import { imageUrl } from "../api";
export function Icon({ name, size = 20 }) {
  const paths = {
    dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    products:
      "M12 3 3 7.5v9L12 21l9-4.5v-9L12 3 M3 7.5l9 4.5 9-4.5 M12 12v9 M7.5 5.25l9 4.5",
    orders: "M6 3h12v18H6z M9 7h6 M9 11h6 M9 15h4",
    categories: "M3 5h7l2 3h9v12H3z",
    users:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-4",
    news: "M4 3h16v18H4z M8 7h8 M8 11h8 M8 15h4",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
    search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6",
    plus: "M12 5v14 M5 12h14",
    close: "M6 6l12 12 M18 6 6 18",
    refresh: "M20 7a9 9 0 1 0 1 8 M20 2v5h-5",
    logout: "M9 3H4v18h5 M10 12h11 M17 8l4 4-4 4",
    menu: "M3 6h18 M3 12h18 M3 18h18",
    arrow: "M5 12h14 M14 7l5 5-5 5",
    check: "m5 12 4 4L19 6",
    money: "M3 5h18v14H3z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
    lock: "M7 11V7a5 5 0 0 1 10 0v4 M5 11h14v10H5z",
    unlock: "M7 11V7a5 5 0 0 1 9.9-1 M5 11h14v10H5z",
    edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.products} />
    </svg>
  );
}
export function Photo({ src, name = "", large = false }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`photo ${large ? "large" : ""}`}>
      {src && !failed ? (
        <img src={imageUrl(src)} alt={name} onError={() => setFailed(true)} />
      ) : (
        <Icon name="products" size={large ? 38 : 23} />
      )}
    </span>
  );
}
export function Badge({ children, tone }) {
  const green = [
    "Đã hoàn thành",
    "Đã giao hàng",
    "Đang bán",
    "published",
    "Đang hoạt động",
  ].includes(children);
  const red = ["Đã hủy", "Khiếu nại", "Ngừng bán", "hidden"].includes(children);
  return (
    <span
      className={`badge ${tone || (green ? "green" : red ? "red" : "blue")}`}
    >
      {{ published: "Đã xuất bản", draft: "Bản nháp", hidden: "Đã ẩn" }[
        children
      ] || children}
    </span>
  );
}
export function State({ loading, error, empty, retry }) {
  if (loading)
    return (
      <div className="empty" role="status">
        <span className="spinner" />
        Đang tải dữ liệu…
      </div>
    );
  if (error)
    return (
      <div className="empty error" role="alert">
        <strong>Chưa tải được dữ liệu</strong>
        <p>{error}</p>
        <button onClick={retry}>Thử lại</button>
      </div>
    );
  if (empty)
    return (
      <div className="empty">
        <Icon name="products" size={34} />
        <strong>Chưa có dữ liệu phù hợp</strong>
        <span>Thử thay đổi bộ lọc hoặc thêm dữ liệu mới.</span>
      </div>
    );
  return null;
}
export function Pager({ page, setPage, hasNext, total }) {
  return (
    <div className="pager">
      <span>
        {total != null
          ? `${total.toLocaleString("vi-VN")} kết quả`
          : "Dữ liệu từ hệ thống"}{" "}
        · Trang {page}
      </span>
      <div>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          ← Trước
        </button>
        <button disabled={!hasNext} onClick={() => setPage(page + 1)}>
          Sau →
        </button>
      </div>
    </div>
  );
}
export function Modal({ title, children, close, busy = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          className="icon-button"
          disabled={busy}
          onClick={close}
          aria-label="Đóng"
        >
          <Icon name="close" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Field({ label, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />}
    </label>
  );
}
export function FileField({ required = false }) {
  return (
    <Field label={`Ảnh ${required ? "*" : "(giữ ảnh cũ nếu không chọn)"}`}>
      <input
        name="image"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        required={required}
        onChange={(e) => {
          const f = e.target.files[0];
          e.target.setCustomValidity(
            f && f.size > 5 * 1024 * 1024 ? "Ảnh tối đa 5 MB." : "",
          );
          e.target.reportValidity();
        }}
      />
      <small>JPG, PNG, WEBP hoặc GIF · tối đa 5 MB</small>
    </Field>
  );
}
