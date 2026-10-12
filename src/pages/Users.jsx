import { useState, useEffect, useRef, useCallback } from "react";
import { U, request, query, date, isSuper, roleOf } from "../api";
import { Icon, Photo, Badge, Modal, Field, State } from "../components/UI";

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

  // Modals state
  const [selectedUser, setSelectedUser] = useState(null);
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [lockReason, setLockReason] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Client-side Page Cache: key = `${filter}::${term}::${page}`
  const pageCacheRef = useRef({});

  const loadUsers = useCallback(
    async (targetPage = page, queryTerm = term, typeFilter = filter, forceRefresh = false) => {
      const cacheKey = `${typeFilter}::${(queryTerm || "").trim()}::${targetPage}`;

      // Nếu đã có trong cache và không phải forceRefresh: lấy ngay từ cache, không fetch lại
      if (!forceRefresh && pageCacheRef.current[cacheKey]) {
        setUsers(pageCacheRef.current[cacheKey]);
        setLoading(false);
        setError("");
        return;
      }

      // Kích hoạt lazy load khi vào lần đầu hoặc sang trang chưa có trong cache
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

  // Chỉnh sửa thông tin người dùng (US29 / US32)
  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!selectedUser) return;
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const updateData = {
      name: form.get("name")?.trim(),
      phone: form.get("phone")?.trim() || "",
      address: form.get("address")?.trim() || "",
    };
    if (isSuper(user)) {
      updateData.role = form.get("role");
    }
    try {
      await request(U + `/update-user/${selectedUser._id}`, {
        method: "PUT",
        body: updateData,
      });
      notify("Đã cập nhật thông tin người dùng thành công.");
      updateUserInCacheAndState(selectedUser._id, updateData);
      setEditModalOpen(false);
      setSelectedUser(null);
    } catch (err) {
      notify(err.message || "Cập nhật thất bại.");
    } finally {
      setBusy(false);
    }
  }

  const hasNext = users.length === 10;

  return (
    <>
      <div className="welcome">
        <div>
          <span className="eyebrow">CỬA HÀNG / NGƯỜI DÙNG</span>
          <h1>Quản lý Người dùng</h1>
          <p>Quản lý tài khoản khách hàng, phân quyền nhân sự và kiểm soát vi phạm.</p>
        </div>
      </div>

      <div className="card">
        {/* Toolbar: Tìm kiếm & Bộ lọc */}
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
        </div>

        {/* List Heading */}
        <div className="list-heading">
          <span>
            {users.length > 0
              ? `${users.length} người dùng trong trang này · Trang ${page}`
              : `Trang ${page}`}
          </span>
          <div className="actions">
            <button
              onClick={() => loadUsers(page, term, filter, true)}
              aria-label="Làm mới danh sách"
              title="Làm mới danh sách"
            >
              <Icon name="refresh" size={16} />
            </button>
          </div>
        </div>

        {/* State: Lazy load & Error & Empty */}
        <State
          loading={loading}
          error={error}
          empty={!loading && !error && users.length === 0}
          retry={() => loadUsers(page, term, filter, true)}
        />

        {/* Bảng danh sách người dùng */}
        {!loading && !error && users.length > 0 && (
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
                {users.map((x) => {
                  const isSelf = user?._id === x._id || user?.id === x._id;
                  const targetRole = roleOf(x);
                  const isTargetSuper = targetRole === "superadmin" || targetRole === "quảntrịviêntốicao";
                  const canManageLock = isSuper(user) && !isSelf && !isTargetSuper;
                  const roleInfo = getRoleBadge(x.role);

                  return (
                    <tr key={x._id}>
                      <td>
                        <div className="identity">
                          <Photo src={x.image} name={x.name || x.email} />
                          <div>
                            <strong>
                              {x.name || "—"} {isSelf && <small style={{ color: "#3568e8" }}>(Bạn)</small>}
                            </strong>
                            <small>{x.email || "—"}</small>
                          </div>
                        </div>
                      </td>
                      <td>{x.phone || "—"}</td>
                      <td>
                        <Badge tone={roleInfo.tone}>{roleInfo.label}</Badge>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                backgroundColor: x.isOnline ? "#10b981" : "#94a3b8",
                                display: "inline-block",
                              }}
                            />
                            {formatLastActive(x.lastActive, !!x.isOnline)}
                          </span>
                          {x.isBlocked && (
                            <span title={x.blockReason ? `Lý do: ${x.blockReason}` : "Tài khoản bị khóa"}>
                              <Badge tone="red">
                                Đã khóa {x.blockReason ? `(${x.blockReason})` : ""}
                              </Badge>
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{date(x.createdAt)}</td>
                      <td className="align-right">
                        <div className="actions end">
                          <button
                            onClick={() => {
                              setSelectedUser(x);
                              setEditModalOpen(true);
                            }}
                            title="Chỉnh sửa thông tin"
                          >
                            <Icon name="edit" size={14} />
                            Sửa
                          </button>

                          {canManageLock &&
                            (x.isBlocked ? (
                              <button
                                style={{ color: "#10b981" }}
                                onClick={() => {
                                  setSelectedUser(x);
                                  setLockModalOpen(true);
                                }}
                                title="Mở khóa tài khoản"
                              >
                                <Icon name="unlock" size={14} />
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
                                <Icon name="lock" size={14} />
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

        {/* Phân trang: Trước / Sau với Lazy load & Cache */}
        {!loading && users.length > 0 && (
          <div className="pager">
            <span>
              {users.length} người dùng · Trang {page}
            </span>
            <div>
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                ← Trước
              </button>
              <button disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
                Sau →
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

      {/* Modal Chỉnh sửa thông tin người dùng */}
      {editModalOpen && selectedUser && (
        <Modal
          title="Chỉnh sửa người dùng"
          close={() => {
            if (!busy) {
              setEditModalOpen(false);
              setSelectedUser(null);
            }
          }}
          busy={busy}
        >
          <form onSubmit={handleSaveEdit}>
            <div className="modal-body form-grid">
              <Field label="Họ và tên *">
                <input
                  name="name"
                  required
                  defaultValue={selectedUser.name || ""}
                  placeholder="Nhập họ và tên..."
                />
              </Field>
              <Field label="Email (Không thể thay đổi)">
                <input value={selectedUser.email || ""} disabled />
              </Field>
              <div className="two-col">
                <Field label="Số điện thoại">
                  <input
                    name="phone"
                    defaultValue={selectedUser.phone || ""}
                    placeholder="VD: 0912345678"
                  />
                </Field>
                <Field label="Vai trò hệ thống">
                  {isSuper(user) ? (
                    <select name="role" defaultValue={selectedUser.role || "customer"}>
                      <option value="customer">Khách hàng (customer)</option>
                      <option value="admin">Quản trị viên (admin)</option>
                      <option value="superadmin">Quản trị tối cao (superadmin)</option>
                    </select>
                  ) : (
                    <input value={selectedUser.role || "customer"} disabled />
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
            </div>
            <footer>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditModalOpen(false);
                  setSelectedUser(null);
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
    </>
  );
}
