import { useCallback, useEffect, useState } from "react";
import { P, query, request } from "../api";
import { State } from "../components/UI";

const styles = {
  page: {
    padding: 24,
    minHeight: "100%",
    background: "#f8fafc",
    color: "#1f2937",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24,
  },
  subtitle: { color: "#64748b", margin: "6px 0 0" },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  filters: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    fontSize: 13,
    fontWeight: 600,
    color: "#475569",
  },
  select: { minWidth: 180, padding: "10px 12px" },
  button: { padding: "10px 14px" },
  tableWrap: { width: "100%", overflowX: "auto" },
  table: {
    width: "100%",
    minWidth: 950,
    borderCollapse: "collapse",
    fontSize: 14,
  },
  th: {
    padding: "13px 12px",
    background: "#f8fafc",
    color: "#475569",
    textAlign: "left",
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px 12px",
    borderBottom: "1px solid #e2e8f0",
    verticalAlign: "top",
  },
  stars: { color: "#f59e0b", whiteSpace: "nowrap", fontSize: 16 },
  badge: {
    display: "inline-block",
    borderRadius: 20,
    padding: "5px 9px",
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  green: { color: "#166534", background: "#dcfce7" },
  orange: { color: "#9a3412", background: "#ffedd5" },
  muted: { color: "#64748b", fontSize: 13 },
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 14,
    marginBottom: 20,
  },
  stat: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 18,
  },
  statLabel: { color: "#64748b", fontSize: 13, marginBottom: 8 },
  statValue: { fontSize: 25, fontWeight: 750, margin: 0 },
};

