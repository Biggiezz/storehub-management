import { useEffect, useState } from "react";
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
  validateOrderFilters,
  hasOrderFilters,
  fetchOrderSnapshot,
  filterOrders,
} from "../services/orderSearch";

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
          <p>Tìm đúng đơn hàng theo mã đơn, khách hàng và thời gian đặt.</p>
        </div>
      </div>
      <form className="card filter-panel" onSubmit={apply}>
        <div className="section-head">
          <h2>Tìm kiếm và lọc đơn hàng</h2>
        </div>
        <div className="filter-grid">
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
          <Field label="Trạng thái đơn">
            <select value={draft.status} onChange={set("status")}>
              <option value="">Tất cả trạng thái</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s}>{s}</option>
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
            <button className="primary">
              <Icon name="search" size={17} />
              Áp dụng bộ lọc
            </button>
          </div>
        </div>
      </form>
      <OrderResults
        key={JSON.stringify(applied) + revision}
        filters={applied}
        {...{ user, notify }}
      />
    </>
  );
}
function OrderResults({ filters, user, notify }) {
  const [selected, setSelected] = useState(null),
    [revision, setRevision] = useState(0),
    [page, setPage] = useState(1);
  const [state, setState] = useState({
    loading: true,
    error: "",
    rows: [],
    total: 0,
    pages: 0,
  });
  const [progress, setProgress] = useState(null);
  const filtered = hasOrderFilters(filters);
  // Filtered result pages reuse a single complete snapshot; they never re-fetch all pages.
  const remotePage = filtered ? 1 : page;
  useEffect(() => {
    const abort = new AbortController();
    const load = async () => {
      try {
        if (filtered) {
          const all = await fetchOrderSnapshot({
            signal: abort.signal,
            onProgress: (value) => {
              if (!abort.signal.aborted) setProgress(value);
            },
          });
          const rows = filterOrders(all, filters);
          if (!abort.signal.aborted)
            setState({
              loading: false,
              error: "",
              rows,
              total: rows.length,
              pages: Math.ceil(rows.length / 10),
              scanned: all.length,
            });
        } else {
          const result = await request(
            `${O}/admin/orders?page=${remotePage}&limit=10`,
            { signal: abort.signal },
          );
          if (!Array.isArray(result.data))
            throw new Error("Danh sách đơn hàng không hợp lệ.");
          if (!abort.signal.aborted)
            setState({
              loading: false,
              error: "",
              rows: result.data,
              total: result.pagination?.totalProducts,
              pages: result.pagination?.totalPages || 1,
            });
        }
      } catch (err) {
        if (!abort.signal.aborted)
          setState({
            loading: false,
            error: err.message,
            rows: [],
            total: 0,
            pages: 0,
          });
      }
    };
    load();
    return () => abort.abort();
  }, [filters, filtered, remotePage, revision]);
  function reload() {
    setState({ loading: true, error: "", rows: [], total: 0, pages: 0 });
    setProgress(null);
    setPage(1);
    setRevision((v) => v + 1);
  }
  function goPage(next) {
    if (!filtered)
      setState({ loading: true, error: "", rows: [], total: 0, pages: 0 });
    setPage(next);
  }
  const rows = filtered
    ? state.rows.slice((page - 1) * 10, page * 10)
    : state.rows;
  return (
    <section className="card">
      <div className="list-heading">
        <div>
          <strong>
            {filtered ? "Kết quả theo bộ lọc đã áp dụng" : "Tất cả đơn hàng"}
          </strong>
          {filtered && (
            <small className="block">
              {state.scanned != null && ` Đã kiểm tra ${state.scanned} đơn.`}
            </small>
          )}
        </div>
        <button onClick={reload} disabled={state.loading}>
          <Icon name="refresh" size={16} />
          Tải lại
        </button>
      </div>
      {filtered && state.loading && progress && (
        <p className="filter-progress" role="status">
          Đã tải {progress.loaded}/{progress.total} đơn hàng… Chỉ hiển thị kết
          quả khi tải đủ dữ liệu.
        </p>
      )}
      <State
        loading={state.loading}
        error={state.error}
        retry={reload}
        empty={!state.loading && !state.error && !rows.length}
      />
      {!state.loading && !state.error && !!rows.length && (
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
              {rows.map((o) => (
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
                      Chi tiết →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!state.loading && !state.error && (
        <Pager
          page={page}
          setPage={goPage}
          total={state.total}
          hasNext={page < state.pages}
        />
      )}
      {filtered && (
        <p className="compat-note">
          Chế độ tương thích: bộ lọc hiện xử lý trên trình duyệt sau khi tải dữ
          liệu. Với hơn 5.000 đơn.
        </p>
      )}
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
  const o = data?.data;
  async function update() {
    setBusy(true);
    setActionError("");
    try {
      await request(`${O}/admin/orders/${id}/status`, {
        method: "PUT",
        body: { status: confirmation },
      });
      setConfirmation("");
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
            {o.cancelReason && (
              <p className="error">Lý do hủy: {o.cancelReason}</p>
            )}
            {o.disputeReason && (
              <p className="error">Khiếu nại: {o.disputeReason}</p>
            )}
            {nextStatuses(o.status, user).length > 0 && (
              <div className="status-form">
                <Field label="Chuyển trạng thái">
                  <select
                    value={confirmation}
                    disabled={busy}
                    onChange={(e) => setConfirmation(e.target.value)}
                  >
                    <option value="">Chọn trạng thái tiếp theo</option>
                    {nextStatuses(o.status, user).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                {confirmation && (
                  <>
                    <p className="footnote">
                      Xác nhận chuyển sang <strong>{confirmation}</strong>?{" "}
                      {confirmation === "Đã hủy" &&
                        "BE sẽ hoàn tồn kho và có thể gọi hoàn tiền ZaloPay."}
                    </p>
                    <button
                      className={
                        confirmation === "Đã hủy" ? "danger" : "primary"
                      }
                      disabled={busy}
                      onClick={update}
                    >
                      {busy ? "Đang cập nhật…" : "Xác nhận cập nhật"}
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
