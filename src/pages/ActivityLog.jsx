import { useCallback, useEffect, useMemo, useState } from "react";
import { request } from "../api";
import {
  getActivityList,
  getAccount,
  getAction,
  getTimestamp,
  formatDate,
  getBefore,
  getAfter,
  getIp,
  getActivityId,
} from "../services/activityLogHelpers";
import ActivityDetailModal from "../components/activity/ActivityDetailModal";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const styles = {
  page: {
    padding: "24px",
    color: "#1f2937",
    background: "#f8fafc",
    minHeight: "100%",
    fontFamily: "Arial, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: "16px",
    marginBottom: "24px",
  },
  title: { margin: 0, fontSize: "26px", fontWeight: 700 },
  subtitle: { margin: "8px 0 0", color: "#64748b", fontSize: "14px" },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "20px",
  },
  controls: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  input: {
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    fontSize: "14px",
    minWidth: "220px",
    maxWidth: "100%",
  },
  select: {
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#fff",
    fontSize: "14px",
  },
  button: {
    padding: "10px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#fff",
    cursor: "pointer",
    fontSize: "14px",
  },
  tableWrap: { overflowX: "auto" },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
    minWidth: "850px",
  },
  th: {
    padding: "13px 12px",
    textAlign: "left",
    color: "#475569",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px 12px",
    borderBottom: "1px solid #e2e8f0",
    verticalAlign: "top",
  },
  badge: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "999px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: 600,
  },
  muted: { color: "#64748b" },
  error: {
    padding: "12px 14px",
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    marginBottom: "16px",
  },
};

export default function ActivityLog() {
  const [activities, setActivities] = useState([]);
  const [limit, setLimit] = useState(10);
  const [keyword, setKeyword] = useState("");
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await request(
        `/users/admin/recent-activities?limit=${limit}`,
      );

      setActivities(getActivityList(response));
    } catch (err) {
      setError(
        err?.message ||
          "Không thể tải nhật ký hoạt động. Hãy kiểm tra đăng nhập, API và kết nối máy chủ.",
      );
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const filteredActivities = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    if (!normalizedKeyword) return activities;

    return activities.filter((activity) => {
      const searchableText = [
        getAccount(activity),
        getAction(activity),
        getIp(activity),
        getTimestamp(activity),
        getBefore(activity),
        getAfter(activity),
      ]
        .map((value) =>
          typeof value === "string" ? value : JSON.stringify(value ?? ""),
        )
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedKeyword);
    });
  }, [activities, keyword]);

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Nhật ký hoạt động</h1>
          <p style={styles.subtitle}>
            Theo dõi các thao tác quản trị để hỗ trợ kiểm tra và truy vết sự cố.
          </p>
        </div>

        <button
          type="button"
          style={styles.button}
          onClick={loadActivities}
          disabled={loading}
        >
          {loading ? "Đang tải..." : "Làm mới"}
        </button>
      </header>

      <section style={styles.card}>
        <div style={styles.controls}>
          <input
            type="search"
            aria-label="Tìm kiếm nhật ký"
            placeholder="Tìm tài khoản, hành động ..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={styles.input}
          />

          <label>
            <span style={{ marginRight: 8, fontSize: 14 }}>Số bản ghi:</span>
            <select
              aria-label="Số lượng bản ghi"
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              style={styles.select}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <span style={{ ...styles.muted, fontSize: 14 }}>
            Hiển thị {filteredActivities.length} bản ghi
          </span>
        </div>
      </section>

      {error && (
        <div role="alert" style={styles.error}>
          <strong>Lỗi tải nhật ký:</strong> {error}
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              style={styles.button}
              onClick={loadActivities}
            >
              Thử lại
            </button>
          </div>
        </div>
      )}

      <section style={styles.card}>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Thời gian</th>
                <th style={styles.th}>Tài khoản</th>
                <th style={styles.th}>Hành động</th>
                <th style={styles.th}>Chi tiết</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ ...styles.td, textAlign: "center" }}>
                    Đang tải nhật ký hoạt động...
                  </td>
                </tr>
              ) : filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ ...styles.td, textAlign: "center" }}>
                    {error
                      ? "Không có dữ liệu để hiển thị."
                      : "Không tìm thấy nhật ký hoạt động."}
                  </td>
                </tr>
              ) : (
                filteredActivities.map((activity, index) => (
                  <tr key={getActivityId(activity, index)}>
                    <td style={styles.td}>
                      {formatDate(getTimestamp(activity))}
                    </td>
                    <td style={styles.td}>
                      <strong>{getAccount(activity)}</strong>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.badge}>
                        {String(getAction(activity))}
                      </span>
                    </td>

                    <td style={styles.td}>
                      <button
                        type="button"
                        style={styles.button}
                        onClick={() => setSelectedActivity(activity)}
                      >
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ActivityDetailModal
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />
    </main>
  );
}
