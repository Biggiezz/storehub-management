import { ORDER_TABS } from "../../services/orderSearch";

export default function OrderTabs({
  activeTab,
  tabCounts = {},
  onTabClick,
}) {
  return (
    <div className="order-tabs-wrapper">
      <div
        className="order-tabs"
        role="tablist"
        aria-label="Thanh điều hướng trạng thái vận hành đơn hàng"
      >
        {ORDER_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tabCounts[tab.id] ?? 0;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              data-tab-id={tab.id}
              data-tab-index={tab.operationalIndex ?? 0}
              className={`order-tab-btn ${isActive ? "active" : ""} ${
                tab.isAuxiliary ? "auxiliary" : ""
              }`}
              onClick={() => onTabClick(tab.id)}
            >
              <span className="order-tab-label">{tab.label}</span>
              <span
                className={`order-tab-badge tone-${tab.badgeTone} ${
                  isActive ? "badge-active" : ""
                }`}
                title={`${count} đơn hàng`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
