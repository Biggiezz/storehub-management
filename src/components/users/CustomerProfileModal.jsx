import { useState } from "react";
import { U, date, money } from "../../api";
import { Icon, Photo, Badge, Modal, State } from "../UI";
import { useResource } from "../../hooks";
import { OrderDetail } from "../../pages/Orders";
import { getRoleBadge } from "../../services/userAggregation";

export default function CustomerProfileModal({
  userId,
  user,
  close,
  notify,
  customerData,
}) {
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
                      <strong>
                        {profile.updatedAt ? date(profile.updatedAt) : "Chưa cập nhật"}
                      </strong>
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
                    <small
                      className="muted"
                      style={{ fontWeight: "normal", fontSize: "12px" }}
                    >
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
                            ) ||
                            ord.items?.length ||
                            0;
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
                                    src={
                                      firstItem?.productImage ||
                                      firstItem?.product?.image
                                    }
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

export { CustomerProfileModal };
