import {
  fetchOrderSnapshot,
  getCachedOrderSnapshot,
  clearOrdersSnapshotCache,
} from "./orderSearch.js";

export function clearOrdersCache() {
  clearOrdersSnapshotCache();
}

export function getOrdersSnapshot() {
  return getCachedOrderSnapshot().catch(() => []);
}

export function resolveBarRevenue(b, bars = [], totalRev = 0) {
  if (!b) return 0;
  const candidates = [
    b.totalAmount,
    b.totalRevenue,
    b.amount,
    b.total,
    b.orderAmount,
    b.totalPrice,
    b.revenue,
  ];
  // 1. Nếu trong b đã có trường tiền đầy đủ (>= 10.000 VNĐ)
  for (const val of candidates) {
    const num = Number(val);
    if (!isNaN(num) && num >= 10000) {
      return num;
    }
  }
  // 2. Tìm giá trị raw đầu tiên khác 0
  let raw = 0;
  for (const val of candidates) {
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      raw = num;
      break;
    }
  }
  if (raw <= 0) return 0;

  // 3. Nếu raw nhỏ (< 10.000) trong khi tổng doanh thu lớn (>= 100.000 VNĐ):
  // Backend đã rút gọn hoặc lưu theo đơn vị triệu đồng (hoặc nghìn đồng)
  if (totalRev >= 100000) {
    const activeBars = bars.filter((x) => {
      const v = Number(
        x.revenue ?? x.totalRevenue ?? x.totalAmount ?? x.amount ?? 0,
      );
      return v > 0;
    });
    // Nếu chỉ có duy nhất 1 cột có doanh thu trong kỳ (như cột T5)
    if (activeBars.length === 1) {
      return totalRev;
    }
    // Nếu có nhiều cột: phân bổ theo tỷ lệ
    const rawSum = bars.reduce((sum, x) => {
      const v = Number(
        x.revenue ?? x.totalRevenue ?? x.totalAmount ?? x.amount ?? 0,
      );
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
    if (rawSum > 0) {
      const ratio = totalRev / rawSum;
      if (ratio >= 200000 && ratio <= 5000000) {
        return Math.round((raw / rawSum) * totalRev);
      }
      if (ratio >= 200 && ratio <= 5000) {
        return Math.round((raw / rawSum) * totalRev);
      }
    }
    // Fallback: Nếu raw < 1.000 và totalRev >= 1.000.000 thì đơn vị là triệu đồng
    if (raw < 1000 && totalRev >= 1000000) {
      return raw * 1000000;
    }
  }
  return raw;
}

export function resolveBarOrders(
  b,
  rev,
  bars = [],
  totalOrders = 0,
  totalRev = 0,
  orders = [],
  period = "0",
) {
  // 1. Kiểm tra nếu backend trả về số đơn trực tiếp trong object b
  const backendCount =
    b?.orderCount ??
    b?.orders ??
    b?.totalOrders ??
    b?.count ??
    b?.completedOrders ??
    b?.order_count;
  if (
    typeof backendCount === "number" &&
    !isNaN(backendCount) &&
    backendCount >= 0
  ) {
    return backendCount;
  }

  // Nếu cột không có doanh thu thì số đơn hàng là 0
  if (!rev || rev <= 0) return 0;

  // 2. Nếu có danh sách đơn hàng thực tế orders từ hệ thống
  if (Array.isArray(orders) && orders.length > 0) {
    const label = String(b?.label || "").trim();

    // A. Nhãn tháng: Th1 -> Th12, Tháng 1 -> 12, T1 -> T12
    const mMatch =
      label.match(/(?:th(?:áng)?\s*|t)(\d+)/i) || label.match(/^(\d{1,2})$/);
    if (mMatch) {
      const targetMonth = parseInt(mMatch[1], 10);
      if (targetMonth >= 1 && targetMonth <= 12) {
        const inMonth = orders.filter((o) => {
          if (!o?.createdAt) return false;
          const t = new Date(o.createdAt).getTime();
          if (isNaN(t)) return false;
          const vnDate = new Date(t + 7 * 3600 * 1000);
          const m = vnDate.getUTCMonth() + 1;
          const y = vnDate.getUTCFullYear();
          if (period === "2") {
            return m === targetMonth && y === 2026;
          }
          return m === targetMonth;
        });

        // Ưu tiên đếm các đơn đã giao hàng / đã hoàn thành (tạo ra doanh số hoàn thành)
        const completed = inMonth.filter((o) =>
          ["Đã hoàn thành", "Đã giao hàng"].includes(o.status),
        );
        if (completed.length > 0) return completed.length;

        // Nếu không có đơn hoàn thành nhưng có đơn hợp lệ (chưa hủy)
        const valid = inMonth.filter((o) => o.status !== "Đã hủy");
        if (valid.length > 0) return valid.length;
        if (inMonth.length > 0) return inMonth.length;
      }
    }

    // B. Nhãn thứ trong tuần: T2, T3, T4, T5, T6, T7, CN
    const dayMap = { cn: 0, t2: 1, t3: 2, t4: 3, t5: 4, t6: 5, t7: 6 };
    const cleanLabel = label.toLowerCase().replace(/\s+/g, "");
    if (cleanLabel in dayMap) {
      const targetDay = dayMap[cleanLabel];
      const nowVn = new Date(Date.now() + 7 * 3600 * 1000);
      let targetMonth = nowVn.getUTCMonth() + 1;
      let targetYear = nowVn.getUTCFullYear();
      if (period === "1") {
        targetMonth -= 1;
        if (targetMonth === 0) {
          targetMonth = 12;
          targetYear -= 1;
        }
      }
      const inDayOfWeek = orders.filter((o) => {
        if (!o?.createdAt) return false;
        const t = new Date(o.createdAt).getTime();
        if (isNaN(t)) return false;
        const vnDate = new Date(t + 7 * 3600 * 1000);
        return (
          vnDate.getUTCFullYear() === targetYear &&
          vnDate.getUTCMonth() + 1 === targetMonth &&
          vnDate.getUTCDay() === targetDay
        );
      });
      const completed = inDayOfWeek.filter((o) =>
        ["Đã hoàn thành", "Đã giao hàng"].includes(o.status),
      );
      if (completed.length > 0) return completed.length;
      const valid = inDayOfWeek.filter((o) => o.status !== "Đã hủy");
      if (valid.length > 0) return valid.length;
    }

    // C. Nhãn ngày cụ thể: e.g. "21/10" hoặc "21"
    const dMatch = label.match(/^(\d{1,2})(?:\/(\d{1,2}))?$/);
    if (dMatch) {
      const targetDate = parseInt(dMatch[1], 10);
      const targetMonth = dMatch[2] ? parseInt(dMatch[2], 10) : null;
      const inDay = orders.filter((o) => {
        if (!o?.createdAt) return false;
        const t = new Date(o.createdAt).getTime();
        if (isNaN(t)) return false;
        const vnDate = new Date(t + 7 * 3600 * 1000);
        const d = vnDate.getUTCDate();
        const m = vnDate.getUTCMonth() + 1;
        if (targetMonth) return d === targetDate && m === targetMonth;
        return d === targetDate;
      });
      const completed = inDay.filter((o) =>
        ["Đã hoàn thành", "Đã giao hàng"].includes(o.status),
      );
      if (completed.length > 0) return completed.length;
      const valid = inDay.filter((o) => o.status !== "Đã hủy");
      if (valid.length > 0) return valid.length;
    }
  }

  // 3. Fallback khi orders chưa sẵn sàng: phân bổ theo tỷ lệ doanh thu thực tế
  const activeBars = bars.filter(
    (x) =>
      (x.revenue || x.totalRevenue || x.totalAmount || x.amount || 0) > 0,
  );
  if (activeBars.length === 1 && totalOrders > 0) {
    return totalOrders;
  }
  if (totalRev > 0 && totalOrders > 0) {
    const estimated = Math.round((rev / totalRev) * totalOrders);
    return Math.max(1, estimated);
  }

  return 1;
}
