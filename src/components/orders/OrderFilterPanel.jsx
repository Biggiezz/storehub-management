import { Field } from "../UI";
import { ORDER_PAYMENT_METHODS } from "../../services/orderSearch";

export default function OrderFilterPanel({
  draft,
  setDraft,
  error,
  onApply,
  onReset,
}) {
  const set = (key) => (e) => setDraft({ ...draft, [key]: e.target.value });

  return (
    <form className="card filter-panel" onSubmit={onApply}>
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
          <button type="button" onClick={onReset}>
            Xóa bộ lọc
          </button>
          <button className="primary" type="submit">
            Áp dụng bộ lọc
          </button>
        </div>
      </div>
    </form>
  );
}
