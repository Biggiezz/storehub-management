import { useEffect, useState, useMemo, useCallback } from "react";
import { useResource } from "../hooks";
import { O, request, money, date, nextStatuses } from "../api";
import {
  State,
  Pager,
  Badge,
  Modal,
  Photo,
  Field,
  Icon,
} from "../components/UI";
import {
  EMPTY_ORDER_FILTERS,
  ORDER_STATUSES,
  ORDER_TABS,
  ORDER_PAYMENT_METHODS,
  CANCEL_REASONS,
  countOrdersByTab,
  validateOrderFilters,
  hasOrderFilters,
  fetchOrderSnapshot,
  getCachedOrderSnapshot,
  clearOrdersSnapshotCache,
  filterOrders,
} from "../services/orderSearch";
import { clearOrdersCache } from "../services/dashboardStats";

export default function Orders({ user, notify }) {
  const [draft, setDraft] = useState({ ...EMPTY_ORDER_FILTERS }),
    [applied, setApplied] = useState({ ...EMPTY_ORDER_FILTERS });
  const [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const set = (key) => (e) => setDraft({ ...draft, [key]: e.target.value });
  function apply(e) {
    e.preventDefault();
    const next = Object.fromEntries(
      Object.entries(draft).map(([k, v]) => [k, v.trim()]),
    );
    const message = validateOrderFilters(next);
    setError(message);
    if (!message) {
      setApplied(next);
      setRevision((v) => v + 1);
    }
  }
  function reset() {
    setDraft({ ...EMPTY_ORDER_FILTERS });
    setApplied({ ...EMPTY_ORDER_FILTERS });
    setError("");
    setRevision((v) => v + 1);
  }
  return (
    <>
      <div className="welcome">
        <div>
          <span className="eyebrow">CỬA HÀNG / ĐƠN HÀNG</span>
          <h1>Đơn hàng</h1>
          <p>Quản lý đơn hàng theo quy trình vận hành và lọc theo mã đơn, khách hàng, ngày đặt.</p>
        </div>
      </div>
      <form className="card filter-panel" onSubmit={apply}>
        <div className="section-head">
          <h2>Tìm kiếm và lọc đơn hàng</h2>
        </div>
        <div className="filter-grid order-filter-grid">
          <Field label="Mã đơn hàng">
            <input
              value={draft.orderCode}
              onChange={set("orderCode")}
              placeholder="Ví dụ: SH-12345"
              maxLength={100}
            />
          </Field>
          <Field label="Khách hàng">
            <input
              value={draft.customer}
              onChange={set("customer")}
              placeholder="Tên, email hoặc số điện thoại"
              maxLength={200}
            />
          </Field>
          <Field label="Từ ngày">
            <input
              type="date"
              value={draft.fromDate}
              onChange={set("fromDate")}
            />
          </Field>
          <Field label="Đến ngày">
            <input type="date" value={draft.toDate} onChange={set("toDate")} />
          </Field>
          <Field label="Phương thức thanh toán">
            <select
              value={draft.paymentMethod}
              onChange={set("paymentMethod")}
            >
              <option value="">Tất cả phương thức</option>
              {ORDER_PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="filter-footer">
          <span>
            Ngày đặt tính theo giờ Việt Nam (UTC+7), bao gồm cả ngày kết thúc.
          </span>
          <div className="actions">
            <button type="button" onClick={reset}>
              Xóa bộ lọc
            </button>
            <button className="primary" type="submit">
              Áp dụng bộ lọc
            </button>
          </div>
        </div>
      </form>
      <OrderResults
        key={revision}
        filters={applied}
        onClearSearch={reset}
        {...{ user, notify }}
      />
    </>
  );
}
function OrderResults({ filters, user, notify, onClearSearch }) {
  const [activeTab, setActiveTab] = useState("all");
  const [tabAnimKey, setTabAnimKey] = useState(0);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [state, setState] = useState({
    loading: true,
    error: "",
    allOrders: [],
  });

  const loadData = useCallback(async (forceRefresh = false) => {
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      if (forceRefresh) {
        clearOrdersSnapshotCache();
        clearOrdersCache();
      }
      const data = await getCachedOrderSnapshot({ forceRefresh });
      setState({
        loading: false,
        error: "",
        allOrders: Array.isArray(data) ? data : [],
      });
    } catch (err) {
      setState({
        loading: false,
        error: err.message || "Không thể tải danh sách đơn hàng.",
        allOrders: [],
      });
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData, reloadKey]);

  function reload() {
    setPage(1);
    loadData(true);
  }

  // Đếm số lượng đơn hàng theo từng Tab trạng thái vận hành chuẩn
  const tabCounts = useMemo(
    () => countOrdersByTab(state.allOrders),
    [state.allOrders]
  );

  const currentTab = useMemo(
    () => ORDER_TABS.find((t) => t.id === activeTab) || ORDER_TABS[0],
    [activeTab]
  );

  // Lọc danh sách theo Tab đang chọn kết hợp bộ lọc tìm kiếm
  const filteredRows = useMemo(() => {
    if (!state.allOrders.length) return [];
    const effectiveFilters = {
      ...filters,
      status: currentTab.statuses,
    };
    try {
      return filterOrders(state.allOrders, effectiveFilters);
    } catch {
      return [];
    }
  }, [state.allOrders, filters, currentTab]);

  const hasSearch = hasOrderFilters(filters);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  function handleTabClick(tabId) {
    if (tabId === activeTab) return;
    setActiveTab(tabId);
    setPage(1);
    setTabAnimKey((k) => k + 1);
  }

  function goPage(next) {
    setPage(next);
  }

  return (
    <section className="card order-results-card">
      {/* 1. Thanh điều hướng 5 Tab vận hành chuẩn + 1 Tab phụ */}
      <div className="order-tabs-wrapper">
        <div
          className="order-tabs"
          role="tablist"
          aria-label="Thanh điều hướng trạng thái vận hành đơn hàng"
        >
          {ORDER_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const count = tabCounts[tab.id] ?? 0;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                data-tab-id={tab.id}
                data-tab-index={tab.operationalIndex ?? 0}
                className={`order-tab-btn ${isActive ? "active" : ""} ${
                  tab.isAuxiliary ? "auxiliary" : ""
                }`}
                onClick={() => handleTabClick(tab.id)}
              >
                <span className="order-tab-label">{tab.label}</span>
                <span
                  className={`order-tab-badge tone-${tab.badgeTone} ${
                    isActive ? "badge-active" : ""
                  }`}
                  title={`${count} đơn hàng`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Tiêu đề danh sách và nút tải lại */}
      <div className="list-heading">
        <div>
          <strong className="order-list-heading-title">
            {currentTab.label}
            {hasSearch && " · Đã áp dụng bộ lọc tìm kiếm"}
          </strong>
          <small className="block">
            Hiển thị {pageRows.length} trên {filteredRows.length} đơn hàng
            {state.allOrders.length > 0 &&
              ` (Tổng số: ${state.allOrders.length} đơn trên toàn hệ thống)`}
          </small>
        </div>
        <div className="actions">
          {hasSearch && onClearSearch && (
            <button type="button" onClick={onClearSearch}>
              Xóa tìm kiếm
            </button>
          )}
          <button onClick={reload} disabled={state.loading}>
            Tải lại
          </button>
        </div>
      </div>

      {/* 3. Nội dung bảng danh sách có animation mượt mà khi đổi Tab */}
      <div
        key={activeTab + "-" + tabAnimKey}
        className="order-tab-pane tab-fade-in"
      >
        <State
          loading={state.loading}
          error={state.error}
          retry={reload}
          empty={!state.loading && !state.error && !pageRows.length}
        />
        {!state.loading && !state.error && !!pageRows.length && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mã đơn / Ngày đặt</th>
                  <th>Khách hàng</th>
                  <th>Tổng tiền</th>
                  <th>Thanh toán</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((o) => (
                  <tr key={o._id}>
                    <td>
                      <strong className="order-code">
                        {o.orderCode || o._id.slice(-8)}
                      </strong>
                      <small className="block">
                        {o.createdAt
                          ? new Date(o.createdAt).toLocaleString("vi-VN", {
                              timeZone: "Asia/Ho_Chi_Minh",
                            })
                          : "—"}
                      </small>
                    </td>
                    <td>
                      <strong>{o.receiverName || o.user?.name || "—"}</strong>
                      <small className="block">
                        {o.receiverPhone || o.user?.phone || "—"}
                      </small>
                    </td>
                    <td className="strong nowrap">
                      {money(o.totalAmount ?? o.totalPrice)}
                    </td>
                    <td>{o.paymentMethod}</td>
                    <td>
                      <Badge>{o.status}</Badge>
                    </td>
                    <td>
                      <button onClick={() => setSelected(o._id)}>
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Phân trang */}
      {!state.loading && !state.error && (
        <Pager
          page={page}
          setPage={goPage}
          total={filteredRows.length}
          hasNext={page < totalPages}
        />
      )}

      {/* 5. Modal chi tiết đơn hàng */}
      {selected && (
        <OrderDetail
          id={selected}
          user={user}
          close={() => setSelected(null)}
          saved={() => {
            reload();
            notify("Đã cập nhật trạng thái đơn hàng.");
          }}
        />
      )}
    </section>
  );
}
export function OrderDetail({ id, user, close, saved }) {
  const { data, loading, error, reload } = useResource(
    `${O}/admin/orders/${id}`,
  );
  const [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState(""),
    [confirmation, setConfirmation] = useState("");
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
