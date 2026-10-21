import { useState } from "react";
import { Modal, Icon, Photo } from "../UI";
import { P, request } from "../../api";

export default function QuickStockModal({ item, close, saved, notify }) {
  if (!item) return null;
  const currentStock = Number(item.stock) || 0;
  const [stockVal, setStockVal] = useState(String(currentStock));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const numVal = parseInt(stockVal, 10);
  const isOutOfStock = !isNaN(numVal) && numVal === 0;
  const isLowStock = !isNaN(numVal) && numVal > 0 && numVal < 5;

  async function submit(e) {
    e.preventDefault();
    const newStock = parseInt(stockVal, 10);
    if (isNaN(newStock) || newStock < 0) {
      setError("Số lượng tồn kho phải là một số nguyên không âm (>= 0).");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      if (item.name) form.set("name", item.name);
      if (item.category?._id || item.category) {
        form.set("category", item.category?._id || item.category);
      }
      if (item.price != null) form.set("price", String(item.price));
      if (item.costPrice != null) form.set("costPrice", String(item.costPrice));
      if (item.sku) form.set("sku", item.sku);
      if (item.description) form.set("description", item.description);
      if (item.isActive != null) form.set("isActive", String(item.isActive));
      if (item.colors) form.set("colors", JSON.stringify(item.colors));
      if (item.images) {
        form.set(
          "images",
          Array.isArray(item.images)
            ? JSON.stringify(item.images)
            : String(item.images),
        );
      }
      form.set("stock", String(newStock));

      await request(`${P}/update-product/${item._id}`, {
        method: "PUT",
        body: form,
      });

      notify(`Cập nhật tồn kho sản phẩm "${item.name}" thành ${newStock} thành công.`);
      saved(item._id, newStock);
      close();
    } catch (err) {
      setError(err.message || "Cập nhật tồn kho thất bại. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Điều chỉnh tồn kho"
      close={close}
      busy={busy}
      className="modal-quick-stock"
    >
      <form onSubmit={submit}>
        <div className="modal-body quick-stock-body">
          <div className="quick-stock-product-info">
            <Photo src={item.image} name={item.name} />
            <div className="quick-stock-meta">
              <strong>{item.name}</strong>
              <div className="quick-stock-sub">
                <span>
                  SKU: <code>{item.sku || `#${(item._id || "").slice(-6).toUpperCase()}`}</code>
                </span>
                <span className="dot-sep">•</span>
                <span>
                  Hiện tại: <strong className="current-stock-val">{currentStock}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="field quick-stock-field">
            <label htmlFor="quick-stock-input">
              <span>Số lượng tồn kho mới *</span>
            </label>
            <div className="quick-stock-input-wrap">
              <button
                type="button"
                className="btn-stock-adjust"
                onClick={() =>
                  setStockVal(String(Math.max(0, (parseInt(stockVal, 10) || 0) - 1)))
                }
                disabled={busy || numVal <= 0}
                title="Giảm 1"
              >
                −
              </button>
              <input
                id="quick-stock-input"
                type="number"
                min="0"
                step="1"
                required
                value={stockVal}
                onChange={(e) => setStockVal(e.target.value)}
                disabled={busy}
                autoFocus
              />
              <button
                type="button"
                className="btn-stock-adjust"
                onClick={() =>
                  setStockVal(String((parseInt(stockVal, 10) || 0) + 1))
                }
                disabled={busy}
                title="Tăng 1"
              >
                +
              </button>
            </div>
          </div>

          {/* Cảnh báo rõ ràng nếu số lượng nhập về 0 */}
          {isOutOfStock && (
            <div className="stock-warning alert-out-of-stock" role="alert">
              <Icon name="lock" size={16} />
              <div>
                <strong>Cảnh báo: Sản phẩm sẽ chuyển sang trạng thái Hết hàng!</strong>
                <p>Khách hàng trên ứng dụng sẽ không thể đặt mua sản phẩm này khi tồn kho bằng 0.</p>
              </div>
            </div>
          )}

          {isLowStock && (
            <div className="stock-warning alert-low-stock" role="alert">
              <Icon name="settings" size={16} />
              <div>
                <strong>Lưu ý: Tồn kho sắp hết (dưới 5 sản phẩm)</strong>
                <p>Sản phẩm sẽ hiển thị cảnh báo tồn thấp trên danh sách quản trị.</p>
              </div>
            </div>
          )}

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>

        <footer>
          <button type="button" disabled={busy} onClick={close}>
            Hủy
          </button>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Đang lưu…" : "Cập nhật tồn kho"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
