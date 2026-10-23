import { useCallback, useEffect, useState } from "react";
import { P, imageUrl, query, request } from "../api";
import { Badge, Icon, Modal, Pager, State } from "../components/UI";

const STAR_FILTERS = [
  { id: "all", label: "Tất cả sao", icon: "⭐" },
  { id: "5", label: "5 sao", icon: "⭐⭐⭐⭐⭐" },
  { id: "4", label: "4 sao", icon: "⭐⭐⭐⭐" },
  { id: "3", label: "3 sao", icon: "⭐⭐⭐" },
  { id: "2", label: "2 sao", icon: "⭐⭐" },
  { id: "1", label: "1 sao", icon: "⭐" },
  { id: "1-2", label: "1–2 sao (Cần lưu ý)", icon: "⚠️", isWarning: true },
];

const REPLY_TEMPLATES = [
  {
    label: "Cảm ơn khách hàng",
    content:
      "Cảm ơn bạn đã tin tưởng và ủng hộ StoreHub! Chúc bạn có trải nghiệm thật tuyệt vời cùng sản phẩm nhé.",
  },
  {
    label: "Hỗ trợ đổi trả & bảo hành",
    content:
      "StoreHub chân thành xin lỗi vì trải nghiệm chưa được trọn vẹn này. Đội ngũ chăm sóc khách hàng sẽ liên hệ ngay qua số điện thoại để hỗ trợ kiểm tra và đổi trả sản phẩm cho bạn.",
  },
  {
    label: "Ghi nhận đóng góp",
    content:
      "Cảm ơn bạn đã gửi đóng góp quý báu. StoreHub đã chuyển thông tin tới bộ phận chất lượng sản phẩm để tiếp tục hoàn thiện hơn nữa.",
  },
];

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

