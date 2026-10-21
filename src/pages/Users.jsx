import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { U, O, request, query, date, money, isSuper, roleOf } from "../api";
import { Icon, Photo, Badge, Modal, Field, State } from "../components/UI";
import { useResource } from "../hooks";
import { OrderDetail } from "./Orders";
import { getCachedOrderSnapshot } from "../services/orderSearch";

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

function formatLastActive(lastActive, isOnline) {
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

function getRoleBadge(role) {
  const r = String(role || "").toLowerCase().replace(/\s+/g, "");
  if (r === "superadmin" || r === "quảntrịviêntốicao")
    return { label: "Super Admin", tone: "blue" };
  if (r === "admin" || r === "quảnlýcửahàng" || r === "quảntrịviên")
    return { label: "Quản trị viên", tone: "blue" };
  return { label: "Khách hàng", tone: "" };
}

export default function Users({ user, notify }) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // US24: State lưu dữ liệu đơn hàng & thống kê chi tiêu khách hàng thân thiết
  const [allOrdersSnapshot, setAllOrdersSnapshot] = useState([]);
  const [allRegisteredUsersSnapshot, setAllRegisteredUsersSnapshot] = useState([]);
  const [vipPage, setVipPage] = useState(1);

  // US24 AC1: State bộ lọc phân hạng VIP Loyalty
  const [vipTierFilter, setVipTierFilter] = useState("");
  const [minSpentFilter, setMinSpentFilter] = useState("");
  const [minOrdersFilter, setMinOrdersFilter] = useState("");

  // Modals state
  const [profileCustomer, setProfileCustomer] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [lockReason, setLockReason] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editError, setEditError] = useState("");
  const [busy, setBusy] = useState(false);

  // Client-side Page Cache: key = `${filter}::${term}::${page}`
  const pageCacheRef = useRef({});

  // 1. Tải toàn bộ đơn hàng trong hệ thống (kèm cơ chế fallback quét trang an toàn)
  const loadOrdersSnapshot = useCallback(async (forceRefresh = false) => {
    try {
      const orders = await getCachedOrderSnapshot({ forceRefresh });
      if (Array.isArray(orders) && orders.length > 0) {
        setAllOrdersSnapshot(orders);
        return;
      }
    } catch {
      // Fallback quét trực tiếp nếu getCachedOrderSnapshot trả lỗi cấu trúc phân trang
    }

    try {
      const allOrders = [];
      const seenOrderIds = new Set();
      for (let p = 1; p <= 50; p++) {
        const res = await request(`${O}/admin/orders${query({ page: p, limit: 50 })}`);
        const items = Array.isArray(res?.data) ? res.data : [];
        if (!items.length) break;
        for (const it of items) {
          if (it?._id && !seenOrderIds.has(it._id)) {
            seenOrderIds.add(it._id);
            allOrders.push(it);
          }
        }
        const totalP = res.pagination?.totalPages || res.pagination?.pages;
        if (totalP && p >= totalP) break;
        if (items.length < 50) break;
      }
      if (allOrders.length > 0) {
        setAllOrdersSnapshot(allOrders);
      }
    } catch {
      // Bỏ qua lỗi kết nối
    }
  }, []);

  // 2. Tải toàn bộ danh sách tài khoản người dùng đăng ký trong hệ thống
  const loadAllRegisteredUsers = useCallback(async () => {
    try {
      const allUsers = [];
      const seenIds = new Set();
      for (let p = 1; p <= 30; p++) {
        const res = await request(`${U}/get-all-users${query({ page: p, limit: 50 })}`);
        const items = Array.isArray(res?.data) ? res.data : [];
        if (!items.length) break;
        for (const it of items) {
          if (it?._id && !seenIds.has(it._id)) {
            seenIds.add(it._id);
            allUsers.push(it);
          }
        }
        if (items.length < 50) break;
      }
      if (allUsers.length > 0) {
        setAllRegisteredUsersSnapshot(allUsers);
      }
    } catch {
      // Bỏ qua lỗi kết nối
    }
  }, []);

  useEffect(() => {
    loadOrdersSnapshot(false);
    loadAllRegisteredUsers();
  }, [loadOrdersSnapshot, loadAllRegisteredUsers]);

  // Xây dựng danh bạ toàn diện: Gom nhóm đa kênh (ID/Email/SĐT) để nhận diện mọi khách hàng
  const { spendingMap, spendingMapByEmail, spendingMapByPhone, allSystemCustomers } = useMemo(() => {
    const knownUsersMap = new Map();
    allRegisteredUsersSnapshot.forEach((u) => {
      if (u?._id) knownUsersMap.set(u._id, u);
    });
    users.forEach((u) => {
      if (u?._id) knownUsersMap.set(u._id, u);
    });
    Object.values(pageCacheRef.current).forEach((pageList) => {
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

        const orderAmount = Number(
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
  }, [allRegisteredUsersSnapshot, users, allOrdersSnapshot]);

  // Tra cứu chi tiêu chuẩn xác cho 1 khách hàng/người dùng
  function getUserStats(x) {
    if (!x) return { totalSpent: 0, completedOrdersCount: 0, totalOrdersCount: 0 };
    const fromId = x._id ? spendingMap.get(x._id) : null;
    const fromEmail = x.email ? spendingMapByEmail.get(normalizeEmail(x.email)) : null;
    const fromPhone = x.phone ? spendingMapByPhone.get(normalizePhone(x.phone)) : null;
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

  const loadUsers = useCallback(
    async (targetPage = page, queryTerm = term, typeFilter = filter, forceRefresh = false) => {
      const cacheKey = `${typeFilter}::${(queryTerm || "").trim()}::${targetPage}`;

      if (!forceRefresh && pageCacheRef.current[cacheKey]) {
        setUsers(pageCacheRef.current[cacheKey]);
        setLoading(false);
        setError("");
        return;
      }

      setLoading(true);
      setError("");
      try {
        const queryParams = {
          page: targetPage,
          limit: 10,
        };
        if (queryTerm.trim()) queryParams.search = queryTerm.trim();
        if (typeFilter) queryParams.type = typeFilter;

        const res = await request(U + "/get-all-users" + query(queryParams));
        const list = Array.isArray(res?.data) ? res.data : [];

        pageCacheRef.current[cacheKey] = list;
        setUsers(list);
      } catch (err) {
        setError(err.message || "Không thể tải danh sách người dùng.");
      } finally {
        setLoading(false);
      }
    },
    [page, term, filter]
  );

  useEffect(() => {
    loadUsers(page, term, filter, false);
  }, [page, term, filter, loadUsers]);

  // Đồng bộ hóa thay đổi user trên state và toàn bộ cache
  function updateUserInCacheAndState(userId, patch) {
    setUsers((prev) =>
      prev.map((u) => (u._id === userId ? { ...u, ...patch } : u))
    );
    Object.keys(pageCacheRef.current).forEach((key) => {
      pageCacheRef.current[key] = pageCacheRef.current[key].map((u) =>
        u._id === userId ? { ...u, ...patch } : u
      );
    });
  }

  // Khóa / Mở khóa (US34)
  async function handleToggleBlock(e) {
    e.preventDefault();
    if (!selectedUser) return;
    setBusy(true);
    const willBlock = !selectedUser.isBlocked;
    try {
      const res = await request(U + `/toggle-block/${selectedUser._id}`, {
        method: "PUT",
        body: {
          isBlocked: willBlock,
          reason: willBlock ? lockReason.trim() : "",
        },
      });
      notify(
        res?.message ||
          (willBlock ? "Đã khóa tài khoản thành công." : "Đã mở khóa tài khoản thành công.")
      );
      updateUserInCacheAndState(selectedUser._id, {
        isBlocked: willBlock,
        blockReason: willBlock ? lockReason.trim() : "",
      });
      setLockModalOpen(false);
      setSelectedUser(null);
      setLockReason("");
    } catch (err) {
      notify(err.message || "Thao tác thất bại.");
    } finally {
      setBusy(false);
    }
  }

  // Chỉnh sửa thông tin người dùng (US23 AC2 & AC3)
  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!selectedUser) return;
    const form = new FormData(e.currentTarget);
    const phone = form.get("phone")?.trim() || "";
    const phoneRegex = /^(0[3|5|7|8|9])[0-9]{8}$/;
    if (phone && !phoneRegex.test(phone)) {
      setEditError(
        "Số điện thoại không đúng định dạng Việt Nam. Vui lòng nhập 10 chữ số bắt đầu bằng 03, 05, 07, 08 hoặc 09 (VD: 0912345678)."
      );
      return;
    }
    setEditError("");
    setBusy(true);
    const updateData = {
      name: form.get("name")?.trim(),
      phone,
      address: form.get("address")?.trim() || "",
    };
    if (isSuper(user)) {
      updateData.role = form.get("role");
    }
    try {
      const res = await request(U + `/update-user/${selectedUser._id}`, {
        method: "PUT",
        body: updateData,
      });
      notify("Đã cập nhật thông tin người dùng thành công.");
      const nextUpdatedAt = res?.data?.updatedAt || new Date().toISOString();
      updateUserInCacheAndState(selectedUser._id, {
        ...updateData,
        updatedAt: nextUpdatedAt,
      });
      setEditModalOpen(false);
      setSelectedUser(null);
      setEditError("");
    } catch (err) {
      setEditError(err.message || "Cập nhật thất bại.");
      notify(err.message || "Cập nhật thất bại.");
    } finally {
      setBusy(false);
    }
  }

  // US24 AC1: Kiểm tra xem có bộ lọc VIP nào đang kích hoạt
  const hasVipFilters = Boolean(
    vipTierFilter || minSpentFilter !== "" || minOrdersFilter !== ""
  );

  function resetVipFilters() {
    setVipTierFilter("");
    setMinSpentFilter("");
    setMinOrdersFilter("");
    setVipPage(1);
  }

  // US24 AC1: Lọc trên TOÀN BỘ khách hàng trong hệ thống (toàn bộ database)
  const allFilteredVipCustomers = useMemo(() => {
    if (!hasVipFilters) return [];

    const querySearch = term.toLowerCase().trim();

    return allSystemCustomers
      .filter((c) => {
        // Lọc theo vai trò trên toolbar
        if (filter === "customer" && c.isStaffOrAdmin) return false;
        if (filter === "staff" && !c.isStaffOrAdmin) return false;

        const stats = getUserStats(c);
        const tier = getVipTier(stats.totalSpent, stats.completedOrdersCount);

        // Lọc theo hạng VIP
        if (vipTierFilter === "top_spent") {
          // Lọc tất cả khách hàng đã từng phát sinh đơn hàng
          if (stats.totalSpent <= 0 && stats.totalOrdersCount <= 0) {
            return false;
          }
        } else if (vipTierFilter && tier.key !== vipTierFilter) {
          return false;
        }

        // Lọc theo chi tiêu tối thiểu (VNĐ)
        if (minSpentFilter !== "") {
          const minVal = Number(minSpentFilter);
          if (isNaN(minVal) || stats.totalSpent < minVal) {
            return false;
          }
        }

        // Lọc theo số đơn hoàn thành tối thiểu
        if (minOrdersFilter !== "") {
          const minO = Number(minOrdersFilter);
          if (isNaN(minO) || stats.completedOrdersCount < minO) {
            return false;
          }
        }

        // Lọc theo từ khóa tìm kiếm
        if (querySearch) {
          const nameNorm = (c.name || "").toLowerCase();
          const emailNorm = (c.email || "").toLowerCase();
          const phoneNorm = normalizePhone(c.phone);
          if (
            !nameNorm.includes(querySearch) &&
            !emailNorm.includes(querySearch) &&
            !phoneNorm.includes(querySearch)
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // Sắp xếp khách hàng mua nhiều nhất lên đầu
        const statsA = getUserStats(a);
        const statsB = getUserStats(b);
        if (statsB.totalSpent !== statsA.totalSpent) {
          return statsB.totalSpent - statsA.totalSpent;
        }
        return statsB.completedOrdersCount - statsA.completedOrdersCount;
      });
  }, [
    allSystemCustomers,
    hasVipFilters,
    vipTierFilter,
    minSpentFilter,
    minOrdersFilter,
    filter,
    term,
  ]);

  // Danh sách dòng hiển thị trên bảng
  const pageSize = 10;
  const vipTotalPages = Math.max(
    1,
    Math.ceil(allFilteredVipCustomers.length / pageSize)
  );

  const displayedUsers = useMemo(() => {
    if (hasVipFilters) {
      return allFilteredVipCustomers.slice(
        (vipPage - 1) * pageSize,
        vipPage * pageSize
      );
    }
    return users;
  }, [hasVipFilters, allFilteredVipCustomers, vipPage, users]);

  // US24 AC3: Xuất danh sách khách hàng thân thiết (VIP) kèm Email/SĐT sang file CSV
  function handleExportVipCsv() {
    try {
      let targetList = hasVipFilters
        ? allFilteredVipCustomers
        : allSystemCustomers
            .filter((c) => {
              if (filter === "customer" && c.isStaffOrAdmin) return false;
              if (filter === "staff" && !c.isStaffOrAdmin) return false;
              const stats = getUserStats(c);
              const tier = getVipTier(stats.totalSpent, stats.completedOrdersCount);
              return tier.isVip || stats.totalSpent > 0;
            })
            .sort((a, b) => {
              const statsA = getUserStats(a);
              const statsB = getUserStats(b);
              return statsB.totalSpent - statsA.totalSpent;
            });

      if (!targetList.length) {
        targetList = allSystemCustomers.filter((c) => {
          if (filter === "customer" && c.isStaffOrAdmin) return false;
          if (filter === "staff" && !c.isStaffOrAdmin) return false;
          return true;
        });
      }

      if (targetList.length === 0) {
        notify?.("Không có khách hàng nào phù hợp để xuất danh sách.");
        return;
      }

      const headers = [
        "Mã khách hàng",
        "Họ và tên",
        "Email",
        "Số điện thoại",
        "Hạng thành viên",
        "Nhóm VIP",
        "Tổng chi tiêu (VNĐ)",
        "Số đơn hoàn thành",
        "Tổng số đơn",
        "Địa chỉ",
        "Ngày tham gia",
      ];

      const escapeCsvCell = (val) => {
        const str = String(val ?? "");
        if (
          str.includes(",") ||
          str.includes('"') ||
          str.includes("\n") ||
          str.includes("\r")
        ) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const rows = targetList.map((x) => {
        const stats = getUserStats(x);
        const tier = getVipTier(stats.totalSpent, stats.completedOrdersCount);
        return [
          x._id,
          x.name || "Chưa cập nhật",
          x.email || "",
          x.phone || "",
          tier.name,
          tier.isVip ? "Khách VIP" : "Thành viên thường",
          stats.totalSpent,
          stats.completedOrdersCount,
          stats.totalOrdersCount,
          (x.address || "").replace(/\r?\n|\r/g, " "),
          x.createdAt ? new Date(x.createdAt).toLocaleDateString("vi-VN") : "",
        ];
      });

      // Tạo nội dung CSV chuẩn UTF-8 có BOM để Excel hiển thị tiếng Việt hoàn hảo
      const csvContent =
        "\uFEFF" +
        [
          headers.map(escapeCsvCell).join(","),
          ...rows.map((row) => row.map(escapeCsvCell).join(",")),
        ].join("\r\n");

      const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      a.href = url;
      a.download = `StoreHub_VIP_Customers_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notify?.(
        `Đã xuất thành công danh sách ${targetList.length} khách hàng sang file CSV.`
      );
    } catch (err) {
      notify?.("Lỗi khi xuất file CSV: " + (err.message || "Vui lòng thử lại."));
    }
  }

  const hasNext = users.length === 10;

  return (
    <>
      <div className="card">
        {/* Toolbar: Tìm kiếm & Bộ lọc vai trò & Nút Export CSV */}
        <div className="toolbar">
          <form
            className="searchbox"
            onSubmit={(e) => {
              e.preventDefault();
              setTerm(search.trim());
              setPage(1);
            }}
          >
            <Icon name="search" />
            <input
              aria-label="Tìm theo tên hoặc email"
              placeholder="Tìm theo tên hoặc email người dùng…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {term && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setTerm("");
                  setPage(1);
                }}
              >
                Xóa
              </button>
            )}
            <button type="submit">Tìm</button>
          </form>

          <select
            value={filter}
            aria-label="Bộ lọc vai trò"
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả vai trò</option>
            <option value="customer">Khách hàng</option>
            <option value="staff">Nhân viên / Quản trị</option>
          </select>

          {/* US24 AC3: Nút Xuất danh sách VIP (Export CSV) */}
          <button
            type="button"
            className="export-csv-btn"
            onClick={handleExportVipCsv}
            title="Xuất file CSV danh sách khách hàng thân thiết kèm Email/SĐT để phục vụ gửi voucher tri anh"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Xuất danh sách VIP (CSV)</span>
          </button>
        </div>

        {/* US24 AC1: Thanh bộ lọc phân hạng khách hàng thân thiết (VIP Loyalty) */}
        <div className="vip-filter-toolbar">
          <span className="vip-filter-label">
            <span>Phân hạng VIP:</span>
          </span>
          <div className="vip-filter-inputs">
            <select
              value={vipTierFilter}
              aria-label="Lọc theo hạng VIP"
              onChange={(e) => {
                setVipTierFilter(e.target.value);
                setVipPage(1);
              }}
            >
              <option value="">Tất cả hạng thành viên (Mặc định)</option>
              <option value="top_spent">
                ⭐ Tất cả khách hàng có đơn (Chi tiêu cao → thấp)
              </option>
              <option value="diamond">
                💎 Kim Cương (&gt; 20 triệu hoặc &gt; 10 đơn)
              </option>
              <option value="gold">👑 Vàng (10 - 20 triệu)</option>
              <option value="silver">🥈 Bạc (5 - 10 triệu)</option>
              <option value="bronze">🥉 Thành viên Đồng (&lt; 5 triệu)</option>
            </select>

            <input
              type="number"
              min="0"
              step="500000"
              value={minSpentFilter}
              onChange={(e) => {
                setMinSpentFilter(e.target.value);
                setVipPage(1);
              }}
              placeholder="Chi tiêu tối thiểu (VNĐ)…"
              title="Lọc theo chi tiêu tích lũy tối thiểu (VNĐ)"
            />

            <input
              type="number"
              min="0"
              step="1"
              value={minOrdersFilter}
              onChange={(e) => {
                setMinOrdersFilter(e.target.value);
                setVipPage(1);
              }}
              placeholder="Số đơn tối thiểu…"
              title="Lọc theo số đơn hoàn thành tối thiểu"
            />

            {hasVipFilters && (
              <button
                type="button"
                className="vip-filter-clear-btn"
                onClick={resetVipFilters}
                title="Xóa bộ lọc phân hạng VIP"
              >
                Xóa lọc VIP
              </button>
            )}
          </div>
        </div>

        {/* List Heading */}
        <div className="list-heading">
          <span>
            {hasVipFilters
              ? `${allFilteredVipCustomers.length} khách hàng tìm thấy · Trang ${vipPage} / ${vipTotalPages} (Bộ lọc VIP)`
              : displayedUsers.length > 0
              ? `${displayedUsers.length} người dùng hiển thị · Trang ${page}`
              : `Trang ${page}`}
          </span>
          <div className="actions">
            <button
              onClick={() => {
                loadUsers(page, term, filter, true);
                loadOrdersSnapshot(true);
                loadAllRegisteredUsers();
              }}
              aria-label="Làm mới danh sách"
              title="Làm mới danh sách"
            >
              <Icon name="refresh" size={16} />
            </button>
          </div>
        </div>

        {/* State: Lazy load & Error & Empty */}
        <State
          loading={loading && displayedUsers.length === 0}
          error={error}
          empty={!loading && !error && displayedUsers.length === 0}
          retry={() => {
            loadUsers(page, term, filter, true);
            loadOrdersSnapshot(true);
            loadAllRegisteredUsers();
          }}
        />

        {/* Bảng danh sách người dùng */}
        {!loading && !error && displayedUsers.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Liên hệ</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th className="align-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {displayedUsers.map((x) => {
                  const isSelf = user?._id === x._id || user?.id === x._id;
                  const targetRole = roleOf(x);
                  const isTargetSuper =
                    targetRole === "superadmin" ||
                    targetRole === "quảntrịviêntốicao";
                  const canManageLock =
                    isSuper(user) && !isSelf && !isTargetSuper && Boolean(x.registeredUserId || !String(x._id).startsWith("cust-"));
                  const roleInfo = getRoleBadge(x.role);
                  const isCustomer = roleInfo.label === "Khách hàng";
                  const stats = getUserStats(x);
                  const tier = getVipTier(
                    stats.totalSpent,
                    stats.completedOrdersCount
                  );

                  return (
                    <tr key={x._id}>
                      <td>
                        <div
                          className="identity"
                          style={{ cursor: "pointer" }}
                          onClick={() => setProfileCustomer(x)}
                          title="Nhấn để xem chi tiết hồ sơ & lịch sử mua"
                        >
                          <Photo src={x.image} name={x.name || x.email} />
                          <div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                flexWrap: "wrap",
                              }}
                            >
                              <strong>
                                {x.name || "—"}{" "}
                                {isSelf && (
                                  <small style={{ color: "#3568e8" }}>
                                    (Bạn)
                                  </small>
                                )}
                              </strong>
                              {/* US24 AC2: Hiển thị Huy hiệu phân hạng (VIP Badge) ngay cạnh tên khách hàng */}
                              {(isCustomer || stats.totalSpent > 0 || stats.completedOrdersCount > 0) && (
                                <span
                                  className={`vip-badge ${tier.badgeClass}`}
                                  title={`Hạng ${tier.name} · Chi tiêu: ${money(stats.totalSpent)} · ${stats.completedOrdersCount} đơn hoàn thành`}
                                >
                                  <span className="vip-badge-icon">
                                    {tier.icon}
                                  </span>
                                  {tier.name}
                                </span>
                              )}
                            </div>
                            <small>{x.email || "—"}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        {x.phone || "—"}
                        {(isCustomer || stats.totalSpent > 0 || stats.completedOrdersCount > 0) && (
                          <small
                            className="vip-stats-subtext"
                            title="Tổng chi tiêu tích lũy và số đơn hoàn thành"
                          >
                            {money(stats.totalSpent)} · {stats.completedOrdersCount} đơn
                          </small>
                        )}
                      </td>
                      <td>
                        <Badge tone={roleInfo.tone}>{roleInfo.label}</Badge>
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "11px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              color: x.isOnline ? "#16a34a" : "inherit",
                              fontWeight: x.isOnline ? 600 : "normal",
                            }}
                          >
                            <span
                              style={{
                                width: "7px",
                                height: "7px",
                                borderRadius: "50%",
                                backgroundColor: x.isOnline
                                  ? "#16a34a"
                                  : "#94a3b8",
                                display: "inline-block",
                                boxShadow: x.isOnline
                                  ? "0 0 0 2px #dcfce7"
                                  : "none",
                              }}
                            />
                            {formatLastActive(x.lastActive, !!x.isOnline)}
                          </span>
                          {x.isBlocked && (
                            <span
                              title={
                                x.blockReason
                                  ? `Lý do: ${x.blockReason}`
                                  : "Tài khoản bị khóa"
                              }
                            >
                              <Badge tone="red">
                                Đã khóa{" "}
                                {x.blockReason ? `(${x.blockReason})` : ""}
                              </Badge>
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{x.createdAt ? date(x.createdAt) : "—"}</td>
                      <td className="align-right">
                        <div className="actions end">
                          <button
                            onClick={() => setProfileCustomer(x)}
                            title="Xem chi tiết hồ sơ & lịch sử đơn hàng"
                          >
                            Hồ sơ
                          </button>

                          <button
                            onClick={() => {
                              setSelectedUser(x);
                              setEditError("");
                              setEditModalOpen(true);
                            }}
                            title="Chỉnh sửa thông tin"
                          >
                            Sửa
                          </button>

                          {canManageLock &&
                            (x.isBlocked ? (
                              <button
                                style={{ color: "#16a34a" }}
                                onClick={() => {
                                  setSelectedUser(x);
                                  setLockModalOpen(true);
                                }}
                                title="Mở khóa tài khoản"
                              >
                                Mở khóa
                              </button>
                            ) : (
                              <button
                                className="danger-link"
                                onClick={() => {
                                  setSelectedUser(x);
                                  setLockReason("");
                                  setLockModalOpen(true);
                                }}
                                title="Khóa tài khoản vi phạm"
                              >
                                Khóa
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Phân trang: Trước / Sau linh hoạt cho cả chế độ thường và bộ lọc VIP */}
        {!loading && (hasVipFilters ? allFilteredVipCustomers.length > 0 : users.length > 0) && (
          <div className="pager">
            <span>
              {hasVipFilters
                ? `${allFilteredVipCustomers.length} khách hàng · Trang ${vipPage} / ${vipTotalPages}`
                : `${users.length} người dùng · Trang ${page}`}
            </span>
            <div>
              <button
                disabled={hasVipFilters ? vipPage <= 1 : page <= 1}
                onClick={() => {
                  if (hasVipFilters) {
                    setVipPage((p) => Math.max(1, p - 1));
                  } else {
                    setPage((p) => Math.max(1, p - 1));
                  }
                }}
              >
                Trước
              </button>
              <button
                disabled={hasVipFilters ? vipPage >= vipTotalPages : !hasNext}
                onClick={() => {
                  if (hasVipFilters) {
                    setVipPage((p) => Math.min(vipTotalPages, p + 1));
                  } else {
                    setPage((p) => p + 1);
                  }
                }}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Khóa / Mở khóa tài khoản */}
      {lockModalOpen && selectedUser && (
        <Modal
          title={selectedUser.isBlocked ? "Mở khóa tài khoản" : "Khóa tài khoản vi phạm"}
          close={() => {
            if (!busy) {
              setLockModalOpen(false);
              setSelectedUser(null);
            }
          }}
          busy={busy}
        >
          <form onSubmit={handleToggleBlock}>
            <div className="modal-body">
              <p>
                Người dùng: <strong>{selectedUser.name || selectedUser.email}</strong>
              </p>
              {selectedUser.isBlocked ? (
                <div>
                  <p>Bạn có chắc chắn muốn mở khóa cho tài khoản này không? Người dùng sẽ có thể đăng nhập lại bình thường.</p>
                  {selectedUser.blockReason && (
                    <p className="muted" style={{ fontSize: "11px" }}>
                      Lý do đã khóa trước đó: {selectedUser.blockReason}
                    </p>
                  )}
                </div>
              ) : (
                <div className="form-grid">
                  <p>Khi bị khóa, tài khoản sẽ bị ngắt phiên đăng nhập và không thể truy cập hệ thống.</p>
                  <Field label="Lý do khóa tài khoản *">
                    <textarea
                      required
                      rows={3}
                      placeholder="Nhập lý do khóa (vi phạm chính sách, hành vi bất thường, v.v.)..."
                      value={lockReason}
                      onChange={(e) => setLockReason(e.target.value)}
                    />
                  </Field>
                </div>
              )}
            </div>
            <footer>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setLockModalOpen(false);
                  setSelectedUser(null);
                }}
              >
                Hủy
              </button>
              <button
                type="submit"
                className={selectedUser.isBlocked ? "primary" : "danger"}
                disabled={busy}
              >
                {busy
                  ? "Đang xử lý…"
                  : selectedUser.isBlocked
                  ? "Xác nhận mở khóa"
                  : "Xác nhận khóa tài khoản"}
              </button>
            </footer>
          </form>
        </Modal>
      )}

      {/* Modal Chỉnh sửa thông tin người dùng (US23 AC2 & AC3) */}
      {editModalOpen && selectedUser && (
        <Modal
          title="Chỉnh sửa người dùng"
          close={() => {
            if (!busy) {
              setEditModalOpen(false);
              setSelectedUser(null);
              setEditError("");
            }
          }}
          busy={busy}
        >
          <form onSubmit={handleSaveEdit}>
            <div className="modal-body form-grid">
              {editError && (
                <p className="error" role="alert">
                  {editError}
                </p>
              )}
              <Field label="Họ và tên *">
                <input
                  name="name"
                  required
                  defaultValue={selectedUser.name || ""}
                  placeholder="Nhập họ và tên..."
                />
              </Field>
              <Field label="Email (Không thể thay đổi)">
                <input value={selectedUser.email || ""} disabled readOnly />
              </Field>
              <div className="two-col">
                <Field label="Số điện thoại">
                  <input
                    name="phone"
                    type="tel"
                    defaultValue={selectedUser.phone || ""}
                    placeholder="VD: 0912345678"
                    pattern="^(0[3|5|7|8|9])[0-9]{8}$"
                    title="Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09"
                    onInvalid={(e) => {
                      if (e.target.validity.patternMismatch) {
                        e.target.setCustomValidity(
                          "Số điện thoại không đúng định dạng Việt Nam. Vui lòng nhập 10 chữ số bắt đầu bằng 03, 05, 07, 08 hoặc 09 (VD: 0912345678)."
                        );
                      }
                    }}
                    onInput={(e) => {
                      e.target.setCustomValidity("");
                      if (editError) setEditError("");
                    }}
                  />
                  <small className="muted" style={{ fontSize: "11px", marginTop: "4px" }}>
                    Định dạng: 10 chữ số (đầu số 03, 05, 07, 08, 09)
                  </small>
                </Field>
                <Field label="Vai trò hệ thống">
                  {isSuper(user) ? (
                    <select name="role" defaultValue={selectedUser.role || "customer"}>
                      <option value="customer">Khách hàng (customer)</option>
                      <option value="admin">Quản trị viên (admin)</option>
                      <option value="superadmin">Quản trị tối cao (superadmin)</option>
                    </select>
                  ) : (
                    <input value={selectedUser.role || "customer"} disabled readOnly />
                  )}
                </Field>
              </div>
              <Field label="Địa chỉ">
                <input
                  name="address"
                  defaultValue={selectedUser.address || ""}
                  placeholder="Nhập địa chỉ..."
                />
              </Field>
              <div className="two-col">
                <Field label="Ngày tạo tài khoản">
                  <input
                    value={date(selectedUser.createdAt)}
                    disabled
                    readOnly
                  />
                </Field>
                <Field label="Chỉnh sửa gần nhất (updatedAt)">
                  <input
                    value={
                      selectedUser.updatedAt
                        ? date(selectedUser.updatedAt)
                        : "Chưa có lịch sử cập nhật"
                    }
                    disabled
                    readOnly
                  />
                </Field>
              </div>
            </div>
            <footer>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditModalOpen(false);
                  setSelectedUser(null);
                  setEditError("");
                }}
              >
                Hủy
              </button>
              <button type="submit" className="primary" disabled={busy}>
                {busy ? "Đang lưu…" : "Lưu thay đổi"}
              </button>
            </footer>
          </form>
        </Modal>
      )}

      {/* Modal Xem chi tiết hồ sơ khách hàng & lịch sử đơn hàng (US25) */}
      {profileCustomer && (
        <CustomerProfileModal
          userId={profileCustomer.registeredUserId || profileCustomer._id}
          customerData={profileCustomer}
          user={user}
          notify={notify}
          close={() => setProfileCustomer(null)}
        />
      )}
    </>
  );
}

export function CustomerProfileModal({ userId, user, close, notify, customerData }) {
  const isCustomCustomer =
    !userId ||
    String(userId).startsWith("cust-") ||
    String(userId).startsWith("order:") ||
    String(userId).startsWith("id:") ||
    String(userId).startsWith("email:") ||
    String(userId).startsWith("phone:");

  const { data, loading, error, reload } = useResource(
    isCustomCustomer ? null : `${U}/customer-profile/${userId}`
  );
  const [viewingOrderId, setViewingOrderId] = useState(null);

  const payload = data?.data;
  const profile =
    payload?.profile || (isCustomCustomer || error ? customerData : null);
  const stats =
    payload?.stats ||
    (isCustomCustomer || error
      ? {
          totalSpent: customerData?.totalSpent || 0,
          totalOrders:
            customerData?.totalOrdersCount || customerData?.orders?.length || 0,
          statusCounts: {
            completed: customerData?.completedOrdersCount || 0,
            pending: 0,
            processing: 0,
            shipping: 0,
          },
        }
      : null);
  const orders =
    payload?.orders || (isCustomCustomer || error ? customerData?.orders || [] : []);
  const roleInfo = getRoleBadge(profile?.role);

  return (
    <>
      <Modal
        title={
          profile?.name
            ? `Hồ sơ khách hàng: ${profile.name}`
            : profile?.email
            ? `Hồ sơ khách hàng: ${profile.email}`
            : "Hồ sơ khách hàng"
        }
        close={close}
        className="modal-wide"
      >
        <div className="modal-body">
          <State
            loading={!isCustomCustomer && loading}
            error={!isCustomCustomer && !customerData ? error : ""}
            retry={reload}
          />

          {profile && (
            <>
              {/* 1. Hiển thị thông tin cá nhân: Họ tên, Email, Số điện thoại, Địa chỉ mặc định */}
              <div className="customer-profile-header">
                <Photo src={profile.image} name={profile.name || profile.email} large />
                <div className="customer-profile-info">
                  <div className="customer-profile-title">
                    <h3>{profile.name || "Chưa cập nhật tên"}</h3>
                    <Badge tone={roleInfo.tone}>{roleInfo.label}</Badge>
                    {profile.isBlocked ? (
                      <Badge tone="red">
                        Đã khóa {profile.blockReason ? `(${profile.blockReason})` : ""}
                      </Badge>
                    ) : (
                      <Badge tone={profile.isOnline ? "green" : ""}>
                        {profile.isOnline ? "Đang trực tuyến" : "Ngoại tuyến"}
                      </Badge>
                    )}
                  </div>

                  <div className="customer-meta-grid">
                    <div className="customer-meta-item">
                      <span>Email:</span>
                      <strong>{profile.email || "—"}</strong>
                    </div>
                    <div className="customer-meta-item">
                      <span>Số điện thoại:</span>
                      <strong>{profile.phone || "Chưa cập nhật"}</strong>
                    </div>
                    <div className="customer-meta-item">
                      <span>Địa chỉ mặc định:</span>
                      <strong>{profile.address || "Chưa thiết lập địa chỉ"}</strong>
                    </div>
                    <div className="customer-meta-item">
                      <span>Ngày tham gia:</span>
                      <strong>{date(profile.createdAt)}</strong>
                    </div>
                    <div className="customer-meta-item">
                      <span>Chỉnh sửa gần nhất:</span>
                      <strong>{profile.updatedAt ? date(profile.updatedAt) : "Chưa cập nhật"}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Thống kê tổng số đơn hàng đã đặt và tổng số tiền đã chi tiêu tích lũy */}
              <div className="customer-stats-grid">
                <div className="customer-stat-card highlight">
                  <span>Tổng chi tiêu tích lũy</span>
                  <strong>{money(stats?.totalSpent || 0)}</strong>
                </div>
                <div className="customer-stat-card">
                  <span>Tổng số đơn đã đặt</span>
                  <strong>{stats?.totalOrders || 0} đơn</strong>
                </div>
                <div className="customer-stat-card">
                  <span>Đơn giao thành công</span>
                  <strong style={{ color: "#16a34a" }}>
                    {stats?.statusCounts?.completed || 0} đơn
                  </strong>
                </div>
                <div className="customer-stat-card">
                  <span>Đơn đang xử lý</span>
                  <strong style={{ color: "#f59e0b" }}>
                    {(stats?.statusCounts?.pending || 0) +
                      (stats?.statusCounts?.processing || 0) +
                      (stats?.statusCounts?.shipping || 0)}{" "}
                    đơn
                  </strong>
                </div>
              </div>

              {/* 3. Bảng danh sách toàn bộ các đơn hàng khách đã mua kèm liên kết xem chi tiết đơn */}
              <div className="customer-orders-section">
                <h4>
                  <span>Lịch sử đơn hàng ({orders.length})</span>
                  {orders.length > 0 && (
                    <small className="muted" style={{ fontWeight: "normal", fontSize: "12px" }}>
                      Sắp xếp mới nhất trước
                    </small>
                  )}
                </h4>

                {orders.length === 0 ? (
                  <div className="empty" style={{ padding: "24px 0" }}>
                    <strong>Khách hàng chưa có đơn hàng nào</strong>
                    <span>Lịch sử các đơn hàng được đặt sẽ hiển thị tại đây.</span>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Mã đơn / Ngày đặt</th>
                          <th>Sản phẩm</th>
                          <th>Tổng tiền</th>
                          <th>Thanh toán</th>
                          <th>Trạng thái</th>
                          <th className="align-right">Chi tiết</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((ord) => {
                          const itemCount =
                            ord.items?.reduce(
                              (acc, it) => acc + (it.quantity || 1),
                              0
                            ) || ord.items?.length || 0;
                          const firstItem = ord.items?.[0];
                          const firstName =
                            firstItem?.productName ||
                            firstItem?.product?.name ||
                            "Sản phẩm";
                          const summaryText =
                            ord.items?.length > 1
                              ? `${firstName} +${ord.items.length - 1} món khác`
                              : firstName;

                          return (
                            <tr key={ord._id}>
                              <td>
                                <strong>
                                  {ord.orderCode || ord._id.slice(-6).toUpperCase()}
                                </strong>
                                <br />
                                <small className="muted">{date(ord.createdAt)}</small>
                              </td>
                              <td>
                                <div className="items-summary-preview">
                                  <Photo
                                    src={firstItem?.productImage || firstItem?.product?.image}
                                    name={firstName}
                                  />
                                  <div>
                                    <div
                                      style={{
                                        maxWidth: "200px",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                      title={summaryText}
                                    >
                                      {summaryText}
                                    </div>
                                    <small>{itemCount} sản phẩm</small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <strong>
                                  {money(ord.totalAmount ?? ord.totalPrice ?? 0)}
                                </strong>
                              </td>
                              <td>
                                <span style={{ fontSize: "12px" }}>
                                  {ord.paymentMethod || "COD"}
                                </span>
                              </td>
                              <td>
                                <Badge>{ord.status}</Badge>
                              </td>
                              <td className="align-right">
                                <button
                                  type="button"
                                  onClick={() => setViewingOrderId(ord._id)}
                                  title="Xem chi tiết đơn hàng này"
                                >
                                  <Icon name="orders" size={14} />
                                  Xem đơn
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <footer>
          <button type="button" onClick={reload} title="Tải lại hồ sơ">
            Làm mới
          </button>
          <button type="button" className="primary" onClick={close}>
            Đóng
          </button>
        </footer>
      </Modal>

      {/* Modal xem chi tiết đơn hàng (tái sử dụng từ Orders.jsx) */}
      {viewingOrderId && (
        <OrderDetail
          id={viewingOrderId}
          user={user}
          close={() => setViewingOrderId(null)}
          saved={() => {
            reload();
            notify?.("Đã cập nhật trạng thái đơn hàng.");
          }}
        />
      )}
    </>
  );
}