function formatDate(value) {
  if (!value) return "—";

  const text = String(value);
  const vnDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (vnDate) {
    return `${vnDate[1].padStart(2, "0")}/${vnDate[2].padStart(
      2,
      "0",
    )}/${vnDate[3]}`;
  }

  const date = new Date(text);

  return Number.isNaN(date.getTime()) ? text : date.toLocaleDateString("vi-VN");
}

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState("all");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
const [replyDrafts, setReplyDrafts] = useState({});
const [editingReplies, setEditingReplies] = useState({});
const [savingReply, setSavingReply] = useState("");
const [replyMessage, setReplyMessage] = useState("");

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await request(
        `${P}/admin-reviews${query({ rating, status })}`,
      );

      if (response.code >= 400) {
        throw new Error(response.message || "Không thể tải đánh giá.");
      }

      setReviews(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setReviews([]);
      setError(
        err.message ||
          "Không thể tải đánh giá. Hãy kiểm tra API và quyền quản trị.",
      );
    } finally {
      setLoading(false);
    }
  }, [rating, status]);

  
  const updateReplyDraft = (reviewKey, value) => {
    if (value.length > 1000) return;

    setReplyDrafts((current) => ({
      ...current,
      [reviewKey]: value,
    }));
  };

  const saveReply = async (review, isEditing = false) => {
    const reviewKey = `${review.productId}-${review._id}`;
    const content = (
      replyDrafts[reviewKey] ?? review.replyContent ?? ""
    ).trim();

    if (!content) {
      setReplyMessage("Vui lòng nhập nội dung phản hồi.");
      return;
    }

    if (content.length > 1000) {
      setReplyMessage("Phản hồi không được vượt quá 1000 ký tự.");
      return;
    }

    setSavingReply(reviewKey);
    setReplyMessage("");

    try {
      const response = await request(`${P}/reply-review`, {
        method: isEditing ? "PUT" : "POST",
        body: {
          productId: review.productId,
          reviewId: review._id,
          replyContent: content,
        },
      });

      if (response.code >= 400) {
        throw new Error(response.message || "Không thể lưu phản hồi.");
      }

      setEditingReplies((current) => ({
        ...current,
        [reviewKey]: false,
      }));

      await loadReviews();
      setReplyMessage("Đã lưu phản hồi thành công.");
    } catch (err) {
      setReplyMessage(err.message || "Không thể lưu phản hồi.");
    } finally {
      setSavingReply("");
    }
  };

  const deleteReply = async (review) => {
    const reviewKey = `${review.productId}-${review._id}`;

    if (!window.confirm("Cô có chắc muốn xóa phản hồi này không?")) {
      return;
    }

    setSavingReply(reviewKey);
    setReplyMessage("");

    try {
      const response = await request(`${P}/reply-review`, {
        method: "DELETE",
        body: {
          productId: review.productId,
          reviewId: review._id,
        },
      });

      if (response.code >= 400) {
        throw new Error(response.message || "Không thể xóa phản hồi.");
      }

      setReplyDrafts((current) => ({
        ...current,
        [reviewKey]: "",
      }));

      setEditingReplies((current) => ({
        ...current,
        [reviewKey]: false,
      }));

      await loadReviews();
      setReplyMessage("Đã xóa phản hồi thành công.");
    } catch (err) {
      setReplyMessage(err.message || "Không thể xóa phản hồi.");
    } finally {
      setSavingReply("");
    }
  };



  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReviews();
  }, [loadReviews]);

  const total = reviews.length;
  const replied = reviews.filter((item) => item.status === "replied").length;
  const unreplied = total - replied;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={{ margin: 0 }}>Đánh giá sản phẩm</h1>
          <p style={styles.subtitle}>
            Theo dõi đánh giá của khách hàng và trạng thái phản hồi.
          </p>
        </div>

        <button
          type="button"
          style={styles.button}
          onClick={loadReviews}
          disabled={loading}
        >
          {loading ? "Đang tải..." : "Làm mới"}
        </button>
      </header>

      <section style={styles.stats}>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Tổng đánh giá phù hợp</div>
          <p style={styles.statValue}>{total}</p>
        </div>

        <div style={styles.stat}>
          <div style={styles.statLabel}>Đã phản hồi</div>
          <p style={{ ...styles.statValue, color: "#16a34a" }}>{replied}</p>
        </div>

        <div style={styles.stat}>
          <div style={styles.statLabel}>Chưa phản hồi</div>
          <p style={{ ...styles.statValue, color: "#ea580c" }}>{unreplied}</p>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.filters}>
          <label style={styles.label}>
            Lọc theo số sao
            <select
              aria-label="Lọc theo số sao"
              value={rating}
              onChange={(event) => setRating(event.target.value)}
              style={styles.select}
            >
              <option value="all">Tất cả số sao</option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value} sao
                </option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Trạng thái phản hồi
            <select
              aria-label="Lọc trạng thái phản hồi"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              style={styles.select}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="replied">Đã phản hồi</option>
              <option value="unreplied">Chưa phản hồi</option>
            </select>
          </label>

          <div style={{ ...styles.muted, alignSelf: "end", paddingBottom: 10 }}>
            {loading ? "Đang tải dữ liệu..." : `${total} đánh giá`}
          </div>
        </div>
      </section>

      {error ? (
        <State error={error} retry={loadReviews} />
      ) : loading ? (
        <State loading message="Đang tải đánh giá..." />
      ) : total === 0 ? (
        <State empty />
      ) : (
        <section style={{ ...styles.card, padding: 0, overflow: "hidden" }}>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Khách hàng</th>
                  <th style={styles.th}>Sản phẩm</th>
                  <th style={styles.th}>Số sao</th>
                  <th style={styles.th}>Nội dung đánh giá</th>
                  <th style={styles.th}>Ngày gửi</th>
                  <th style={styles.th}>Trạng thái phản hồi</th>
                </tr>
              </thead>

              <tbody>
                {reviews.map((review) => {
                  const hasReply = review.status === "replied";

                  return (
                    <tr key={`${review.productId}-${review._id}`}>
                      <td style={styles.td}>
                        <strong>{review.customerName}</strong>
                      </td>

                      <td style={styles.td}>{review.productName}</td>

                      <td style={styles.td}>
                        <span
                          style={styles.stars}
                          aria-label={`${review.rating} trên 5 sao`}
                        >
                          {"★".repeat(
                            Math.max(
                              0,
                              Math.min(5, Number(review.rating) || 0),
                            ),
                          )}
                          <span style={{ color: "#cbd5e1" }}>
                            {"★".repeat(
                              5 -
                                Math.max(
                                  0,
                                  Math.min(5, Number(review.rating) || 0),
                                ),
                            )}
                          </span>
                        </span>
                        <div style={styles.muted}>{review.rating}/5</div>
                      </td>

                      <td
                        style={{
                          ...styles.td,
                          maxWidth: 340,
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {review.content || "Không có nội dung"}
                      </td>

                      <td style={{ ...styles.td, whiteSpace: "nowrap" }}>
                        {formatDate(review.createdAt)}
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            ...(hasReply ? styles.green : styles.orange),
                          }}
                        >
                          {hasReply ? "Đã phản hồi" : "Chưa phản hồi"}
                        </span>

                        {hasReply && (
                          <div
                            style={{
                              marginTop: 8,
                              maxWidth: 240,
                              whiteSpace: "pre-wrap",
                              overflowWrap: "anywhere",
                            }}
                          >
                            <strong style={{ fontSize: 12 }}>
                              Nội dung phản hồi:
                            </strong>
                            <p style={{ margin: "4px 0", fontSize: 13 }}>
                              {review.replyContent}
                            </p>
                            <small>{formatDate(review.replyCreatedAt)}</small>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
