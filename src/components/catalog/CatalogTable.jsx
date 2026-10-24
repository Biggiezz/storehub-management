import { useState, useMemo } from "react";
import {
  request,
  P,
  money,
  isSuper,
  isCanonicalAdmin,
  getCategoryOverrides,
  saveCategoryOverride,
} from "../../api";
import { useResource } from "../../hooks";
import { Icon, State, Photo, Badge, Pager, Modal } from "../UI";
import ProductDetailModal from "./ProductDetailModal";
import QuickStockModal from "./QuickStockModal";
import CatalogEditorModal from "./CatalogEditorModal";

export default function CatalogTable({
  kind,
  c,
  user,
  notify,
  path,
  page,
  setPage,
  term,
  stockStatus,
  categoryStatusFilter,
  categories,
  categoryError,
}) {
  const { data, loading, error, reload } = useResource(path);
  const productsResource = useResource(
    kind === "categories"
      ? `${P}/search-product?limit=1000&showInactive=true`
      : `${P}/get-categories`,
  );

  const categoryProductCounts = useMemo(() => {
    const counts = {};
    const prods = productsResource.data?.data;
    if (Array.isArray(prods)) {
      prods.forEach((p) => {
        const catId = p.category?._id || p.category;
        if (catId) {
          counts[catId] = (counts[catId] || 0) + 1;
        }
      });
    }
    return counts;
  }, [productsResource.data]);

  const [editing, setEditing] = useState(null);
  const [detailing, setDetailing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [quickStockItem, setQuickStockItem] = useState(null);
  const [togglingIds, setTogglingIds] = useState({});
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  function handleStockSaved(productId, newStock) {
    if (data?.data) {
      const target = data.data.find((x) => x._id === productId);
      if (target) {
        target.stock = newStock;
      }
    }
    reload();
  }

  async function handleToggleProductStatus(product) {
    if (!product || !product._id || togglingIds[product._id]) return;

    const previousActive = product.isActive !== false;
    const nextActive = !previousActive;

    // 1. Đổi trạng thái hiển thị tức thì trên giao diện (Optimistic UI)
    product.isActive = nextActive;
    setTogglingIds((prev) => ({ ...prev, [product._id]: true }));

    try {
      const form = new FormData();
      if (product.name) form.set("name", product.name);
      if (product.category?._id || product.category) {
        form.set("category", product.category?._id || product.category);
      }
      if (product.price != null) form.set("price", String(product.price));
      if (product.costPrice != null) form.set("costPrice", String(product.costPrice));
      if (product.sku) form.set("sku", product.sku);
      if (product.stock != null) form.set("stock", String(product.stock));
      if (product.description) form.set("description", product.description);
      if (product.colors) form.set("colors", JSON.stringify(product.colors));
      if (product.images) {
        form.set(
          "images",
          Array.isArray(product.images)
            ? JSON.stringify(product.images)
            : String(product.images),
        );
      }
      form.set("isActive", String(nextActive));

      await request(`${P}/update-product/${product._id}`, {
        method: "PUT",
        body: form,
      });

      // 2. Thông báo toast theo đúng yêu cầu AC1 của US12
      notify(
        nextActive
          ? "Đã bật kinh doanh sản phẩm"
          : "Đã tạm ngừng kinh doanh sản phẩm",
      );
    } catch (err) {
      // Revert nếu có lỗi
      product.isActive = previousActive;
      notify(err.message || "Cập nhật trạng thái sản phẩm thất bại.");
    } finally {
      setTogglingIds((prev) => {
        const next = { ...prev };
        delete next[product._id];
        return next;
      });
      reload();
    }
  }

  async function handleToggleCategoryStatus(category) {
    if (!category || !category._id || togglingIds[category._id]) return;

    const previousActive = category.isActive !== false;
    const nextActive = !previousActive;

    // 1. Đổi trạng thái hiển thị tức thì trên giao diện (Optimistic UI)
    category.isActive = nextActive;
    saveCategoryOverride(category._id, { ...category, isActive: nextActive });
    setTogglingIds((prev) => ({ ...prev, [category._id]: true }));

    try {
      const form = new FormData();
      if (category.name) form.set("name", category.name);
      if (category.slug) form.set("slug", category.slug);
      if (category.description) form.set("description", category.description);
      if (category.orderIndex || category.sortOrder) {
        form.set("orderIndex", String(category.orderIndex || category.sortOrder));
      }
      form.set("isActive", String(nextActive));

      await request(`${P}/update-category/${category._id}`, {
        method: "PUT",
        body: form,
      });

      // 2. Thông báo toast theo đúng yêu cầu AC3 của US15
      notify(
        nextActive
          ? `Đã bật hiển thị danh mục "${category.name}" trên sàn.`
          : `Đã tạm ẩn danh mục "${category.name}". Các sản phẩm bên trong vẫn giữ nguyên liên kết.`,
      );
    } catch (err) {
      // Revert nếu có lỗi
      category.isActive = previousActive;
      saveCategoryOverride(category._id, { ...category, isActive: previousActive });
      notify(err.message || "Cập nhật trạng thái hiển thị danh mục thất bại.");
    } finally {
      setTogglingIds((prev) => {
        const next = { ...prev };
        delete next[category._id];
        return next;
      });
      reload();
    }
  }

  const rawAll = data?.data || [];
  const all = useMemo(() => {
    if (kind !== "categories") return rawAll;
    const overrides = getCategoryOverrides();
    const map = new Map();

    // 1. Dữ liệu từ API get-categories
    if (Array.isArray(rawAll)) {
      rawAll.forEach((cat) => {
        if (cat && cat._id) {
          map.set(cat._id, { ...cat });
        }
      });
    }

    // 2. Fallback trích xuất danh mục từ danh sách sản phẩm (khi BE get-categories chỉ trả về các danh mục isActive=true)
    const prods = productsResource.data?.data;
    if (Array.isArray(prods)) {
      prods.forEach((p) => {
        const cat = p.category;
        if (cat && typeof cat === "object" && cat._id) {
          if (!map.has(cat._id)) {
            map.set(cat._id, { ...cat });
          }
        }
      });
    }

    // 3. Giữ lại các danh mục trong overrides lưu ở localStorage/sessionStorage
    Object.values(overrides).forEach((ovrCat) => {
      if (ovrCat && ovrCat._id) {
        const existing = map.get(ovrCat._id) || {};
        map.set(ovrCat._id, { ...existing, ...ovrCat });
      }
    });

    // 4. Áp dụng override mới nhất lên từng danh mục
    return Array.from(map.values()).map((cat) => {
      const ovr = overrides[cat._id];
      return ovr ? { ...cat, ...ovr } : cat;
    });
  }, [rawAll, kind, productsResource.data]);

  const rows =
    kind === "products"
      ? all.filter((x) => {
          // Lọc theo trạng thái kho hàng
          if (stockStatus) {
            const stock = Number(x.stock) || 0;
            if (stockStatus === "in_stock" && stock < 5) return false;
            if (stockStatus === "low_stock" && (stock <= 0 || stock >= 5))
              return false;
            if (stockStatus === "out_of_stock" && stock !== 0) return false;
          }
          // Tìm kiếm theo cả tên sản phẩm lẫn mã SKU
          if (term) {
            const t = term.trim().toLowerCase();
            const rawT = t.replace(/^#/, "");
            const name = (x.name || "").toLowerCase();
            const sku = (x.sku || "").toLowerCase();
            const fullId = (x._id || "").toLowerCase();
            const shortId = (
              x._id ? `#${x._id.slice(-6).toUpperCase()}` : ""
            ).toLowerCase();
            const rawShortId = (x._id ? x._id.slice(-6) : "").toLowerCase();

            const matchName = name.includes(t);
            const matchSku = sku.includes(t);
            const matchId =
              shortId.includes(t) ||
              rawShortId.includes(rawT) ||
              fullId.includes(rawT);

            if (!matchName && !matchSku && !matchId) return false;
          }
          return true;
        })
      : kind === "categories"
      ? all.filter((x) => {
          if (categoryStatusFilter === "active" && x.isActive === false)
            return false;
          if (categoryStatusFilter === "inactive" && x.isActive !== false)
            return false;
          if (term) {
            return (x.name || "")
              .toLocaleLowerCase("vi")
              .includes(term.toLocaleLowerCase("vi"));
          }
          return true;
        })
      : kind === "news"
      ? all.filter((x) =>
          (x.title || x.name || "")
            .toLocaleLowerCase("vi")
            .includes(term.toLocaleLowerCase("vi")),
        )
      : all;

  const allowedDelete = kind !== "products" || isSuper(user);
  const writable = kind !== "news" || isCanonicalAdmin(user);

  async function remove() {
    setBusy(true);
    setActionError("");
    try {
      await request(c.base + c.remove + deleting._id, { method: "DELETE" });
      setDeleting(null);
      notify("Đã xóa thành công.");
      if (all.length === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const isDataLoading =
    loading ||
    (kind === "categories" && productsResource.loading && !all.length);

  return (
    <>
      <div className="list-heading">
        <span>
          {kind === "products" && stockStatus
            ? `${rows.length} ${c.singular} (theo bộ lọc kho)`
            : data?.pagination?.totalProducts != null
            ? `${data.pagination.totalProducts} ${c.singular}`
            : `${rows.length} mục trong trang này`}
        </span>
        <div className="actions">
          <button onClick={reload} aria-label="Tải lại">
            <Icon name="refresh" size={16} />
          </button>
          {writable && (
            <button className="primary" onClick={() => setEditing({})}>
              Thêm
            </button>
          )}
        </div>
      </div>
      <State
        loading={isDataLoading}
        error={error}
        empty={!isDataLoading && !error && !rows.length}
        retry={reload}
      />
      {!isDataLoading && !error && rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{kind === "news" ? "Bài viết" : "Tên " + c.singular}</th>
                {kind === "products" ? (
                  <>
                    <th>Danh mục</th>
                    <th>Giá bán</th>
                    <th>Tồn kho</th>
                    <th>Trạng thái</th>
                  </>
                ) : kind === "categories" ? (
                  <>
                    <th>Thứ tự hiển thị</th>
                    <th>Số lượng sản phẩm</th>
                    <th>Trạng thái</th>
                  </>
                ) : (
                  <>
                    <th>Trạng thái</th>
                    <th>Tác giả</th>
                    <th>Lượt xem</th>
                  </>
                )}
                <th className="align-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x, idx) => (
                <tr key={x._id}>
                  <td>
                    <div className="identity">
                      <Photo
                        key={x.image}
                        src={x.image}
                        name={x.name || x.title}
                      />
                      <div>
                        <strong>{x.name || x.title}</strong>
                        {kind === "products" ? (
                          <small className="product-sku-code">
                            SKU: {x.sku || `#${(x._id || "").slice(-6).toUpperCase()}`}
                          </small>
                        ) : kind === "categories" ? (
                          <small className="category-id-code">
                            Mã: #{x._id ? x._id.slice(-6).toUpperCase() : ""}
                          </small>
                        ) : (
                          <small>
                            {kind === "users"
                              ? x.email
                              : `#${(x._id || "").slice(-8).toUpperCase()}`}
                          </small>
                        )}
                      </div>
                    </div>
                  </td>
                  {kind === "products" ? (
                    <>
                      <td>{x.category?.name || "Chưa phân loại"}</td>
                      <td className="nowrap strong">{money(x.price)}</td>
                      <td>
                        <button
                          type="button"
                          className="stock-cell-button"
                          onClick={() => setQuickStockItem(x)}
                          title="Click để điều chỉnh nhanh số lượng tồn kho"
                          aria-label={`Điều chỉnh tồn kho cho ${x.name}, hiện tại: ${x.stock ?? 0}`}
                        >
                          <span
                            className={`stock-badge ${
                              (x.stock ?? 0) === 0
                                ? "stock-out"
                                : (x.stock ?? 0) < 5
                                ? "stock-low"
                                : "stock-ok"
                            }`}
                          >
                            {x.stock ?? 0}
                          </span>
                          <span className="stock-edit-icon" title="Chỉnh sửa nhanh tồn kho">
                            <Icon name="edit" size={13} />
                          </span>
                        </button>
                      </td>
                      <td>
                        <div className="status-toggle-cell">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={x.isActive !== false}
                            aria-label={`Chuyển trạng thái kinh doanh cho ${x.name}`}
                            className={`status-toggle-switch ${
                              x.isActive !== false ? "active" : "inactive"
                            } ${togglingIds[x._id] ? "loading" : ""}`}
                            disabled={!writable || !!togglingIds[x._id]}
                            onClick={() => handleToggleProductStatus(x)}
                            title={
                              x.isActive !== false
                                ? "Click để tạm ngừng kinh doanh"
                                : "Click để bật kinh doanh"
                            }
                          >
                            <span className="toggle-thumb">
                              {togglingIds[x._id] && (
                                <span className="toggle-spinner" />
                              )}
                            </span>
                          </button>
                          <span
                            className={`status-toggle-label ${
                              x.isActive !== false ? "active" : "inactive"
                            }`}
                          >
                            {togglingIds[x._id]
                              ? "Đang lưu…"
                              : x.isActive !== false
                              ? "Đang bán"
                              : "Ngừng bán"}
                          </span>
                        </div>
                      </td>
                    </>
                  ) : kind === "categories" ? (
                    <>
                      <td>
                        <span
                          className="category-order-badge"
                          title={`Thứ tự ưu tiên sắp xếp: #${x.orderIndex || x.sortOrder || idx + 1}`}
                        >
                          <span className="order-hash">#</span>
                          <strong>{x.orderIndex || x.sortOrder || idx + 1}</strong>
                        </span>
                      </td>
                      <td>
                        <span
                          className={`category-product-count-badge ${
                            (categoryProductCounts[x._id] ?? x.productCount ?? 0) === 0
                              ? "empty"
                              : ""
                          }`}
                        >
                          <Icon name="products" size={13} />
                          <strong>
                            {categoryProductCounts[x._id] ??
                              x.productCount ??
                              0}
                          </strong>
                          <span>sản phẩm</span>
                        </span>
                      </td>
                      <td>
                        <div className="status-toggle-cell">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={x.isActive !== false}
                            aria-label={`Chuyển trạng thái hiển thị cho danh mục ${x.name}`}
                            className={`status-toggle-switch ${
                              x.isActive !== false ? "active" : "inactive"
                            } ${togglingIds[x._id] ? "loading" : ""}`}
                            disabled={!writable || !!togglingIds[x._id]}
                            onClick={() => handleToggleCategoryStatus(x)}
                            title={
                              x.isActive !== false
                                ? "Click để chuyển sang Tạm ẩn (ẩn khỏi sàn người dùng)"
                                : "Click để Bật hiển thị ra sàn người dùng"
                            }
                          >
                            <span className="toggle-thumb">
                              {togglingIds[x._id] && (
                                <span className="toggle-spinner" />
                              )}
                            </span>
                          </button>
                          <span
                            className={`status-toggle-label ${
                              x.isActive !== false ? "active" : "inactive"
                            }`}
                          >
                            {togglingIds[x._id]
                              ? "Đang lưu…"
                              : x.isActive !== false
                              ? "Đang hiển thị"
                              : "Tạm ẩn"}
                          </span>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <Badge>{x.status}</Badge>
                      </td>
                      <td>{x.author}</td>
                      <td>{x.views || 0}</td>
                    </>
                  )}
                  <td>
                    <div className="actions end">
                      {kind === "products" && (
                        <button
                          type="button"
                          className="btn-detail"
                          onClick={() => setDetailing(x)}
                        >
                          Chi tiết
                        </button>
                      )}
                      {writable && <button onClick={() => setEditing(x)}>Sửa</button>}
                      {kind === "categories" && writable && (
                        <button
                          type="button"
                          className={
                            x.isActive === false
                              ? "btn-unhide-category"
                              : "btn-hide-category"
                          }
                          disabled={!!togglingIds[x._id]}
                          onClick={() => handleToggleCategoryStatus(x)}
                          title={
                            x.isActive === false
                              ? "Bật lại hiển thị danh mục trên sàn người dùng"
                              : "Tạm ẩn danh mục khỏi sàn (vẫn bảo toàn liên kết sản phẩm)"
                          }
                        >
                          {togglingIds[x._id]
                            ? "Đang lưu…"
                            : x.isActive === false
                            ? "Bật hiển thị"
                            : "Tạm ẩn"}
                        </button>
                      )}
                      {/* Nút xóa sản phẩm được ẩn theo yêu cầu US08, nút xóa danh mục được loại bỏ theo US15 AC3 để thay thế bằng Bật/Tắt hiển thị */}
                      {!["products", "categories"].includes(kind) &&
                        allowedDelete &&
                        writable &&
                        x._id !== user._id && (
                          <button
                            className="danger-link"
                            onClick={() => {
                              setDeleting(x);
                              setActionError("");
                            }}
                          >
                            Xóa
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {kind !== "categories" && data && (
        <Pager
          page={page}
          setPage={setPage}
          total={stockStatus ? rows.length : data.pagination?.totalProducts}
          hasNext={
            stockStatus
              ? false
              : data.pagination
              ? page < data.pagination.totalPages
              : all.length === 10
          }
        />
      )}
      {detailing && (
        <ProductDetailModal
          item={detailing}
          close={() => setDetailing(null)}
          onQuickStock={
            writable
              ? (item) => {
                  setDetailing(null);
                  setQuickStockItem(item);
                }
              : null
          }
          onEdit={
            writable
              ? (item) => {
                  setDetailing(null);
                  setEditing(item);
                }
              : null
          }
        />
      )}
      {quickStockItem && (
        <QuickStockModal
          item={quickStockItem}
          close={() => setQuickStockItem(null)}
          saved={handleStockSaved}
          notify={notify}
        />
      )}
      {editing && (
        <CatalogEditorModal
          {...{ kind, c, user, categories, categoryError }}
          existingCategories={kind === "categories" ? all : categories}
          item={editing}
          close={() => setEditing(null)}
          saved={() => {
            setEditing(null);
            reload();
            notify("Đã lưu thay đổi thành công.");
          }}
        />
      )}
      {deleting && (
        <Modal
          title={`Xóa ${c.singular}?`}
          close={() => setDeleting(null)}
          busy={busy}
        >
          <div className="modal-body">
            <p>
              Bạn đang xóa <strong>{deleting.name || deleting.title}</strong>.
              Thao tác này xóa dữ liệu trên hệ thống và không thể hoàn tác.
            </p>
            {actionError && (
              <p className="error" role="alert">
                {actionError}
              </p>
            )}
          </div>
          <footer>
            <button disabled={busy} onClick={() => setDeleting(null)}>
              Giữ lại
            </button>
            <button className="danger" disabled={busy} onClick={remove}>
              {busy ? "Đang xóa…" : "Xác nhận xóa"}
            </button>
          </footer>
        </Modal>
      )}
    </>
  );
}
