import { useState } from "react";
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
export default function Orders({ user, notify }) {
  const [page, setPage] = useState(1);
  return <OrderList key={page} {...{ page, setPage, user, notify }} />;
}
function OrderList({ page, setPage, user, notify }) {
  const { data, loading, error, reload } = useResource(
    `${O}/admin/orders?page=${page}&limit=10`,
  );
  const [selected, setSelected] = useState(null),
    [search, setSearch] = useState(""),
    [statusFilter, setStatusFilter] = useState("");
  const rows = (data?.data || []).filter((x) => {
    const keyword = search.trim().toLowerCase();

    const matchesSearch =
      `${x.orderCode || ""} ${x.receiverName || ""} ${x.receiverPhone || ""}`
        .toLowerCase()
        .includes(keyword);

    const matchesStatus = !statusFilter || x.status === statusFilter;

    return matchesSearch && matchesStatus;
  });
  return (
    <div className="card">
      <div className="toolbar">
        <div className="searchbox">
          <Icon name="search" />
          <input
            aria-label="Tìm đơn hàng trong trang"
            placeholder="Tìm mã đơn, khách hàng trong trang này…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          aria-label="Lọc theo trạng thái đơn hàng"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="Chờ xác nhận">Chờ xác nhận</option>
          <option value="Đã xác nhận">Đã xác nhận</option>
          <option value="Đã rời kho">Đã rời kho</option>
          <option value="Đang giao hàng">Đang giao hàng</option>
          <option value="Đã giao hàng">Đã giao hàng</option>
          <option value="Đã hoàn thành">Đã hoàn thành</option>
          <option value="Khiếu nại">Khiếu nại</option>
          <option value="Đã hủy">Đã hủy</option>
        </select>

        <button onClick={reload}>
          <Icon name="refresh" size={16} />
          Tải lại
        </button>
      </div>
      <State
        {...{ loading, error }}
        retry={reload}
        empty={!loading && !error && !rows.length}
      />
      {!loading && !error && !!rows.length && (
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
                    <small className="block">{date(o.createdAt)}</small>
                  </td>
                  <td>
                    <strong>{o.receiverName || o.user?.name || "—"}</strong>
                    <small className="block">{o.receiverPhone || "—"}</small>
                  </td>
                  <td className="strong nowrap">
                    {money(o.totalAmount ?? o.totalPrice)}
                  </td>
                  <td>{o.paymentMethod}</td>
                  <td>
                    <Badge>{o.status}</Badge>
                  </td>
                  <td>
                    <button onClick={() => setSelected(o._id)}>Chi tiết</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && (
        <Pager
          page={page}
          setPage={setPage}
          total={data.pagination?.totalProducts}
          hasNext={page < data.pagination?.totalPages}
        />
      )}{" "}
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
    </div>
  );
}

function OrderDetail({ id, user, close, saved }) {
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
