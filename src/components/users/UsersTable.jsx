import { date, money, isSuper, roleOf } from "../../api";
import { Icon, Photo, Badge, State } from "../UI";
import {
  getVipTier,
  getRoleBadge,
  formatLastActive,
} from "../../services/userAggregation";

export default function UsersTable({
  displayedUsers = [],
  currentUser,
  loading,
  error,
  hasVipFilters,
  allFilteredVipCustomers = [],
  users = [],
  page,
  setPage,
  vipPage,
  setVipPage,
  vipTotalPages,
  hasNext,
  onRefresh,
  onViewProfile,
  onEditUser,
  onOpenLockModal,
  getUserStats,
}) {
  return (
    <>
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
            onClick={onRefresh}
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
        retry={onRefresh}
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
                const isSelf = currentUser?._id === x._id || currentUser?.id === x._id;
                const targetRole = roleOf(x);
                const isTargetSuper =
                  targetRole === "superadmin" ||
                  targetRole === "quảntrịviêntốicao";
                const canManageLock =
                  isSuper(currentUser) &&
                  !isSelf &&
                  !isTargetSuper &&
                  Boolean(x.registeredUserId || !String(x._id).startsWith("cust-"));
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
                        onClick={() => onViewProfile(x)}
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
                            {(isCustomer ||
                              stats.totalSpent > 0 ||
                              stats.completedOrdersCount > 0) && (
                              <span
                                className={`vip-badge ${tier.badgeClass}`}
                                title={`Hạng ${tier.name} · Chi tiêu: ${money(
                                  stats.totalSpent
                                )} · ${stats.completedOrdersCount} đơn hoàn thành`}
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
                      {(isCustomer ||
                        stats.totalSpent > 0 ||
                        stats.completedOrdersCount > 0) && (
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
                          onClick={() => onViewProfile(x)}
                          title="Xem chi tiết hồ sơ & lịch sử đơn hàng"
                        >
                          Hồ sơ
                        </button>

                        <button
                          onClick={() => onEditUser(x)}
                          title="Chỉnh sửa thông tin"
                        >
                          Sửa
                        </button>

                        {canManageLock &&
                          (x.isBlocked ? (
                            <button
                              style={{ color: "#16a34a" }}
                              onClick={() => onOpenLockModal(x, true)}
                              title="Mở khóa tài khoản"
                            >
                              Mở khóa
                            </button>
                          ) : (
                            <button
                              className="danger-link"
                              onClick={() => onOpenLockModal(x, false)}
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
      {!loading &&
        (hasVipFilters
          ? allFilteredVipCustomers.length > 0
          : users.length > 0) && (
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
    </>
  );
}
