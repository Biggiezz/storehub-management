import { Field } from "../UI";

export default function VipFilterForm({
  draft,
  setDraft,
  tierState,
  validation,
  onApply,
  onReset,
  onRetryTiers,
}) {
  const set = (key) => (e) => setDraft({ ...draft, [key]: e.target.value });

  return (
    <form className="card filter-panel" onSubmit={onApply}>
      <h2>Tìm kiếm và lọc khách hàng</h2>
      <div className="filter-grid vip-filters">
        <Field label="Tìm khách hàng">
          <input
            value={draft.keyword}
            onChange={set("keyword")}
            placeholder="Tên, email, số điện thoại"
            maxLength={200}
          />
        </Field>
        <Field label="Chi tiêu tối thiểu (VNĐ)">
          <input
            type="number"
            min="0"
            step="1"
            value={draft.minSpent}
            onChange={set("minSpent")}
            placeholder="Không giới hạn"
          />
        </Field>
        <Field label="Chi tiêu tối đa (VNĐ)">
          <input
            type="number"
            min="0"
            step="1"
            value={draft.maxSpent}
            onChange={set("maxSpent")}
            placeholder="Không giới hạn"
          />
        </Field>
        <Field label="Hạng thành viên">
          <select
            value={draft.tier}
            onChange={set("tier")}
            disabled={tierState.loading || !!tierState.error}
          >
            <option value="">
              {tierState.loading ? "Đang tải thứ hạng…" : "Tất cả thứ hạng"}
            </option>
            {tierState.data.map((t) => (
              <option key={t.key} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nhóm khách hàng">
          <select value={draft.isVip} onChange={set("isVip")}>
            <option value="">Tất cả khách hàng</option>
            <option value="true">Chỉ khách VIP</option>
            <option value="false">Khách chưa đạt VIP</option>
          </select>
        </Field>
        <Field label="Sắp xếp">
          <select value={draft.sort} onChange={set("sort")}>
            <option value="spent_desc">Chi tiêu cao → thấp</option>
            <option value="spent_asc">Chi tiêu thấp → cao</option>
            <option value="orders_desc">Số đơn hoàn tất cao → thấp</option>
            <option value="name_asc">Tên A → Z</option>
            <option value="recent_desc">Đặt hàng gần nhất</option>
          </select>
        </Field>
      </div>
      {tierState.error && (
        <div className="error" role="alert">
          Không tải được cấu hình hạng: {tierState.error}{" "}
          <button type="button" onClick={onRetryTiers}>
            Tải lại thứ hạng
          </button>
        </div>
      )}
      {validation && (
        <p className="error" role="alert">
          {validation}
        </p>
      )}
      <div className="filter-footer">
        <span>
          Các điều kiện được kết hợp. Bấm Áp dụng để cập nhật kết quả.
        </span>
        <div className="actions">
          <button type="button" onClick={onReset}>
            Xóa bộ lọc
          </button>
          <button className="primary" type="submit">
            Lọc khách hàng
          </button>
        </div>
      </div>
    </form>
  );
}
