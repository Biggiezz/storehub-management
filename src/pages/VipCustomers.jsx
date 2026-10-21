import { useEffect, useState } from "react";
import { money, date } from "../api";
import { Badge, Field, Icon, Pager, State, Modal } from "../components/UI";
import {
  EMPTY_VIP_FILTERS,
  fetchVipCustomers,
  fetchVipTiers,
  validateVipFilters,
} from "../services/vipCustomers";

export default function VipCustomers() {
  const [draft, setDraft] = useState({ ...EMPTY_VIP_FILTERS }),
    [filters, setFilters] = useState({ ...EMPTY_VIP_FILTERS });
  const [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [validation, setValidation] = useState("");
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [tierState, setTierState] = useState({
      loading: true,
      error: "",
      data: [],
    }),
    [tierRevision, setTierRevision] = useState(0);
  const [selected, setSelected] = useState(null);
  const set = (key) => (e) => setDraft({ ...draft, [key]: e.target.value });
  useEffect(() => {
    const controller = new AbortController();
    fetchVipCustomers(filters, page, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ loading: false, error: "", data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ loading: false, error: error.message, data: null });
      });
    return () => controller.abort();
  }, [filters, page, revision]);
  useEffect(() => {
    const controller = new AbortController();
    fetchVipTiers({ signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setTierState({ loading: false, error: "", data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setTierState({ loading: false, error: error.message, data: [] });
      });
    return () => controller.abort();
  }, [tierRevision]);
  function retryTiers() {
    setTierState({ loading: true, error: "", data: [] });
    setTierRevision((v) => v + 1);
  }
  function reload() {
    setSelected(null);
    setState({ loading: true, error: "", data: null });
    setRevision((v) => v + 1);
  }
  function apply(e) {
    e.preventDefault();
    const next = { ...draft, keyword: draft.keyword.trim() };
    let error = validateVipFilters(next);
    const tier = tierState.data.find((t) => t.name === next.tier);
    if (
      !error &&
      tier &&
      next.isVip !== "" &&
      tier.isVip !== (next.isVip === "true")
    )
      error =
        "Hạng đã chọn không thuộc nhóm VIP đang lọc. Hãy chọn “Tất cả khách hàng” hoặc đổi hạng.";
    setValidation(error);
    if (!error) {
      setFilters(next);
      setPage(1);
      reload();
    }
  }
  function reset() {
    setDraft({ ...EMPTY_VIP_FILTERS });
    setFilters({ ...EMPTY_VIP_FILTERS });
    setPage(1);
    setValidation("");
    reload();
  }
  function goPage(next) {
    setSelected(null);
    setState({ loading: true, error: "", data: null });
    setPage(next);
  }
  const data = state.data;
  return (
    <>
      <div className="welcome">
        <div>
          <span className="eyebrow">KHÁCH HÀNG / THÂN THIẾT</span>
          <h1>Khách hàng thân thiết</h1>
          <p>
            Lọc khách hàng theo chi tiêu tích lũy, hạng thành viên và nhóm VIP.
          </p>
        </div>
      </div>
      <form className="card filter-panel" onSubmit={apply}>
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
            <button type="button" onClick={retryTiers}>
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
            <button type="button" onClick={reset}>
              Xóa bộ lọc
            </button>
            <button className="primary">
              Lọc khách hàng
            </button>
          </div>
        </div>
      </form>
      {data && (
        <div className="loyalty-summary">
          <article className="card">
            <small>Khách hàng theo bộ lọc</small>
            <strong>
              {data.summary.totalFilteredCustomers.toLocaleString("vi-VN")}
            </strong>
          </article>
          <article className="card">
            <small>Tổng chi tiêu của nhóm đã lọc</small>
            <strong>{money(data.summary.filteredRevenueSum)}</strong>
          </article>
          <article className="card">
            <small>Khách VIP toàn hệ thống · không theo bộ lọc</small>
            <strong>
              {data.summary.vipCount.toLocaleString("vi-VN")} /{" "}
              {data.summary.totalSystemCustomers.toLocaleString("vi-VN")}
            </strong>
          </article>
        </div>
      )}
      <section className="card">
        <div className="list-heading">
          <strong>Danh sách theo bộ lọc đã áp dụng</strong>
          <button onClick={reload} disabled={state.loading}>
            Tải lại
          </button>
        </div>
        <State
          loading={state.loading}
          error={state.error}
          retry={reload}
          empty={!!data && !data.data.length}
        />
        {data && !!data.data.length && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Liên hệ</th>
                  <th>Tổng chi tiêu</th>
                  <th>Đơn hoàn tất</th>
                  <th>Hạng / VIP</th>
                  <th>Đặt hàng gần nhất</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.data.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <strong>{c.name || "Chưa có tên"}</strong>
                      <small className="block">#{c._id.slice(-8)}</small>
                    </td>
                    <td>
                      {c.email || "—"}
                      <small className="block">{c.phone || "—"}</small>
                    </td>
                    <td className="strong nowrap">
                      {money(c.stats.totalSpent)}
                    </td>
                    <td>
                      {c.stats.completedOrdersCount}
                      <small className="block">
                        / {c.stats.totalOrdersCount} tổng đơn
                      </small>
                    </td>
                    <td>
                      <Badge tone={c.tier.isVip ? "green" : "blue"}>
                        {c.tier.name}
                      </Badge>
                      <small className="block">
                        {c.tier.isVip ? "Khách VIP" : "Chưa đạt VIP"}
                      </small>
                    </td>
                    <td>{date(c.stats.lastOrderDate)}</td>
                    <td>
                      <button onClick={() => setSelected(c)}>Xem</button>
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
            setPage={goPage}
            total={data.pagination.totalItems}
            hasNext={page < data.pagination.totalPages}
          />
        )}
        <p className="compat-note">
          Chi tiêu từ các đơn đã giao hoặc hoàn thành. Hạng xét theo ngưỡng chi
          tiêu hoặc số đơn hoàn tất; nhóm VIP và hạng do hệ thống xác định.
        </p>
      </section>
      {!!tierState.data.length && (
        <details className="card loyalty-rules">
          <summary>Tiêu chí xếp hạng thành viên</summary>
          <p>
            Đạt ngưỡng chi tiêu <strong>hoặc</strong> số đơn của hạng tương ứng;
            ưu tiên hạng cao nhất.
          </p>
          <div className="loyalty-tier-grid">
            {tierState.data.map((t) => (
              <article key={t.key}>
                <Badge tone={t.isVip ? "green" : "blue"}>{t.name}</Badge>
                <p>
                  Từ {money(t.minSpent)}
                  <br />
                  hoặc {t.minOrders} đơn hoàn tất
                </p>
                <small>
                  {t.isVip ? "Thuộc nhóm VIP" : "Chưa thuộc nhóm VIP"}
                </small>
              </article>
            ))}
          </div>
        </details>
      )}
      {selected && (
        <Modal
          title={selected.name || "Khách hàng thân thiết"}
          close={() => setSelected(null)}
        >
          <div className="modal-body">
            <Badge tone={selected.tier.isVip ? "green" : "blue"}>
              {selected.tier.name}
            </Badge>
            <p className="loyalty-contact">
              {selected.email || "Chưa có email"}
              <br />
              {selected.phone || "Chưa có số điện thoại"}
              <br />
              {selected.address || "Chưa có địa chỉ"}
            </p>
            <div className="totals">
              <p>
                <span>Tổng chi tiêu</span>
                <strong>{money(selected.stats.totalSpent)}</strong>
              </p>
              <p>
                <span>Đơn hoàn tất / tổng đơn</span>
                <strong>
                  {selected.stats.completedOrdersCount} /{" "}
                  {selected.stats.totalOrdersCount}
                </strong>
              </p>
              <p>
                <span>Đặt hàng gần nhất</span>
                <strong>{date(selected.stats.lastOrderDate)}</strong>
              </p>
            </div>
            <h3>Đặc quyền theo cấu hình hạng</h3>
            {Array.isArray(selected.tier.perks) &&
            selected.tier.perks.length ? (
              <ul>
                {selected.tier.perks.map((perk, i) => (
                  <li key={i}>{perk}</li>
                ))}
              </ul>
            ) : (
              <p>Chưa có thông tin đặc quyền.</p>
            )}
          </div>
          <footer>
            <button onClick={() => setSelected(null)}>Đóng</button>
          </footer>
        </Modal>
      )}
    </>
  );
}
