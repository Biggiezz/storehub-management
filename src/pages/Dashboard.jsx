import { useState, useEffect } from "react";
import { useResource } from "../hooks";
import { U, money } from "../api";
import { State } from "../components/UI";
import {
  clearOrdersCache,
  getOrdersSnapshot,
} from "../services/dashboardStats.js";
import KpiCards from "../components/dashboard/KpiCards";
import RevenueSection from "../components/dashboard/RevenueSection";

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

      {stats.data && <KpiCards kpis={kpis} />}

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

      <RevenueSection
        key={period}
        period={period}
        navigate={navigate}
        orders={orders}
      />
    </>
  );
}
