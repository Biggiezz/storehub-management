import { useCallback, useEffect, useMemo, useState } from "react";
import { request } from "../api";

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
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.55)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "16px",
    zIndex: 1000,
  },
  modal: {
    background: "#fff",
    borderRadius: "12px",
    padding: "24px",
    width: "min(760px, 100%)",
    maxHeight: "85vh",
    overflowY: "auto",
    boxSizing: "border-box",
  },
  pre: {
    background: "#f8fafc",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    fontSize: "13px",
  },
};

function getFirst(object, keys) {
  for (const key of keys) {
    if (object?.[key] !== undefined && object?.[key] !== null) {
      return object[key];
    }
  }
  return undefined;
}

function getActivityList(response) {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  const candidates = [
    response?.activities,
    response?.content,
    response?.items,
    response?.results,
    response?.logs,
    response?.data?.activities,
    response?.data?.items,
    response?.data?.content,
    response?.data?.results,
  ];

  return candidates.find(Array.isArray) ?? [];
}

function getAccount(activity) {
  return (
    activity?.customerName ||
    activity?.username ||
    activity?.userName ||
    activity?.adminName ||
    activity?.email ||
    activity?.account ||
    "Không xác định"
  );
}

function getAction(activity) {
  return (
    activity?.title ||
    activity?.detail ||
    activity?.action ||
    activity?.type ||
    "Không xác định"
  );
}

function getTimestamp(activity) {
  return getFirst(activity, [
    "timestamp",
    "createdAt",
    "created_at",
    "occurredAt",
    "time",
    "date",
    "performedAt",
  ]);
}

function formatDate(value) {
  if (!value) return "Không có dữ liệu";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function formatValue(value) {
  if (value === undefined || value === null || value === "") {
    return "Không có dữ liệu";
  }

  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  return JSON.stringify(value, null, 2) ?? String(value);
}

function getBefore(activity) {
  return getFirst(activity, [
    "before",
    "beforeData",
    "oldValue",
    "oldData",
    "previousValue",
    "previousData",
    "oldValues",
  ]);
}

function getAfter(activity) {
  return getFirst(activity, [
    "after",
    "afterData",
    "newValue",
    "newData",
    "currentValue",
    "newValues",
  ]);
}

function getIp(activity) {
  return (
    activity?.ipAddress ||
    activity?.ip_address ||
    activity?.ip ||
    activity?.clientIp ||
    "Chưa được cung cấp"
  );
}

function getActivityId(activity, index) {
  return (
    getFirst(activity, ["id", "_id", "activityId", "logId"]) ??
    `${getTimestamp(activity) ?? "activity"}-${index}`
  );
}

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

      {selectedActivity && (
        <div
          style={styles.overlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedActivity(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="activity-detail-title"
            style={styles.modal}
          >
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <h2
                id="activity-detail-title"
                style={{ margin: 0, fontSize: 21 }}
              >
                Chi tiết hoạt động
              </h2>

              <button
                type="button"
                style={styles.button}
                onClick={() => setSelectedActivity(null)}
                aria-label="Đóng chi tiết"
              >
                Đóng
              </button>
            </header>

            <p>
              <strong>Thời gian:</strong>{" "}
              {formatDate(getTimestamp(selectedActivity))}
            </p>
            <p>
              <strong>Tài khoản:</strong> {getAccount(selectedActivity)}
            </p>
            <p>
              <strong>Hành động:</strong> {String(getAction(selectedActivity))}
            </p>

            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                Xem dữ liệu nhật ký gốc
              </summary>
              <pre style={styles.pre}>{formatValue(selectedActivity)}</pre>
            </details>

            <p style={{ ...styles.muted, fontSize: 13, marginTop: 20 }}>
              Nhật ký chỉ được xem. Trang này không cung cấp thao tác chỉnh sửa
              hoặc xóa lịch sử.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
