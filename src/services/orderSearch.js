import { O, request, query } from "../api.js";

export const EMPTY_ORDER_FILTERS = {
  orderCode: "",
  customer: "",
  fromDate: "",
  toDate: "",
  status: "",
  paymentMethod: "",
};

/**
 * US17 AC2: Danh sách các phương thức thanh toán hỗ trợ lọc
 */
export const ORDER_PAYMENT_METHODS = ["COD", "ZaloPay"];

/**
 * US20 AC1: Danh sách các lý do hủy đơn hàng mẫu thông dụng
 */
export const CANCEL_REASONS = [
  "Khách hàng yêu cầu hủy",
  "Hết hàng trong kho",
  "Sai thông tin giao hàng/SĐT không liên lạc được",
  "Nghi ngờ đơn hàng ảo/gian lận",
  "Lý do khác",
];
export const ORDER_STATUSES = [
  "Chờ xác nhận",
  "Đã xác nhận",
  "Đã rời kho",
  "Đang giao hàng",
  "Đã giao hàng",
  "Đã hoàn thành",
  "Khiếu nại",
  "Đã hủy",
];

/**
 * US16 AC1: 5 Tab trạng thái vận hành chuẩn + 1 Tab phụ Tất cả đơn hàng
 */
export const ORDER_TABS = [
  {
    id: "all",
    label: "Tất cả đơn hàng",
    statuses: [],
    badgeTone: "neutral",
    isAuxiliary: true,
  },
  {
    id: "pending",
    label: "Chờ xác nhận",
    statuses: ["Chờ xác nhận"],
    badgeTone: "warning",
    operationalIndex: 1,
  },
  {
    id: "preparing",
    label: "Đang chuẩn bị",
    statuses: ["Đang chuẩn bị", "Đã xác nhận", "Đã rời kho"],
    badgeTone: "info",
    operationalIndex: 2,
  },
  {
    id: "shipping",
    label: "Đang giao hàng",
    statuses: ["Đang giao hàng", "Đã giao hàng"],
    badgeTone: "primary",
    operationalIndex: 3,
  },
  {
    id: "completed",
    label: "Đã hoàn thành",
    statuses: ["Đã hoàn thành"],
    badgeTone: "success",
    operationalIndex: 4,
  },
  {
    id: "cancelled",
    label: "Đã hủy / Khiếu nại",
    statuses: ["Đã hủy", "Khiếu nại"],
    badgeTone: "danger",
    operationalIndex: 5,
  },
];

export function countOrdersByTab(orders = []) {
  const counts = {
    all: Array.isArray(orders) ? orders.length : 0,
    pending: 0,
    preparing: 0,
    shipping: 0,
    completed: 0,
    cancelled: 0,
  };
  if (!Array.isArray(orders)) return counts;

  for (const o of orders) {
    const s = (o?.status?.trim() || o?.status) ?? "";
    if (s === "Chờ xác nhận") {
      counts.pending++;
    } else if (
      s === "Đang chuẩn bị" ||
      s === "Đã xác nhận" ||
      s === "Đã rời kho"
    ) {
      counts.preparing++;
    } else if (s === "Đang giao hàng" || s === "Đã giao hàng") {
      counts.shipping++;
    } else if (s === "Đã hoàn thành") {
      counts.completed++;
    } else if (s === "Đã hủy" || s === "Khiếu nại") {
      counts.cancelled++;
    }
  }
  return counts;
}

export const normalizeSearch = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
export const hasOrderFilters = (filters) =>
  Object.entries(filters || {}).some(([k, v]) =>
    Array.isArray(v) ? v.length > 0 : Boolean(v),
  );

function validDate(value) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function validateOrderFilters(filters) {
  if (
    (filters.fromDate && !validDate(filters.fromDate)) ||
    (filters.toDate && !validDate(filters.toDate))
  )
    return "Ngày đặt không hợp lệ.";
  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate)
    return "Từ ngày phải nhỏ hơn hoặc bằng đến ngày.";
  return "";
}
export function matchesPaymentMethod(orderPaymentMethod, filterPaymentMethod) {
  if (!filterPaymentMethod) return true;
  if (!orderPaymentMethod) return false;

  const o = String(orderPaymentMethod).trim();
  const f = String(filterPaymentMethod).trim();
  if (o.toLowerCase() === f.toLowerCase()) return true;

  const normOrder = normalizeSearch(o);
  const normFilter = normalizeSearch(f);

  if (normFilter.includes("cod") || normFilter.includes("nhan hang")) {
    return normOrder.includes("cod") || normOrder.includes("nhan hang");
  }
  if (normFilter.includes("vnpay")) {
    return normOrder.includes("vnpay");
  }
  if (normFilter.includes("zalopay") || normFilter.includes("zalo")) {
    return normOrder.includes("zalopay") || normOrder.includes("zalo");
  }
  if (normFilter.includes("chuyen khoan") || normFilter.includes("ngan hang")) {
    return (
      normOrder.includes("chuyen khoan") ||
      normOrder.includes("ngan hang") ||
      normOrder.includes("banking") ||
      normOrder.includes("bank")
    );
  }
  return normOrder.includes(normFilter) || normFilter.includes(normOrder);
}

