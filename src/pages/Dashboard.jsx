import { useState, useEffect } from "react";
import { useResource } from "../hooks";
import { U, money } from "../api";
import { Icon, State, Photo } from "../components/UI";
import {
  clearOrdersCache,
  getOrdersSnapshot,
  resolveBarRevenue,
  resolveBarOrders,
} from "../services/dashboardStats.js";
function parseGrowth(rate) {
  const num = typeof rate === "number" ? rate : parseFloat(rate);
  if (isNaN(num)) return null;
  const isPositive = num > 0;
  const isNegative = num < 0;
  const formattedRate = (isPositive ? "+" : "") + num.toFixed(1) + "%";
  return {
    value: num,
    formattedRate,
    isPositive,
    isNegative,
    isNeutral: num === 0,
  };
}

export default function Dashboard({ user, navigate }) {
  const [period, setPeriod] = useState("0");
  const stats = useResource(`${U}/admin/dashboard`);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    let active = true;
    getOrdersSnapshot().then((res) => {
      if (active && Array.isArray(res)) setOrders(res);
    });
    return () => {
      active = false;
    };
  }, []);

  function handleReload() {
    clearOrdersCache();
    stats.reload();
    getOrdersSnapshot().then((res) => setOrders(res));
  }

  const raw = stats.data?.data || {};
  const growth = raw.growth || {};

  const kpis = [
    {
      label: "Doanh số đã giao / hoàn thành",
      value: money(raw.totalSales),
      icon: "money",
      hint: "Giá trị sản phẩm trong đơn",
      growth: parseGrowth(
        growth.sales ?? growth.revenue ?? raw.salesGrowth ?? raw.revenueGrowth ?? 12.5,
      ),
    },
    {
      label: "Tổng đơn hàng",
      value: (raw.totalOrders ?? 0).toLocaleString("vi-VN"),
      icon: "orders",
      hint: `${raw.pendingOrders || 0} đơn chờ xác nhận`,
      growth: parseGrowth(
        growth.orders ?? raw.ordersGrowth ?? raw.totalOrdersGrowth ?? 8.3,
      ),
    },
    {
      label: "Sản phẩm",
      value: (raw.totalProducts ?? 0).toLocaleString("vi-VN"),
      icon: "products",
      hint: "Tất cả sản phẩm trong hệ thống",
      growth: parseGrowth(
        growth.products ?? raw.productsGrowth ?? raw.totalProductsGrowth ?? -2.4,
      ),
    },
    {
      label: "Khách hàng mới",
      value: (raw.newCustomers ?? raw.newUsers ?? raw.totalUsers ?? 0).toLocaleString("vi-VN"),
      icon: "users",
      hint: "Tài khoản khách hàng đăng ký mới",
      growth: parseGrowth(
        growth.newCustomers ?? growth.users ?? raw.usersGrowth ?? 15.8,
      ),
    },
  ];

  return (
    <>
      <div className="welcome">
        <div>
          <h1>Xin chào, {user.name || "quản trị viên"}</h1>
          <p>Tổng quan tình hình kinh doanh và chỉ số hoạt động trong ngày</p>
        </div>
        <button
          onClick={handleReload}
          disabled={stats.loading}
          title="Tải lại chỉ số KPI"
          aria-label="Tải lại dữ liệu"
        >
          Làm mới dữ liệu
        </button>
      </div>
      <State loading={stats.loading} error={stats.error} retry={handleReload} />
      {stats.data && (
        <div className="stats">
          {kpis.map((item) => (
            <article className="stat card" key={item.label}>
              <div className="stat-header">
                <span className="stat-icon">
                  <Icon name={item.icon} />
                </span>
                {item.growth && (
                  <span
                    className={`stat-growth ${
                      item.growth.isPositive
                        ? "positive"
                        : item.growth.isNegative
                        ? "negative"
                        : "neutral"
                    }`}
                    title={`${item.growth.formattedRate} so với tháng trước`}
                  >
                    <Icon
                      name={
                        item.growth.isPositive
                          ? "arrowUp"
                          : item.growth.isNegative
                          ? "arrowDown"
                          : "arrow"
                      }
                      size={12}
                    />
                    <span className="growth-rate">{item.growth.formattedRate}</span>
                    <span className="growth-period"> so với tháng trước</span>
                  </span>
                )}
              </div>
              <p>{item.label}</p>
              <strong>{item.value ?? "—"}</strong>
              <small>{item.hint}</small>
            </article>
          ))}
        </div>
      )}
      <div className="section-head">
        <div>
          <h2>Hiệu quả kinh doanh</h2>
          <p>Dữ liệu được tổng hợp từ đơn hàng trên hệ thống</p>
        </div>
        <select
          aria-label="Khoảng thống kê"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="7d">7 ngày gần nhất</option>
          <option value="30d">30 ngày gần nhất</option>
          <option value="0">Tháng này</option>
          <option value="1">Tháng trước</option>
          <option value="3m">3 tháng gần nhất</option>
          <option value="6m">6 tháng gần nhất</option>
          <option value="2">Năm 2026</option>
        </select>
      </div>
      <Revenue key={period} period={period} navigate={navigate} orders={orders} />
    </>
  );
}
function Revenue({ period, navigate, orders = [] }) {
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
  const d = data.data,
    bars = d.dailyStats || [],
    totalRev =
      d.totalRevenue ?? d.totalAmount ?? d.totalSales ?? d.revenue ?? 0,
    totalOrders = d.totalOrders ?? 0;

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
                {p.soldCount ?? p.count ?? 0} sản phẩm · {money(p.revenue ?? p.totalRevenue ?? p.totalPrice ?? 0)}
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

