import {
  getAccount,
  getAction,
  getTimestamp,
  formatDate,
  formatValue,
} from "../../services/activityLogHelpers";

const modalStyles = {
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
  button: {
    padding: "10px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#fff",
    cursor: "pointer",
    fontSize: "14px",
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
  muted: { color: "#64748b" },
};

export default function ActivityDetailModal({ activity, onClose }) {
  if (!activity) return null;

  return (
    <div
      style={modalStyles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-detail-title"
        style={modalStyles.modal}
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
          <h2 id="activity-detail-title" style={{ margin: 0, fontSize: 21 }}>
            Chi tiết hoạt động
          </h2>

          <button
            type="button"
            style={modalStyles.button}
            onClick={onClose}
            aria-label="Đóng chi tiết"
          >
            Đóng
          </button>
        </header>

        <p>
          <strong>Thời gian:</strong> {formatDate(getTimestamp(activity))}
        </p>
        <p>
          <strong>Tài khoản:</strong> {getAccount(activity)}
        </p>
        <p>
          <strong>Hành động:</strong> {String(getAction(activity))}
        </p>

        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            Xem dữ liệu nhật ký gốc
          </summary>
          <pre style={modalStyles.pre}>{formatValue(activity)}</pre>
        </details>

        <p style={{ ...modalStyles.muted, fontSize: 13, marginTop: 20 }}>
          Nhật ký chỉ được xem. Trang này không cung cấp thao tác chỉnh sửa hoặc
          xóa lịch sử.
        </p>
      </section>
    </div>
  );
}
