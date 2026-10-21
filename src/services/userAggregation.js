import { roleOf } from "../api";

/**
 * Chuẩn hóa số điện thoại Việt Nam (+84, 84, khoảng trắng, dấu gạch)
 */
export function normalizePhone(p) {
  if (!p) return "";
  let digits = String(p).replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length > 9) {
    digits = "0" + digits.slice(2);
  }
  return digits;
}

/**
 * Chuẩn hóa email
 */
export function normalizeEmail(e) {
  return String(e || "").trim().toLowerCase();
}

/**
 * US24 AC1 & AC2: Bảng định nghĩa thứ hạng VIP Loyalty
 * - Kim Cương: > 20 triệu hoặc > 10 đơn hoàn thành
 * - Vàng: 10 - 20 triệu
 * - Bạc: 5 - 10 triệu
 * - Thành viên Đồng: < 5 triệu
 */
export const VIP_TIERS = {
  diamond: {
    key: "diamond",
    name: "Kim Cương",
    badgeClass: "vip-badge-diamond",
    icon: "💎",
    color: "#0369a1",
    isVip: true,
  },
  gold: {
    key: "gold",
    name: "Vàng",
    badgeClass: "vip-badge-gold",
    icon: "👑",
    color: "#854d0e",
    isVip: true,
  },
  silver: {
    key: "silver",
    name: "Bạc",
    badgeClass: "vip-badge-silver",
    icon: "🥈",
    color: "#334155",
    isVip: true,
  },
  bronze: {
    key: "bronze",
    name: "Thành viên Đồng",
    badgeClass: "vip-badge-bronze",
    icon: "🥉",
    color: "#9a3412",
    isVip: false,
  },
};

export function getVipTier(spent = 0, completedOrders = 0) {
  const s = Number(spent) || 0;
  const o = Number(completedOrders) || 0;
  if (s > 20000000 || o > 10) return VIP_TIERS.diamond;
  if (s >= 10000000) return VIP_TIERS.gold;
  if (s >= 5000000) return VIP_TIERS.silver;
  return VIP_TIERS.bronze;
}

export function formatLastActive(lastActive, isOnline) {
  if (isOnline) return "Đang trực tuyến";
  if (!lastActive) return "Chưa hoạt động";
  const diffMs = Date.now() - new Date(lastActive).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return "Vừa truy cập";
  if (diffMins < 60) return `${diffMins} phút trước`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
}

export function getRoleBadge(role) {
  const r = String(role || "").toLowerCase().replace(/\s+/g, "");
  if (r === "superadmin" || r === "quảntrịviêntốicao")
    return { label: "Super Admin", tone: "blue" };
  if (r === "admin" || r === "quảnlýcửahàng" || r === "quảntrịviên")
    return { label: "Quản trị viên", tone: "blue" };
  return { label: "Khách hàng", tone: "" };
}

/**
 * Xây dựng danh bạ toàn diện: Gom nhóm đa kênh (ID/Email/SĐT) bằng Union-Find để nhận diện mọi khách hàng
 */
