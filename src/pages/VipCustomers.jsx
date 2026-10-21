import { useEffect, useState } from "react";
import { money, date } from "../api";
import { Badge, Pager, State } from "../components/UI";
import {
  EMPTY_VIP_FILTERS,
  fetchVipCustomers,
  fetchVipTiers,
  validateVipFilters,
} from "../services/vipCustomers";
import VipFilterForm from "../components/vip/VipFilterForm";
import VipCustomerModal from "../components/vip/VipCustomerModal";

export default function VipCustomers() {
  const [draft, setDraft] = useState({ ...EMPTY_VIP_FILTERS });
  const [filters, setFilters] = useState({ ...EMPTY_VIP_FILTERS });
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [validation, setValidation] = useState("");
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [tierState, setTierState] = useState({
    loading: true,
    error: "",
    data: [],
  });
  const [tierRevision, setTierRevision] = useState(0);
  const [selected, setSelected] = useState(null);

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

      <VipFilterForm
        draft={draft}
        setDraft={setDraft}
        tierState={tierState}
        validation={validation}
        onApply={apply}
        onReset={reset}
        onRetryTiers={retryTiers}
      />

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

      <VipCustomerModal
        customer={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
