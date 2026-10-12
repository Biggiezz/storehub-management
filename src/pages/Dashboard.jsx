import { useState } from "react";
import { useResource } from "../hooks";
import { U, money } from "../api";
import { Icon, State, Photo } from "../components/UI";
export default function Dashboard({ user, navigate }) {
  const [period, setPeriod] = useState("0");
  const stats = useResource(`${U}/admin/dashboard`);
  return (
    <>
      <div className="welcome">
        <div>
          <span className="eyebrow">STORE HUB / TỔNG QUAN</span>
          <h1>Xin chào, {user.name || "quản trị viên"}</h1>
        </div>
      </div>
      <State loading={stats.loading} error={stats.error} retry={stats.reload} />
      {stats.data && (
        <div className="stats">
          {[
            [
              "Doanh số đã giao / hoàn thành",
              money(stats.data.data.totalSales),
              "money",
              "Giá trị sản phẩm trong đơn",
            ],
            [
              "Tổng đơn hàng",
              stats.data.data.totalOrders,
              "orders",
              `${stats.data.data.pendingOrders || 0} đơn chờ xác nhận`,
            ],
            [
              "Sản phẩm",
              stats.data.data.totalProducts,
              "products",
              "Tất cả sản phẩm trong hệ thống",
            ],
            [
              "Tài khoản",
              stats.data.data.totalUsers,
              "users",
              "Bao gồm khách hàng và nhân viên",
            ],
          ].map(([label, value, icon, hint]) => (
            <article className="stat card" key={label}>
              <span className="stat-icon">
                <Icon name={icon} />
              </span>
              <p>{label}</p>
              <strong>{value ?? "—"}</strong>
              <small>{hint}</small>
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
          <option value="0">Tháng này</option>
          <option value="1">Tháng trước</option>
          <option value="2">Năm 2026</option>
        </select>
      </div>
      <Revenue key={period} period={period} />
    </>
  );
}
function Revenue({ period }) {
  const { data, loading, error, reload } = useResource(
    `${U}/admin/revenue-stats?period=${period}&activityLimit=0`,
  );
  if (!data)
    return (
      <div className="card">
        <State loading={loading} error={error} retry={reload} />
      </div>
    );
  const d = data.data,
    bars = d.dailyStats || [],
    max = Math.max(...bars.map((x) => x.revenue), 1);
  return (
    <div className="dashboard-grid">
      <section className="card revenue">
        <div className="section-head">
          <div>
            <h3>Giá trị đơn hàng</h3>
            <strong className="revenue-total">{money(d.totalRevenue)}</strong>
          </div>
          <span className="badge blue">{d.totalOrders} đơn</span>
        </div>
        <div
          className="bars"
          role="img"
          aria-label="Giá trị đơn hàng theo thời gian"
        >
          {bars.map((b, i) => (
            <div className="bar-col" key={i}>
              <span className="bar-value">{money(b.revenue)}</span>
              <div className="bar-track">
                <div
                  style={{ height: `${Math.max(1, (b.revenue / max) * 100)}%` }}
                />
              </div>
              <small>{b.label}</small>
            </div>
          ))}
        </div>
        <p className="footnote">
          Bao gồm đơn chưa hoàn thành, loại trừ đơn đã hủy.{" "}
          {period === "2"
            ? "Thống kê từ tháng 1 đến tháng 12 năm 2026."
            : "Các cột cộng gộp theo thứ trong tuần của cả tháng."}
        </p>
      </section>
      <section className="card top-products">
        <h3>Sản phẩm bán nhiều</h3>
        <p className="muted">Trong khoảng thời gian đã chọn</p>
        {(d.topProducts || []).map((p, i) => (
          <div className="top-item" key={p.productId}>
            <span className="rank">0{i + 1}</span>
            <Photo src={p.image} name={p.name} />
            <div>
              <strong>{p.name}</strong>
              <small>
                {p.soldCount} sản phẩm · {money(p.revenue)}
              </small>
            </div>
          </div>
        ))}
        {!d.topProducts?.length && <State empty />}
      </section>
    </div>
  );
}
