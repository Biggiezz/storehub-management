import { Icon } from "../UI";

export default function KpiCards({ kpis = [] }) {
  if (!kpis.length) return null;

  return (
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
  );
}