export function filterOrders(orders, filters) {
  const error = validateOrderFilters(filters);
  if (error) throw new Error(error);
  const code = normalizeSearch(filters.orderCode),
    customer = normalizeSearch(filters.customer);
  // Inclusive calendar dates in Vietnam, independent of the browser's timezone.
  const from = filters.fromDate
    ? Date.parse(`${filters.fromDate}T00:00:00+07:00`)
    : -Infinity;
  const until = filters.toDate
    ? Date.parse(`${filters.toDate}T00:00:00+07:00`) + 86400000
    : Infinity;
  return orders.filter((order) => {
    const timestamp = Date.parse(order.createdAt);
    const customerText = [
      order.receiverName,
      order.receiverPhone,
      order.user?.name,
      order.user?.email,
      order.user?.phone,
    ]
      .map(normalizeSearch)
      .join(" ");
    const orderStatus = (order.status?.trim() || order.status) ?? "";
    const statusMatch =
      !filters.status ||
      (Array.isArray(filters.status)
        ? filters.status.length === 0 || filters.status.includes(orderStatus)
        : orderStatus === filters.status);

    const paymentMatch = matchesPaymentMethod(
      order.paymentMethod,
      filters.paymentMethod,
    );

    return (
      (!code || normalizeSearch(order.orderCode || order._id).includes(code)) &&
      (!customer || customerText.includes(customer)) &&
      statusMatch &&
      paymentMatch &&
      (!(filters.fromDate || filters.toDate) ||
        (Number.isFinite(timestamp) && timestamp >= from && timestamp < until))
    );
  });
}

/** Compatibility adapter: the supplied BE only accepts page/limit.
 * Never label a partial page set as complete results. Abort on errors, changing
 * counts, duplicates, invalid pagination or the explicit 5,000-order ceiling.
 */
export async function fetchOrderSnapshot({
  signal,
  onProgress = () => {},
  transport = request,
  maxItems = 5000,
} = {}) {
  const limit = 50,
    orders = [],
    seen = new Set();
  let expectedTotal, expectedPages;
  for (let page = 1; ; page++) {
    signal?.throwIfAborted();
    const result = await transport(
      `${O}/admin/orders${query({ page, limit })}`,
      { signal },
    );
    const total = result.pagination?.totalProducts,
      pages = result.pagination?.totalPages;
    if (
      !Array.isArray(result.data) ||
      !Number.isInteger(total) ||
      total < 0 ||
      !Number.isInteger(pages) ||
      pages < 0 ||
      (pages !== Math.max(1, Math.ceil(total / limit)) &&
        !(total === 0 && pages === 0))
    )
      throw new Error(
        "API đơn hàng trả phân trang không hợp lệ. Không thể xác nhận đã tải đủ dữ liệu.",
      );
    if (total > maxItems)
      throw new Error(
        `Có hơn ${maxItems.toLocaleString("vi-VN")} đơn hàng. Cần bổ sung API lọc phía máy chủ để tìm kiếm đầy đủ.`,
      );
    if (expectedTotal === undefined) {
      expectedTotal = total;
      expectedPages = pages;
    }
    if (total !== expectedTotal || pages !== expectedPages)
      throw new Error(
        "Danh sách đơn hàng thay đổi trong khi tải. Vui lòng thử lại để tránh kết quả thiếu.",
      );
    for (const order of result.data) {
      if (!order?._id || seen.has(order._id))
        throw new Error(
          "Dữ liệu đơn hàng bị trùng hoặc thiếu mã trong lúc tải. Vui lòng thử lại.",
        );
      seen.add(order._id);
      orders.push(order);
    }
    onProgress({ loaded: orders.length, total });
    if (page >= pages) break;
    if (result.data.length !== limit)
      throw new Error(
        "API trả thiếu trang dữ liệu. Hãy thử lại; kết quả chưa được hiển thị.",
      );
  }
  if (orders.length !== expectedTotal)
    throw new Error(
      "Chưa tải đủ đơn hàng. Hãy thử lại; kết quả chưa được hiển thị.",
    );
  return orders;
}

let orderSnapshotCache = null;
let orderSnapshotPromise = null;

export function clearOrdersSnapshotCache() {
  orderSnapshotCache = null;
  orderSnapshotPromise = null;
}

export function getCachedOrderSnapshot(options = {}) {
  if (orderSnapshotCache && !options.forceRefresh) {
    return Promise.resolve(orderSnapshotCache);
  }
  if (orderSnapshotPromise && !options.forceRefresh) {
    return orderSnapshotPromise;
  }
  orderSnapshotPromise = fetchOrderSnapshot(options)
    .then((res) => {
      orderSnapshotCache = Array.isArray(res) ? res : [];
      orderSnapshotPromise = null;
      return orderSnapshotCache;
    })
    .catch((err) => {
      orderSnapshotPromise = null;
      throw err;
    });
  return orderSnapshotPromise;
}
