export const API_BASE = (
  import.meta.env?.VITE_API_BASE_URL || "http://localhost:3000"
).replace(/\/+$/, "");
const KEY = "storehub.admin.session";
export function getSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY));
    return value?.token && value?.user ? value : null;
  } catch {
    return null;
  }
}
export function setSession(value) {
  if (value) sessionStorage.setItem(KEY, JSON.stringify(value));
  else sessionStorage.removeItem(KEY);
}
export const roleOf = (user) =>
  String(user?.role || "")
    .replace(/\s+/g, "")
    .toLowerCase();
export const isSuper = (user) =>
  ["superadmin", "quảntrịviêntốicao"].includes(roleOf(user));
export const isAdmin = (user) =>
  [
    "admin",
    "superadmin",
    "quảnlýcửahàng",
    "quảntrịviêntốicao",
    "quảntrịviên",
  ].includes(roleOf(user));
export const isCanonicalAdmin = (user) =>
  ["admin", "superadmin"].includes(roleOf(user));
export function query(values) {
  return (
    "?" +
    new URLSearchParams(
      Object.entries(values).filter(([, v]) => v !== "" && v != null),
    ).toString()
  );
}
export async function request(
  path,
  { method = "GET", body, signal, token = getSession()?.token } = {},
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const multipart = body instanceof FormData;
  try {
    const url = path.startsWith("/users/admin/recent-activities")
      ? `${API_BASE}${path}`
      : `${API_BASE}/api${path}`;

    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body && !multipart ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? (multipart ? body : JSON.stringify(body)) : undefined,
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(
        `BE trả về dữ liệu không hợp lệ (HTTP ${response.status}). Kiểm tra VITE_API_BASE_URL.`,
      );
    }
    if (!response.ok || Number(result.code) >= 400) {
      if (
        response.status === 401 ||
        (response.status === 403 && /token/i.test(result.message || ""))
      ) {
        setSession(null);
        window.dispatchEvent(new Event("session-expired"));
      }
      throw new Error(
        result.message || `Yêu cầu thất bại (HTTP ${response.status})`,
      );
    }
    return result;
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error(
        signal?.aborted
          ? "Đã hủy yêu cầu."
          : "BE chưa phản hồi sau 30 giây. Vui lòng thử lại.",
        { cause: error },
      );
    if (error instanceof TypeError)
      throw new Error(
        "Không kết nối được BE. Kiểm tra địa chỉ API, mạng và CORS.",
        { cause: error },
      );
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
export const P = "/productsRouter",
  U = "/usersRouter",
  O = "/oderRouter",
  N = "/newsRouter";
export const money = (value, unit = "VNĐ") => {
  if (value == null || value === "") return `0 ${unit}`;
  let cleanVal = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/\d+\.\d{3}/.test(trimmed) || /\b(vnđ|vnd|đ)\b/i.test(trimmed)) {
      cleanVal = trimmed.replace(/\./g, "").replace(/[^\d-]/g, "");
    } else {
      cleanVal = trimmed.replace(/[^\d.-]/g, "");
    }
  }
  const num = Number(cleanVal);
  if (isNaN(num)) return `0 ${unit}`;
  const isNegative = num < 0;
  const absNum = Math.round(Math.abs(num));
  const formatted = absNum.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${isNegative ? "-" : ""}${formatted} ${unit}`;
};
export const date = (value) =>
  value && !Number.isNaN(new Date(value).getTime())
    ? new Date(value).toLocaleString("vi-VN")
    : "—";
export function imageUrl(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (/^data:image\//i.test(value) || /^blob:/i.test(value)) return value;
  if (/^[a-z]+:/i.test(value) || value.startsWith("//")) return "";
  return `${API_BASE}/${value.replace(/^\//, "")}`;
}
export function nextStatuses(status, user) {
  const transitions = {
    "Chờ xác nhận": ["Đã xác nhận"],
    "Đã xác nhận": ["Đã rời kho"],
    "Đã rời kho": ["Đang giao hàng"],
    "Đang giao hàng": ["Đã giao hàng", "Đã hoàn thành"],
    "Đã giao hàng": ["Đã hoàn thành", "Khiếu nại"],
    "Khiếu nại": ["Đang giao hàng", "Đã hoàn thành"],
  };
  const options = [...(transitions[status] || [])];
  if (
    (roleOf(user) === "superadmin" &&
      ["Chờ xác nhận", "Đã xác nhận", "Khiếu nại"].includes(status)) ||
    (roleOf(user) === "admin" && status === "Khiếu nại")
  )
    options.push("Đã hủy");
  return options;
}

export function toSlug(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Xóa dấu tiếng Việt
    .replace(/[đĐ]/g, "d") // Chuyển đ -> d
    .replace(/&/g, " ") // Chuyển & thành khoảng trắng
    .replace(/[^a-z0-9\s-]/g, "") // Bỏ ký tự đặc biệt
    .trim()
    .replace(/\s+/g, "-") // Chuyển khoảng trắng thành gạch ngang
    .replace(/-+/g, "-"); // Bỏ gạch ngang liên tiếp
}

const CAT_OVERRIDES_KEY = "storehub.category.overrides";
export function getCategoryOverrides() {
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(CAT_OVERRIDES_KEY)
        : typeof sessionStorage !== "undefined"
          ? sessionStorage.getItem(CAT_OVERRIDES_KEY)
          : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCategoryOverride(catId, overrides) {
  if (!catId) return;
  try {
    const current = getCategoryOverrides();
    current[catId] = {
      ...(current[catId] || {}),
      ...overrides,
      _id: catId,
      updatedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(current);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(CAT_OVERRIDES_KEY, json);
    } else if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(CAT_OVERRIDES_KEY, json);
    }
  } catch {}
}
