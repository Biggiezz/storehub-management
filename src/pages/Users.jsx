import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { U, O, request, query, isSuper } from "../api";
import { getCachedOrderSnapshot } from "../services/orderSearch";
import {
  normalizePhone,
  normalizeEmail,
  VIP_TIERS,
  getVipTier,
  buildCustomerUnionFind,
  getUserStats as computeUserStats,
} from "../services/userAggregation";
import CustomerProfileModal from "../components/users/CustomerProfileModal";
import UserBlockModal from "../components/users/UserBlockModal";
import UserEditModal from "../components/users/UserEditModal";
import UserFilters from "../components/users/UserFilters";
import UsersTable from "../components/users/UsersTable";

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
      // Fallback quét trực tiếp nếu getCachedOrderSnapshot trả lỗi
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

  // Gom nhóm dữ liệu đa kênh qua Union-Find service
  const { spendingMap, spendingMapByEmail, spendingMapByPhone, allSystemCustomers } =
    useMemo(() => {
      return buildCustomerUnionFind(
        allRegisteredUsersSnapshot,
        users,
        allOrdersSnapshot,
        pageCacheRef.current
      );
    }, [allRegisteredUsersSnapshot, users, allOrdersSnapshot]);

  const getUserStats = useCallback(
    (x) => computeUserStats(x, spendingMap, spendingMapByEmail, spendingMapByPhone),
    [spendingMap, spendingMapByEmail, spendingMapByPhone]
  );

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

  const hasVipFilters = Boolean(
    vipTierFilter || minSpentFilter !== "" || minOrdersFilter !== ""
  );

  function resetVipFilters() {
    setVipTierFilter("");
    setMinSpentFilter("");
    setMinOrdersFilter("");
    setVipPage(1);
  }

  const allFilteredVipCustomers = useMemo(() => {
    if (!hasVipFilters) return [];
    const querySearch = term.toLowerCase().trim();

    return allSystemCustomers
      .filter((c) => {
        if (filter === "customer" && c.isStaffOrAdmin) return false;
        if (filter === "staff" && !c.isStaffOrAdmin) return false;

        const stats = getUserStats(c);
        const tier = getVipTier(stats.totalSpent, stats.completedOrdersCount);

        if (vipTierFilter === "top_spent") {
          if (stats.totalSpent <= 0 && stats.totalOrdersCount <= 0) {
            return false;
          }
        } else if (vipTierFilter && tier.key !== vipTierFilter) {
          return false;
        }

        if (minSpentFilter !== "") {
          const minVal = Number(minSpentFilter);
          if (isNaN(minVal) || stats.totalSpent < minVal) {
            return false;
          }
        }

        if (minOrdersFilter !== "") {
          const minO = Number(minOrdersFilter);
          if (isNaN(minO) || stats.completedOrdersCount < minO) {
            return false;
          }
        }

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
    getUserStats,
  ]);

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
        <UserFilters
          search={search}
          setSearch={setSearch}
          term={term}
          setTerm={setTerm}
          filter={filter}
          setFilter={setFilter}
          setPage={setPage}
          vipTierFilter={vipTierFilter}
          setVipTierFilter={setVipTierFilter}
          minSpentFilter={minSpentFilter}
          setMinSpentFilter={setMinSpentFilter}
          minOrdersFilter={minOrdersFilter}
          setMinOrdersFilter={setMinOrdersFilter}
          setVipPage={setVipPage}
          hasVipFilters={hasVipFilters}
          resetVipFilters={resetVipFilters}
          onExportCsv={handleExportVipCsv}
        />

        <UsersTable
          displayedUsers={displayedUsers}
          currentUser={user}
          loading={loading}
          error={error}
          hasVipFilters={hasVipFilters}
          allFilteredVipCustomers={allFilteredVipCustomers}
          users={users}
          page={page}
          setPage={setPage}
          vipPage={vipPage}
          setVipPage={setVipPage}
          vipTotalPages={vipTotalPages}
          hasNext={hasNext}
          onRefresh={() => {
            loadUsers(page, term, filter, true);
            loadOrdersSnapshot(true);
            loadAllRegisteredUsers();
          }}
          onViewProfile={(cust) => setProfileCustomer(cust)}
          onEditUser={(u) => {
            setSelectedUser(u);
            setEditError("");
            setEditModalOpen(true);
          }}
          onOpenLockModal={(u, isUnlock) => {
            setSelectedUser(u);
            if (!isUnlock) setLockReason("");
            setLockModalOpen(true);
          }}
          getUserStats={getUserStats}
        />
      </div>

      <UserBlockModal
        selectedUser={selectedUser}
        busy={busy}
        lockReason={lockReason}
        setLockReason={setLockReason}
        close={() => {
          setLockModalOpen(false);
          setSelectedUser(null);
        }}
        onConfirm={handleToggleBlock}
      />

      <UserEditModal
        selectedUser={selectedUser}
        currentUser={user}
        busy={busy}
        editError={editError}
        setEditError={setEditError}
        close={() => {
          setEditModalOpen(false);
          setSelectedUser(null);
          setEditError("");
        }}
        onSave={handleSaveEdit}
      />

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

export {
  CustomerProfileModal,
  getVipTier,
  VIP_TIERS,
  normalizePhone,
  normalizeEmail,
};
