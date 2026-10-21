import { useState } from "react";
import { O, request, money, date, nextStatuses } from "../../api";
import { State, Badge, Modal, Photo, Field } from "../UI";
import { CANCEL_REASONS } from "../../services/orderSearch";
import { useResource } from "../../hooks";

export default function OrderDetailModal({ id, user, close, saved }) {
  const { data, loading, error, reload } = useResource(
    `${O}/admin/orders/${id}`
  );
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const o = data?.data;

  function handleStatusChange(e) {
    const nextStatus = e.target.value;
    setConfirmation(nextStatus);
    setSelectedReason("");
    setCustomReason("");
    setReasonError("");
    setActionError("");
  }

  async function update() {
    if (confirmation === "Đã hủy") {
      if (!selectedReason) {
        setReasonError("Vui lòng chọn lý do hủy đơn hàng.");
        return;
      }
      if (selectedReason === "Lý do khác" && !customReason.trim()) {
        setReasonError("Vui lòng nhập chi tiết lý do hủy đơn hàng.");
        return;
      }
    }

    setBusy(true);
    setActionError("");
    setReasonError("");

    const finalCancelReason =
      confirmation === "Đã hủy"
        ? selectedReason === "Lý do khác"
          ? customReason.trim()
          : selectedReason
        : undefined;

    try {
      const body = { status: confirmation };
      if (finalCancelReason) {
        body.cancelReason = finalCancelReason;
      }

      await request(`${O}/admin/orders/${id}/status`, {
        method: "PUT",
        body,
      });

      setConfirmation("");
      setSelectedReason("");
      setCustomReason("");
      reload();
      saved();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Đơn hàng ${o?.orderCode || ""}`} close={close} busy={busy}>
      <div className="modal-body">
        <State {...{ loading, error }} retry={reload} />
        {o && (
          <>
            <div className="section-head">
              <Badge>{o.status}</Badge>
              <span className="muted">{date(o.createdAt)}</span>
            </div>
            <div className="detail-recipient">
              <h3>Thông tin giao hàng</h3>
              <strong>{o.receiverName || o.user?.name}</strong>
              <p>{o.receiverPhone}</p>
              <p>{o.deliveryAddress || "Chưa có địa chỉ"}</p>
              <small>{o.user?.email}</small>
            </div>
            <h3>Sản phẩm trong đơn</h3>
            {(o.items || []).map((i, idx) => (
              <div className="order-item" key={i._id || idx}>
                <Photo
                  src={i.productImage || i.product?.image}
                  name={i.productName}
                />
                <div>
                  <strong>
                    {i.productName || i.product?.name || "Sản phẩm đã xóa"}
                  </strong>
                  <small>
                    {i.colorName || i.color?.name || "—"} · SL: {i.quantity}
                  </small>
                </div>
                <strong>{money((i.price || 0) * (i.quantity || 0))}</strong>
              </div>
            ))}
            <div className="totals">
              <p>
                <span>Tạm tính</span>
                <strong>{money(o.subtotal ?? o.totalPrice)}</strong>
              </p>
              <p>
                <span>Phí vận chuyển</span>
                <strong>{money(o.shippingFee)}</strong>
              </p>
              <p>
                <span>Giảm giá</span>
                <strong>−{money(o.discount)}</strong>
              </p>
              <p className="total">
                <span>Tổng cộng</span>
                <strong>{money(o.totalAmount ?? o.totalPrice)}</strong>
              </p>
              <small>
                Phương thức: {o.paymentMethod} · Phương thức thanh toán không
                xác nhận đã thu tiền.
              </small>
            </div>

            {/* US20 AC1: Hiển thị lý do hủy rõ ràng trên chi tiết đơn hàng sau khi hủy */}
            {o.cancelReason ? (
              <div className="cancel-reason-alert" role="alert">
                <div className="cancel-reason-header">
                  <span className="cancel-reason-icon">✕</span>
                  <strong>Đơn hàng đã hủy</strong>
                </div>
                <div className="cancel-reason-content">
                  <span className="cancel-reason-label">Lý do hủy:</span>
                  <span className="cancel-reason-text">{o.cancelReason}</span>
                </div>
              </div>
            ) : o.status === "Đã hủy" ? (
              <div className="cancel-reason-alert" role="alert">
                <div className="cancel-reason-header">
                  <span className="cancel-reason-icon">✕</span>
                  <strong>Đơn hàng đã hủy</strong>
                </div>
              </div>
            ) : null}

            {o.disputeReason && (
              <p className="error">Khiếu nại: {o.disputeReason}</p>
            )}

            {nextStatuses(o.status, user).length > 0 && (
              <div className="status-form">
                <Field label="Chuyển trạng thái">
                  <select
                    value={confirmation}
                    disabled={busy}
                    onChange={handleStatusChange}
                  >
                    <option value="">Chọn trạng thái tiếp theo</option>
                    {nextStatuses(o.status, user).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>

                {confirmation && (
                  <>
                    {/* US20 AC1: Form yêu cầu nhập lý do hủy bắt buộc khi chọn "Đã hủy" */}
                    {confirmation === "Đã hủy" && (
                      <div className="cancel-form-section">
                        <Field label="Lý do hủy đơn hàng (bắt buộc)">
                          <select
                            value={selectedReason}
                            disabled={busy}
                            onChange={(e) => {
                              setSelectedReason(e.target.value);
                              setReasonError("");
                            }}
                          >
                            <option value="">-- Chọn lý do hủy đơn --</option>
                            {CANCEL_REASONS.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </Field>

                        {selectedReason === "Lý do khác" && (
                          <Field label="Nhập lý do hủy cụ thể (bắt buộc)">
                            <textarea
                              value={customReason}
                              disabled={busy}
                              onChange={(e) => {
                                setCustomReason(e.target.value);
                                setReasonError("");
                              }}
                              placeholder="Vui lòng nhập lý do hủy chi tiết tại đây..."
                              rows={3}
                              maxLength={500}
                            />
                          </Field>
                        )}

                        {reasonError && (
                          <p className="error cancel-error-msg" role="alert">
                            {reasonError}
                          </p>
                        )}
                      </div>
                    )}

                    <p className="footnote">
                      Xác nhận chuyển sang <strong>{confirmation}</strong>?{" "}
                      {confirmation === "Đã hủy" &&
                        "Hệ thống sẽ cập nhật trạng thái hủy, hoàn trả số lượng sản phẩm vào kho và xử lý hoàn tiền nếu có."}
                    </p>
                    <button
                      className={
                        confirmation === "Đã hủy" ? "danger" : "primary"
                      }
                      disabled={busy}
                      onClick={update}
                    >
                      {busy
                        ? "Đang cập nhật…"
                        : confirmation === "Đã hủy"
                        ? "Xác nhận hủy đơn hàng"
                        : "Xác nhận cập nhật"}
                    </button>
                  </>
                )}
              </div>
            )}
            {actionError && (
              <p className="error" role="alert">
                {actionError}
              </p>
            )}
          </>
        )}
      </div>
      <footer>
        <button onClick={close} disabled={busy}>
          Đóng
        </button>
      </footer>
    </Modal>
  );
}

export { OrderDetailModal as OrderDetail };
