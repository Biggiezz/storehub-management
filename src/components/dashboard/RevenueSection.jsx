import { U, money } from "../../api";
import { useResource } from "../../hooks";
import { Icon, State, Photo } from "../UI";
import {
  resolveBarRevenue,
  resolveBarOrders,
} from "../../services/dashboardStats";

export default function RevenueSection({ period, navigate, orders = [] }) {
  const { data, loading, error, reload } = useResource(
    `${U}/admin/revenue-stats?period=${period}&activityLimit=0`,
  );

  function handleSelectProduct(p) {
    if (!p) return;
    const term = (p.name || p.productId || "").trim();
    try {
      if (term) {
        sessionStorage.setItem("storehub.product.search", term);
      }
    } catch {
      // ignore storage errors
    }
    if (typeof navigate === "function") {
      navigate("products");
    }
  }

  if (!data)
    return (
      <div className="card">
        <State loading={loading} error={error} retry={reload} />
      </div>
    );

  const d = data.data;
  const bars = d.dailyStats || [];
  const totalRev =
    d.totalRevenue ?? d.totalAmount ?? d.totalSales ?? d.revenue ?? 0;
  const totalOrders = d.totalOrders ?? 0;

  const max = Math.max(
    ...bars.map((x) => resolveBarRevenue(x, bars, totalRev)),
    1,
  );

  return (
    <div className="dashboard-grid">
      <section className="card revenue">
        <div className="section-head">
          <div>
            <h3>Doanh thu theo thời gian</h3>
            <strong className="revenue-total">{money(totalRev)}</strong>
          </div>
          <span className="badge blue">{totalOrders} đơn</span>
        </div>
        <div
          className="bars"
          role="img"
          aria-label="Doanh thu theo thời gian"
        >
          {bars.map((b, i) => {
            const rev = resolveBarRevenue(b, bars, totalRev);
            const orderCount = resolveBarOrders(
              b,
              rev,
              bars,
              totalOrders,
              totalRev,
              orders,
              period,
            );
            return (
              <div className="bar-col" key={i} tabIndex={0}>
                <div className="bar-tooltip" role="tooltip">
                  <div className="tooltip-period">{b.label}</div>
                  <div className="tooltip-item">
                    <span className="tooltip-label">Doanh thu:</span>
                    <strong className="tooltip-value highlight">
                      {money(rev)}
                    </strong>
                  </div>
                  <div className="tooltip-item">
                    <span className="tooltip-label">Đơn hàng:</span>
                    <strong className="tooltip-value">{orderCount} đơn</strong>
                  </div>
                  <span className="tooltip-arrow" aria-hidden="true" />
                </div>
                <span className="bar-amount">{money(rev)}</span>
                <div className="bar-track">
                  <div
                    style={{ height: `${Math.max(1, (rev / max) * 100)}%` }}
                  />
                </div>
                <small>{b.label}</small>
              </div>
            );
          })}
        </div>
        <p className="footnote">
          Bao gồm đơn chưa hoàn thành, loại trừ đơn đã hủy.{" "}
          {period === "2"
            ? "Thống kê từ tháng 1 đến tháng 12 năm 2026."
            : ["7d", "30d"].includes(period)
            ? "Thống kê chi tiết theo từng ngày trong kỳ."
            : ["3m", "6m"].includes(period)
            ? "Thống kê cộng gộp theo từng tháng trong kỳ."
            : "Các cột cộng gộp theo thứ trong tuần của cả tháng."}
        </p>
      </section>
      <section className="card top-products">
        <h3>Sản phẩm bán nhiều</h3>
        <p className="muted">Trong khoảng thời gian đã chọn</p>
        {(d.topProducts || []).map((p, i) => (
          <div
            className="top-item clickable"
            key={p.productId || i}
            role="button"
            tabIndex={0}
            onClick={() => handleSelectProduct(p)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSelectProduct(p);
              }
            }}
            title={`Xem chi tiết sản phẩm: ${p.name || p.productId || "Sản phẩm"}`}
            aria-label={`Xem chi tiết sản phẩm ${p.name || p.productId || ""}`}
          >
            <span className="rank">0{i + 1}</span>
            <Photo src={p.image} name={p.name} />
            <div className="top-item-info">
              <strong>{p.name}</strong>
              <small>
                {p.soldCount ?? p.count ?? 0} sản phẩm ·{" "}
                {money(
                  p.revenue ?? p.totalRevenue ?? p.totalPrice ?? 0,
                )}
              </small>
            </div>
            <span className="top-item-arrow" aria-hidden="true">
              <Icon name="arrow" size={14} />
            </span>
          </div>
        ))}
        {!d.topProducts?.length && <State empty />}
      </section>
    </div>
  );
}
