import { useEffect, useState, useMemo, useCallback } from "react";
import { State, Pager } from "../components/UI";
import {
  EMPTY_ORDER_FILTERS,
  ORDER_TABS,
  countOrdersByTab,
  validateOrderFilters,
  hasOrderFilters,
  getCachedOrderSnapshot,
  clearOrdersSnapshotCache,
  filterOrders,
} from "../services/orderSearch";
import { clearOrdersCache } from "../services/dashboardStats";
import OrderFilterPanel from "../components/orders/OrderFilterPanel";
import OrderTabs from "../components/orders/OrderTabs";
import OrderTable from "../components/orders/OrderTable";
import OrderDetailModal from "../components/orders/OrderDetailModal";

export default function Orders({ user, notify }) {
  const [draft, setDraft] = useState({ ...EMPTY_ORDER_FILTERS });
  const [applied, setApplied] = useState({ ...EMPTY_ORDER_FILTERS });
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

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
          <p>
            Quản lý đơn hàng theo quy trình vận hành và lọc theo mã đơn, khách
            hàng, ngày đặt.
          </p>
        </div>
      </div>

      <OrderFilterPanel
        draft={draft}
        setDraft={setDraft}
        error={error}
        onApply={apply}
        onReset={reset}
      />

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

  return (
    <section className="card order-results-card">
      {/* 1. Thanh điều hướng 5 Tab vận hành chuẩn + 1 Tab phụ */}
      <OrderTabs
        activeTab={activeTab}
        tabCounts={tabCounts}
        onTabClick={handleTabClick}
      />

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
        {!state.loading && !state.error && (
          <OrderTable
            pageRows={pageRows}
            onSelectOrder={(id) => setSelected(id)}
          />
        )}
      </div>

      {/* 4. Phân trang */}
      {!state.loading && !state.error && (
        <Pager
          page={page}
          setPage={setPage}
          total={filteredRows.length}
          hasNext={page < totalPages}
        />
      )}

      {/* 5. Modal chi tiết đơn hàng */}
      {selected && (
        <OrderDetailModal
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

export { OrderDetailModal as OrderDetail };