function StarRating({ rating }) {
  const num = Math.max(0, Math.min(5, Number(rating) || 0));

  return (
    <span className="star-rating-display" aria-label={`${num} trên 5 sao`}>
      <span className="stars-filled">{"★".repeat(num)}</span>
      <span className="stars-empty">{"★".repeat(5 - num)}</span>
      <span className="stars-score">{num}/5</span>
    </span>
  );
}

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({
    totalReviews: 0,
    currentPage: 1,
    totalPages: 1,
    limit: 10,
  });

  const [rating, setRating] = useState("all");
  const [replyStatus, setReplyStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  // Modal phản hồi
  const [activeReplyReview, setActiveReplyReview] = useState(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [savingReply, setSavingReply] = useState(false);

  // Modal xem ảnh đính kèm
  const [previewMediaUrl, setPreviewMediaUrl] = useState(null);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        page,
        limit: 10,
      };

      if (rating && rating !== "all") {
        params.rating = rating;
      }

      if (replyStatus && replyStatus !== "all") {
        params.replyStatus = replyStatus;
      }

      if (searchKeyword && searchKeyword.trim()) {
        params.search = searchKeyword.trim();
      }

      // Ghép chính xác endpoint backend: GET /api/productsRouter/admin/reviews
      const response = await request(`${P}/admin/reviews${query(params)}`);

      if (response.code >= 400) {
        throw new Error(response.message || "Không thể tải đánh giá.");
      }

      setReviews(Array.isArray(response.data) ? response.data : []);

      if (response.pagination) {
        setPagination(response.pagination);
      } else {
        setPagination((prev) => ({
          ...prev,
          totalReviews: Array.isArray(response.data) ? response.data.length : 0,
          totalPages: 1,
          currentPage: page,
        }));
      }
    } catch (err) {
      setReviews([]);
      setError(
        err.message ||
          "Không thể tải đánh giá. Hãy kiểm tra API và quyền quản trị.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, rating, replyStatus, searchKeyword]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleRatingChange = (newRating) => {
    setRating(newRating);
    setPage(1);
  };

  const handleStatusChange = (newStatus) => {
    setReplyStatus(newStatus);
    setPage(1);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearchKeyword(searchInput.trim());
    setPage(1);
  };

  const handleSearchReset = () => {
    setSearchInput("");
    setSearchKeyword("");
    setPage(1);
  };

  const openReplyModal = (review) => {
    setActiveReplyReview(review);
    setReplyDraft(review.replyContent || "");
  };

  const closeReplyModal = () => {
    setActiveReplyReview(null);
    setReplyDraft("");
  };

  const handleSaveReply = async (e) => {
    e.preventDefault();
    if (!activeReplyReview) return;

    const content = replyDraft.trim();
    if (!content) {
      setToastMessage("Vui lòng nhập nội dung phản hồi.");
      return;
    }

    if (content.length > 1000) {
      setToastMessage("Nội dung phản hồi không được vượt quá 1000 ký tự.");
      return;
    }

    setSavingReply(true);

    try {
      const response = await request(`${P}/reply-review`, {
        method: "POST",
        body: {
          productId: activeReplyReview.productId,
          reviewId: activeReplyReview._id || activeReplyReview.reviewId,
          replyContent: content,
        },
      });

      if (response.code >= 400) {
        throw new Error(response.message || "Không thể lưu phản hồi.");
      }

      setToastMessage("Đã gửi phản hồi đánh giá cho khách hàng thành công!");
      closeReplyModal();
      await loadReviews();
    } catch (err) {
      setToastMessage(err.message || "Không thể lưu phản hồi.");
    } finally {
      setSavingReply(false);
    }
  };

  // Tính toán nhanh số liệu thống kê
  const totalReviewsCount = pagination.totalReviews || reviews.length;
  const fiveStarCount = reviews.filter(
    (item) => Number(item.rating) === 5,
  ).length;
  const lowStarCount = reviews.filter(
    (item) => Number(item.rating) <= 2 && Number(item.rating) > 0,
  ).length;
  const repliedCount = reviews.filter(
    (item) => item.replyContent && item.replyContent.trim() !== "",
  ).length;
  const unrepliedCount = reviews.length - repliedCount;

  return (
    <div className="reviews-page">
      <div className="welcome">
        <div>
          <span className="eyebrow">QUẢN TRỊ ĐÁNH GIÁ & CSKH · US28 & US29</span>
          <h1>Đánh giá sản phẩm</h1>
          <p>
            Theo dõi ý kiến, mức độ hài lòng của khách hàng (lọc theo 1–5 sao) và
            phản hồi chăm sóc khách hàng kịp thời.
          </p>
        </div>

        <button
          type="button"
          onClick={loadReviews}
          disabled={loading}
          className="btn-refresh"
          title="Tải lại dữ liệu đánh giá"
        >
          {loading ? "Đang tải..." : "Làm mới dữ liệu"}
        </button>
      </div>

      {toastMessage && (
        <div className="toast" role="status" style={{ zIndex: 1100 }}>
          <Icon name="check" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage("")}
            aria-label="Đóng thông báo"
          >
            ×
          </button>
        </div>
      )}

      {/* Thẻ thống kê KPI */}
      <section className="reviews-stats-grid">
        <article className="reviews-stat-card blue">
          <small>Tổng đánh giá hệ thống</small>
          <strong>{totalReviewsCount.toLocaleString("vi-VN")}</strong>
          <span className="vip-stats-subtext">
            {rating === "all" ? "Tất cả các sao" : `Lọc theo: ${rating} sao`}
          </span>
        </article>

        <article className="reviews-stat-card emerald">
          <small>Đánh giá 5 sao (Rất hài lòng)</small>
          <strong>{fiveStarCount}</strong>
          <span className="vip-stats-subtext">Trong trang hiển thị</span>
        </article>

        <article className="reviews-stat-card amber">
          <small>Đánh giá 1–2 sao (Cần lưu ý)</small>
          <strong>{lowStarCount}</strong>
          <span className="vip-stats-subtext">Cần ưu tiên chăm sóc</span>
        </article>

        <article className="reviews-stat-card">
          <small>Tình trạng phản hồi</small>
          <strong style={{ fontSize: 20 }}>
            <span style={{ color: "#16a34a" }}>{repliedCount} đã trả lời</span>{" "}
            /{" "}
            <span style={{ color: "#ea580c" }}>{unrepliedCount} chờ</span>
          </strong>
          <span className="vip-stats-subtext">Tỷ lệ tương tác khách hàng</span>
        </article>
      </section>

      {/* Thanh công cụ và Bộ lọc US28 */}
      <section className="reviews-toolbar-card">
        {/* Hàng bộ lọc nhanh theo số sao */}
        <div className="reviews-chips-row">
          <span className="reviews-chips-label">Lọc theo sao:</span>
          {STAR_FILTERS.map((f) => {
            const isActive = rating === f.id;
            return (
              <button
                type="button"
                key={f.id}
                className={`rating-chip ${f.isWarning ? "warning" : ""} ${
                  isActive ? "active" : ""
                }`}
                onClick={() => handleRatingChange(f.id)}
              >
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>

        {/* Hàng tìm kiếm và lọc trạng thái phản hồi */}
        <div className="reviews-filter-controls">
          <form className="reviews-search-box" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              className="reviews-search-input"
              placeholder="Tìm theo tên khách, sản phẩm, bình luận..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button
              type="submit"
              className="primary"
              style={{ padding: "8px 14px", fontSize: 13 }}
            >
              Tìm
            </button>
            {searchKeyword && (
              <button
                type="button"
                onClick={handleSearchReset}
                className="vip-filter-clear-btn"
                title="Xóa tìm kiếm"
              >
                Xóa lọc
              </button>
            )}
          </form>

          <div className="reviews-status-filter">
            <label htmlFor="reviews-status-select">Trạng thái phản hồi:</label>
            <select
              id="reviews-status-select"
              className="reviews-status-select"
              value={replyStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="unanswered">Chưa phản hồi</option>
              <option value="answered">Đã phản hồi</option>
            </select>
          </div>
        </div>
      </section>

      {/* Khu vực Bảng hiển thị kết quả */}
      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <strong style={{ fontSize: 15, color: "#1e293b" }}>
            Danh sách đánh giá ({totalReviewsCount} kết quả)
          </strong>
          {pagination.totalPages > 1 && (
            <small style={{ color: "#64748b" }}>
              Trang {pagination.currentPage} / {pagination.totalPages}
            </small>
          )}
        </div>

        {error ? (
          <State error={error} retry={loadReviews} />
        ) : loading ? (
          <State loading message="Đang tải danh sách đánh giá từ máy chủ..." />
        ) : reviews.length === 0 ? (
          <State
            empty
            message="Chưa có đánh giá nào phù hợp với bộ lọc hiện tại."
          />
        ) : (
          <div className="table-wrap">
            <table className="reviews-table">
              <thead>
                <tr>
                  <th style={{ width: 180 }}>Khách hàng</th>
                  <th style={{ width: 220 }}>Sản phẩm</th>
                  <th style={{ width: 140 }}>Đánh giá</th>
                  <th>Nội dung nhận xét</th>
                  <th style={{ width: 260 }}>Phản hồi từ StoreHub</th>
                  <th style={{ width: 100, textAlign: "center" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => {
                  const hasReply =
                    Boolean(review.replyContent) &&
                    review.replyContent.trim() !== "";
                  const reviewKey =
                    review._id || review.reviewId || `${review.productId}-${review.createdAt}`;

                  return (
                    <tr key={reviewKey}>
                      {/* Khách hàng */}
                      <td>
                        <div className="review-customer-cell">
                          {review.customerImage ? (
                            <img
                              src={imageUrl(review.customerImage)}
                              alt={review.customerName || "Avatar"}
                              className="review-customer-avatar"
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="review-customer-avatar">
                              {(review.customerName || "K")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}
                          <div>
                            <strong style={{ display: "block", fontSize: 13.5 }}>
                              {review.customerName || "Khách hàng ẩn danh"}
                            </strong>
                            <small style={{ color: "#64748b", fontSize: 12 }}>
                              {formatDate(review.createdAt)}
                            </small>
                          </div>
                        </div>
                      </td>

                      {/* Sản phẩm */}
                      <td>
                        <div className="review-product-cell">
                          {review.productImage ? (
                            <img
                              src={imageUrl(review.productImage)}
                              alt={review.productName || "Sản phẩm"}
                              className="review-product-thumb"
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                          ) : (
                            <div
                              className="review-product-thumb"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Icon name="products" size={20} />
                            </div>
                          )}
                          <div>
                            <strong
                              style={{
                                display: "block",
                                fontSize: 13,
                                color: "#0f172a",
                                lineHeight: 1.4,
                              }}
                              title={review.productName}
                            >
                              {review.productName || "Sản phẩm StoreHub"}
                            </strong>
                            {review.productId && (
                              <small
                                style={{
                                  color: "#94a3b8",
                                  fontSize: 11,
                                  fontFamily: "monospace",
                                }}
                              >
                                #{String(review.productId).slice(-6)}
                              </small>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Số sao đánh giá */}
                      <td>
                        <StarRating rating={review.rating} />
                      </td>

                      {/* Nội dung nhận xét */}
                      <td>
                        <div className="review-comment-wrap">
                          <p className="review-comment-text">
                            {review.content || "Khách hàng không để lại nhận xét bằng lời."}
                          </p>

                          {/* Danh sách ảnh/video đính kèm nếu có */}
                          {Array.isArray(review.media) &&
                            review.media.length > 0 && (
                              <div className="review-media-gallery">
                                {review.media.map((mediaUrl, idx) => (
                                  <img
                                    key={idx}
                                    src={imageUrl(mediaUrl)}
                                    alt={`Ảnh đánh giá ${idx + 1}`}
                                    className="review-media-thumb"
                                    onClick={() =>
                                      setPreviewMediaUrl(imageUrl(mediaUrl))
                                    }
                                    title="Bấm để phóng to xem ảnh"
                                  />
                                ))}
                              </div>
                            )}
                        </div>
                      </td>

                      {/* Trạng thái phản hồi */}
                      <td>
                        <Badge tone={hasReply ? "green" : "amber"}>
                          {hasReply ? "Đã phản hồi" : "Chưa phản hồi"}
                        </Badge>

                        {hasReply ? (
                          <div className="review-reply-bubble">
                            <div className="review-reply-header">
                              <span className="review-reply-badge">
                                💬 Phản hồi từ StoreHub:
                              </span>
                              {review.replyCreatedAt && (
                                <span className="review-reply-date">
                                  {formatDate(review.replyCreatedAt)}
                                </span>
                              )}
                            </div>
                            <p className="review-reply-content">
                              {review.replyContent}
                            </p>
                          </div>
                        ) : (
                          <div style={{ marginTop: 8 }}>
                            <button
                              type="button"
                              className="btn-reply-action primary"
                              onClick={() => openReplyModal(review)}
                            >
                              <Icon name="edit" size={13} />
                              Phản hồi ngay
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className={`btn-reply-action ${
                            hasReply ? "edit" : "primary"
                          }`}
                          onClick={() => openReplyModal(review)}
                          title={
                            hasReply
                              ? "Chỉnh sửa phản hồi này"
                              : "Gửi phản hồi cho khách"
                          }
                        >
                          <Icon name="edit" size={14} />
                          {hasReply ? "Chỉnh sửa" : "Trả lời"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Phân trang */}
        {pagination.totalPages > 1 && (
          <Pager
            page={pagination.currentPage}
            setPage={(newPage) => setPage(newPage)}
            hasNext={pagination.currentPage < pagination.totalPages}
            total={pagination.totalReviews}
          />
        )}
      </section>

      {/* Modal phản hồi đánh giá (US29) */}
      {activeReplyReview && (
        <Modal
          title={
            activeReplyReview.replyContent
              ? "Chỉnh sửa phản hồi đánh giá"
              : "Phản hồi đánh giá khách hàng"
          }
          close={closeReplyModal}
          busy={savingReply}
          className="modal-review-reply"
        >
          <form onSubmit={handleSaveReply}>
            <div className="modal-body" style={{ padding: "20px 24px" }}>
              {/* Thông tin tóm tắt đánh giá */}
              <div className="review-reply-context">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <strong>{activeReplyReview.customerName || "Khách hàng"}</strong>
                  <StarRating rating={activeReplyReview.rating} />
                </div>
                <div style={{ color: "#475569", marginBottom: 6 }}>
                  Sản phẩm: <strong>{activeReplyReview.productName}</strong>
                </div>
                <p
                  style={{
                    margin: 0,
                    color: "#64748b",
                    fontStyle: "italic",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  "{activeReplyReview.content || "Không có nội dung nhận xét"}"
                </p>
              </div>

              {/* Mẫu phản hồi nhanh */}
              <div>
                <label
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#475569",
                    display: "block",
                  }}
                >
                  Gợi ý phản hồi nhanh:
                </label>
                <div className="review-reply-templates">
                  {REPLY_TEMPLATES.map((tmpl, idx) => (
                    <button
                      type="button"
                      key={idx}
                      className="template-chip-btn"
                      onClick={() => setReplyDraft(tmpl.content)}
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ô soạn thảo phản hồi */}
              <label
                className="field"
                style={{ display: "flex", flexDirection: "column", gap: 6 }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                  Nội dung phản hồi công khai của cửa hàng *
                </span>
                <textarea
                  rows={5}
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  placeholder="Nhập nội dung phản hồi gửi đến khách hàng..."
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13.5,
                    lineHeight: 1.5,
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                  required
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: replyDraft.length > 1000 ? "#dc2626" : "#94a3b8",
                    fontSize: 11.5,
                  }}
                >
                  <span>Phản hồi sẽ được hiển thị công khai trên ứng dụng.</span>
                  <span>{replyDraft.length} / 1000 ký tự</span>
                </div>
              </label>
            </div>

            <footer>
              <button
                type="button"
                onClick={closeReplyModal}
                disabled={savingReply}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="primary"
                disabled={savingReply || !replyDraft.trim()}
              >
                {savingReply ? "Đang gửi..." : "Gửi phản hồi"}
              </button>
            </footer>
          </form>
        </Modal>
      )}

      {/* Modal phóng to xem ảnh đính kèm */}
      {previewMediaUrl && (
        <Modal
          title="Ảnh đánh giá từ khách hàng"
          close={() => setPreviewMediaUrl(null)}
          className="modal-media-view"
        >
          <div
            className="modal-body"
            style={{
              padding: 20,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              background: "#0f172a",
            }}
          >
            <img
              src={previewMediaUrl}
              alt="Ảnh đánh giá phóng to"
              style={{
                maxWidth: "100%",
                maxHeight: "75vh",
                borderRadius: 8,
                objectFit: "contain",
              }}
            />
          </div>
          <footer>
            <button type="button" onClick={() => setPreviewMediaUrl(null)}>
              Đóng
            </button>
          </footer>
        </Modal>
      )}
    </div>
  );
}
