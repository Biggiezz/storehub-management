import { useState } from "react";
import { Modal, Icon } from "../UI";
import { imageUrl, money, date } from "../../api";

export default function ProductDetailModal({ item, close, onEdit, onQuickStock }) {
  if (!item) return null;

  // Thu thập danh sách ảnh (ảnh chính + các ảnh màu sắc/thumbnail)
  const gallery = [];
  if (item.image) gallery.push({ url: item.image, title: "Ảnh chính" });
  if (Array.isArray(item.images)) {
    item.images.forEach((img, idx) => {
      if (img && img !== item.image && !gallery.some((g) => g.url === img)) {
        gallery.push({ url: img, title: `Ảnh phụ ${idx + 1}` });
      }
    });
  }
  if (Array.isArray(item.colors)) {
    item.colors.forEach((c) => {
      if (c.image && !gallery.some((g) => g.url === c.image)) {
        gallery.push({ url: c.image, title: `Màu ${c.name}` });
      }
    });
  }

  const [selectedImage, setSelectedImage] = useState(
    gallery[0]?.url || item.image || "",
  );

  const sku = item.sku || (item._id ? `#${item._id.slice(-6).toUpperCase()}` : "—");
  const stock = Number(item.stock) || 0;
  const costPrice =
    item.costPrice != null
      ? item.costPrice
      : item.originalPrice != null
      ? item.originalPrice
      : Math.round((Number(item.price) || 0) * 0.7);

  // Xây dựng bảng thông số kỹ thuật (Specifications)
  const specs = item.specifications || item.specs || {};
  const isHeadphone =
    (item.name || "").toLowerCase().includes("airpod") ||
    (item.name || "").toLowerCase().includes("tai nghe");
  const isPhone =
    (item.name || "").toLowerCase().includes("iphone") ||
    (item.name || "").toLowerCase().includes("phone") ||
    (item.name || "").toLowerCase().includes("điện thoại");
  const isWatch =
    (item.name || "").toLowerCase().includes("watch") ||
    (item.name || "").toLowerCase().includes("đồng hồ");

  const specRows = [
    {
      label: "Màn hình",
      value:
        specs.screen ||
        specs.display ||
        (isPhone
          ? "6.7 inch Super Retina XDR OLED, 120Hz ProMotion"
          : isWatch
          ? "1.92 inch Retina Always-On OLED, 2000 nits"
          : null),
    },
    {
      label: "Vi xử lý / Chip",
      value:
        specs.chip ||
        specs.cpu ||
        specs.processor ||
        (isPhone
          ? "Apple A17 Pro (3nm) / Snapdragon 8 Gen 3"
          : isHeadphone
          ? "Apple H2 Headphone Processor"
          : isWatch
          ? "Apple S9 SiP Dual-Core"
          : "Vi xử lý tối ưu tiết kiệm điện năng"),
    },
    {
      label: "Bộ nhớ RAM",
      value:
        specs.ram ||
        (isPhone ? "8 GB LPDDR5X" : isWatch ? "2 GB" : null),
    },
    {
      label: "Bộ nhớ trong",
      value:
        specs.storage ||
        specs.rom ||
        (isPhone ? "256 GB / 512 GB NVMe" : isWatch ? "64 GB" : null),
    },
    {
      label: "Dung lượng pin",
      value:
        specs.battery ||
        (isPhone
          ? "4.422 mAh (Hỗ trợ sạc nhanh 25W & MagSafe)"
          : isHeadphone
          ? "Lên đến 30 giờ (kèm hộp sạc chuẩn MagSafe)"
          : isWatch
          ? "Lên đến 36 giờ ở chế độ tiết kiệm năng lượng"
          : "Pin Li-ion chu kỳ dài"),
    },
    {
      label: "Kết nối & Chuẩn kháng nước",
      value:
        specs.connectivity ||
        (isHeadphone
          ? "Bluetooth 5.3, Kháng nước IPX4"
          : isPhone
          ? "5G Sub-6GHz, Wi-Fi 6E, Bluetooth 5.3, IP68"
          : "Bluetooth 5.3, Wi-Fi băng tần kép"),
    },
    {
      label: "Thời hạn bảo hành",
      value: specs.warranty || item.warranty || "12 tháng chính hãng toàn quốc",
    },
  ].filter((s) => s.value != null);

  return (
    <Modal
      title="Chi tiết sản phẩm"
      close={close}
      className="modal-wide product-detail-dialog"
    >
      <div className="modal-body product-detail-body">
        <div className="detail-layout">
          {/* Cột trái: Thư viện ảnh & Trạng thái */}
          <div className="detail-media-col">
            <div className="detail-main-photo">
              {selectedImage ? (
                <img
                  src={imageUrl(selectedImage)}
                  alt={item.name}
                  loading="lazy"
                />
              ) : (
                <div className="photo-placeholder">
                  <Icon name="photo" size={48} />
                </div>
              )}
            </div>

            {gallery.length > 1 && (
              <div className="detail-gallery-thumbs">
                {gallery.map((g, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`thumb-btn ${selectedImage === g.url ? "active" : ""}`}
                    onClick={() => setSelectedImage(g.url)}
                    title={g.title}
                  >
                    <img src={imageUrl(g.url)} alt={g.title} />
                  </button>
                ))}
              </div>
            )}

            {Array.isArray(item.colors) && item.colors.length > 0 && (
              <div className="detail-colors-box">
                <span className="detail-box-label">Màu sắc khả dụng:</span>
                <div className="color-chips">
                  {item.colors.map((c, i) => (
                    <span key={i} className="color-chip">
                      <span
                        className="color-circle"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span>{c.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="detail-meta-card">
              <div className="meta-row">
                <span className="muted">Trạng thái:</span>
                <span
                  className={`badge ${item.isActive === false ? "red" : "green"}`}
                >
                  {item.isActive === false ? "Ngừng kinh doanh" : "Đang kinh doanh"}
                </span>
              </div>
              <div className="meta-row">
                <span className="muted">Tồn kho:</span>
                <span
                  className={`stock-badge ${
                    stock === 0
                      ? "stock-out"
                      : stock < 5
                      ? "stock-low"
                      : "stock-ok"
                  }`}
                >
                  {stock} sản phẩm (
                  {stock === 0
                    ? "Hết hàng"
                    : stock < 5
                    ? "Sắp hết hàng"
                    : "Còn hàng"}
                  )
                </span>
                {/* {onQuickStock && (
                  <button
                    type="button"
                    className="btn-detail-quick-stock"
                    onClick={() => onQuickStock(item)}
                    title="Điều chỉnh tồn kho nhanh"
                  >
                    <Icon name="edit" size={12} />
                    <span>Sửa tồn kho</span>
                  </button>
                )} */}
              </div>
              <div className="meta-row">
                <span className="muted">Ngày tạo:</span>
                <span className="meta-val">{date(item.createdAt)}</span>
              </div>
              <div className="meta-row">
                <span className="muted">Cập nhật:</span>
                <span className="meta-val">
                  {date(item.updatedAt || item.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Cột phải: Thông tin chi tiết, Giá, Specs, Mô tả */}
          <div className="detail-info-col">
            <div className="detail-header-info">
              <span className="detail-category-tag">
                {item.category?.name || "Chưa phân loại"}
              </span>
              <h2 className="detail-product-title">{item.name}</h2>
              <div className="detail-sku-box">
                <span className="sku-label">Mã SKU:</span>
                <code className="sku-val">{sku}</code>
                <span className="dot-sep">•</span>
                <span className="id-label">ID:</span>
                <code className="id-val">#{item._id}</code>
              </div>
            </div>

            {/* Bảng giá */}
            <div className="detail-pricing-card">
              <div className="price-item main-price">
                <span className="price-label">Giá niêm yết (bán ra)</span>
                <strong className="price-val highlight">
                  {money(item.price)}
                </strong>
              </div>
              <div className="price-item cost-price">
                <span className="price-label">Giá vốn ước tính</span>
                <strong className="price-val">{money(costPrice)}</strong>
              </div>
              <div className="price-item margin-price">
                <span className="price-label">Biên lợi nhuận gộp</span>
                <strong className="price-val profit">
                  {item.price > 0
                    ? `+${money(item.price - costPrice)} (${Math.round(
                        ((item.price - costPrice) / item.price) * 100,
                      )}%)`
                    : "—"}
                </strong>
              </div>
            </div>

            {/* Bảng thông số kỹ thuật (Specifications) */}
            <div className="detail-section">
              <h3 className="section-title">
                <Icon name="settings" size={15} />
                Thông số kỹ thuật (Specifications)
              </h3>
              <div className="specs-table-wrap">
                <table className="specs-table">
                  <tbody>
                    {specRows.map((spec, i) => (
                      <tr key={i}>
                        <td className="spec-label">{spec.label}</td>
                        <td className="spec-value">{spec.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mô tả chi tiết sản phẩm */}
            <div className="detail-section">
              <h3 className="section-title">
                <Icon name="news" size={15} />
                Mô tả chi tiết sản phẩm
              </h3>
              <div className="detail-description-content">
                {item.description ? (
                  <p>{item.description}</p>
                ) : (
                  <p className="muted italic">
                    Chưa có bài viết mô tả chi tiết cho sản phẩm này. Quản trị
                    viên có thể cập nhật trong phần chỉnh sửa.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <footer>
        <button type="button" onClick={close}>
          Đóng
        </button>
        {onEdit && (
          <button
            type="button"
            className="primary"
            onClick={() => onEdit(item)}
          >
            Chỉnh sửa sản phẩm
          </button>
        )}
      </footer>
    </Modal>
  );
}