export function buildCustomerUnionFind(
  allRegisteredUsersSnapshot = [],
  users = [],
  allOrdersSnapshot = [],
  pageCache = {}
) {
  const knownUsersMap = new Map();
  allRegisteredUsersSnapshot.forEach((u) => {
    if (u?._id) knownUsersMap.set(u._id, u);
  });
  users.forEach((u) => {
    if (u?._id) knownUsersMap.set(u._id, u);
  });
  Object.values(pageCache).forEach((pageList) => {
    if (Array.isArray(pageList)) {
      pageList.forEach((u) => {
        if (u?._id) knownUsersMap.set(u._id, u);
      });
    }
  });

  const registeredUsers = Array.from(knownUsersMap.values());

  // Union-Find gom nhóm các liên kết định danh
  const parent = new Map();
  function find(x) {
    if (!parent.has(x)) parent.set(x, x);
    let p = parent.get(x);
    if (p !== x) {
      p = find(p);
      parent.set(x, p);
    }
    return p;
  }
  function union(a, b) {
    if (!a || !b) return;
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootB, rootA);
    }
  }

  // Liên kết khóa từ tài khoản người dùng đăng ký
  for (const u of registeredUsers) {
    const idKey = `id:${u._id}`;
    const emailKey = u.email ? `email:${normalizeEmail(u.email)}` : null;
    const phoneKey = u.phone ? `phone:${normalizePhone(u.phone)}` : null;

    find(idKey);
    if (emailKey) union(idKey, emailKey);
    if (phoneKey) union(idKey, phoneKey);
  }

  // Liên kết khóa từ toàn bộ đơn hàng
  if (Array.isArray(allOrdersSnapshot)) {
    for (const o of allOrdersSnapshot) {
      if (!o) continue;
      const rawId =
        o.user?._id ||
        o.user?.id ||
        (typeof o.user === "string" ? o.user : null) ||
        o.userId ||
        o.customerId;
      const idKey = rawId ? `id:${rawId}` : null;
      const email = normalizeEmail(o.user?.email || o.receiverEmail);
      const emailKey = email ? `email:${email}` : null;
      const phone = normalizePhone(o.user?.phone || o.receiverPhone);
      const phoneKey = phone ? `phone:${phone}` : null;

      const primary = idKey || emailKey || phoneKey;
      if (!primary) continue;
      find(primary);
      if (idKey && primary !== idKey) union(primary, idKey);
      if (emailKey && primary !== emailKey) union(primary, emailKey);
      if (phoneKey && primary !== phoneKey) union(primary, phoneKey);
    }
  }

  // Khởi tạo đối tượng khách hàng cho mỗi cụm
  const clusterMap = new Map();
  function getCustomerForRoot(rootKey) {
    if (!clusterMap.has(rootKey)) {
      clusterMap.set(rootKey, {
        _id: rootKey,
        registeredUserId: null,
        name: "",
        email: "",
        phone: "",
        address: "",
        image: "",
        role: "customer",
        isStaffOrAdmin: false,
        isOnline: false,
        lastActive: null,
        isBlocked: false,
        blockReason: "",
        createdAt: null,
        updatedAt: null,
        totalSpent: 0,
        completedOrdersCount: 0,
        validOrdersCount: 0,
        totalOrdersCount: 0,
        orders: [],
      });
    }
    return clusterMap.get(rootKey);
  }

  // Đổ dữ liệu từ tài khoản đăng ký
  for (const u of registeredUsers) {
    const rootKey = find(`id:${u._id}`);
    const cust = getCustomerForRoot(rootKey);

    cust._id = u._id;
    cust.registeredUserId = u._id;
    cust.name = u.name || cust.name;
    cust.email = u.email || cust.email;
    cust.phone = u.phone || cust.phone;
    cust.address = u.address || cust.address;
    cust.image = u.image || cust.image;
    cust.role = u.role || cust.role;
    cust.isOnline = u.isOnline ?? cust.isOnline;
    cust.lastActive = u.lastActive ?? cust.lastActive;
    cust.isBlocked = u.isBlocked ?? cust.isBlocked;
    cust.blockReason = u.blockReason ?? cust.blockReason;
    cust.createdAt = u.createdAt ?? cust.createdAt;
    cust.updatedAt = u.updatedAt ?? cust.updatedAt;

    const r = roleOf(u);
    if (
      r === "admin" ||
      r === "superadmin" ||
      r === "staff" ||
      r === "quảntrịviên" ||
      r === "quảnlýcửahàng"
    ) {
      cust.isStaffOrAdmin = true;
    }
  }

  // Đổ dữ liệu và cộng dồn chi tiêu từ toàn bộ đơn hàng
  if (Array.isArray(allOrdersSnapshot)) {
    for (const o of allOrdersSnapshot) {
      if (!o) continue;
      const rawId =
        o.user?._id ||
        o.user?.id ||
        (typeof o.user === "string" ? o.user : null) ||
        o.userId ||
        o.customerId;
      const idKey = rawId ? `id:${rawId}` : null;
      const email = normalizeEmail(o.user?.email || o.receiverEmail);
      const emailKey = email ? `email:${email}` : null;
      const phone = normalizePhone(o.user?.phone || o.receiverPhone);
      const phoneKey = phone ? `phone:${phone}` : null;

      const anyKey = idKey || emailKey || phoneKey;
      const rootKey = anyKey ? find(anyKey) : `order:${o._id}`;
      const cust = getCustomerForRoot(rootKey);

      if (!cust.name) cust.name = o.receiverName || o.user?.name || "Khách hàng";
      if (!cust.email && email) cust.email = email;
      if (!cust.phone && (o.receiverPhone || o.user?.phone)) {
        cust.phone = o.receiverPhone || o.user?.phone;
      }
      if (!cust.address && o.deliveryAddress) cust.address = o.deliveryAddress;
      if (!cust.image && o.user?.image) cust.image = o.user.image;
      if (!cust.createdAt && o.createdAt) cust.createdAt = o.createdAt;

      const orderAmount =
        Number(
          o.totalAmount ??
            o.totalPrice ??
            o.amount ??
            o.total ??
            o.orderAmount ??
            o.totalRevenue ??
            o.revenue ??
            0
        ) || 0;

      cust.totalOrdersCount++;
      cust.orders.push(o);

      const st = String(o.status || "").trim().toLowerCase();
      const isCancelled = st.includes("hủy") || st.includes("cancel");
      const isCompleted =
        st.includes("hoàn thành") ||
        st.includes("đã giao") ||
        st.includes("thành công") ||
        st.includes("completed") ||
        st.includes("delivered");

      if (!isCancelled && orderAmount > 0) {
        cust.totalSpent += orderAmount;
        cust.validOrdersCount++;
        if (isCompleted) {
          cust.completedOrdersCount++;
        }
      }
    }
  }

  const byId = new Map();
  const byEmail = new Map();
  const byPhone = new Map();
  const allCustomersList = [];

  for (const cust of clusterMap.values()) {
    if (!cust.name) cust.name = "Khách hàng";
    if (!cust.completedOrdersCount && cust.validOrdersCount) {
      cust.completedOrdersCount = cust.validOrdersCount;
    }

    allCustomersList.push(cust);

    if (cust._id) byId.set(cust._id, cust);
    if (cust.registeredUserId) byId.set(cust.registeredUserId, cust);
    if (cust.email) byEmail.set(normalizeEmail(cust.email), cust);
    if (cust.phone) {
      const ph = normalizePhone(cust.phone);
      if (ph) byPhone.set(ph, cust);
    }
  }

  return {
    spendingMap: byId,
    spendingMapByEmail: byEmail,
    spendingMapByPhone: byPhone,
    allSystemCustomers: allCustomersList,
  };
}

/**
 * Tra cứu chi tiêu chuẩn xác cho 1 khách hàng/người dùng
 */
export function getUserStats(x, spendingMap, spendingMapByEmail, spendingMapByPhone) {
  if (!x) return { totalSpent: 0, completedOrdersCount: 0, totalOrdersCount: 0 };
  const fromId = x._id ? spendingMap?.get(x._id) : null;
  const fromEmail = x.email ? spendingMapByEmail?.get(normalizeEmail(x.email)) : null;
  const fromPhone = x.phone ? spendingMapByPhone?.get(normalizePhone(x.phone)) : null;
  const candidate = fromId || fromEmail || fromPhone || x;

  return {
    totalSpent: Number(
      candidate.totalSpent ??
        x.totalSpent ??
        x.stats?.totalSpent ??
        0
    ),
    completedOrdersCount: Number(
      candidate.completedOrdersCount ??
        x.completedOrdersCount ??
        x.stats?.completedOrdersCount ??
        0
    ),
    totalOrdersCount: Number(
      candidate.totalOrdersCount ??
        x.totalOrdersCount ??
        x.stats?.totalOrdersCount ??
        0
    ),
  };
}
