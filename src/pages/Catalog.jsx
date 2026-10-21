import { useState, useEffect, useMemo } from "react";
import {
  request,
  P,
  N,
  query,
  money,
  date,
  imageUrl,
  isSuper,
  isCanonicalAdmin,
  toSlug,
  getCategoryOverrides,
  saveCategoryOverride,
} from "../api";
import { useResource } from "../hooks";
import {
  Icon,
  State,
  Photo,
  Badge,
  Pager,
  Modal,
  Field,
  FileField,
} from "../components/UI";
const config = {
  products: {
    title: "Sản phẩm",
    subtitle: "Quản lý danh mục hàng hóa, giá bán và tồn kho.",
    singular: "sản phẩm",
    base: P,
    list: "/search-product",
    add: "/add-product",
    update: "/update-product/",
    remove: "/delete-product/",
  },
  categories: {
    title: "Danh mục",
    subtitle: "Các danh mục đang hoạt động trong cửa hàng.",
    singular: "danh mục",
    base: P,
    list: "/get-categories",
    add: "/add-category",
    update: "/update-category/",
    remove: "/delete-category/",
  },
  news: {
    title: "Tin tức",
    subtitle: "Biên tập và quản lý nội dung hiển thị trên ứng dụng.",
    singular: "bài viết",
    base: N,
    list: "/admin/get-all-news",
    add: "/admin/add-news",
    update: "/admin/update-news/",
    remove: "/admin/delete-news/",
  },
};
export default function Catalog({ kind, user, notify }) {
  const c = config[kind];
  const [search, setSearch] = useState(() => {
    if (kind === "products") {
      try {
        return sessionStorage.getItem("storehub.product.search") || "";
      } catch {
        return "";
      }
    }
    return "";
  });
  const [term, setTerm] = useState(() => {
    if (kind === "products") {
      try {
        const val = sessionStorage.getItem("storehub.product.search") || "";
        sessionStorage.removeItem("storehub.product.search");
        return val;
      } catch {
        return "";
      }
    }
    return "";
  });
  const [filter, setFilter] = useState(""),
    [stockStatus, setStockStatus] = useState(""),
    [categoryStatusFilter, setCategoryStatusFilter] = useState(""),
    [page, setPage] = useState(1);

  useEffect(() => {
    if (kind === "products") {
      try {
        const pending = sessionStorage.getItem("storehub.product.search");
        if (pending) {
          sessionStorage.removeItem("storehub.product.search");
          setSearch(pending);
          setTerm(pending);
          setPage(1);
        }
      } catch {
        // ignore
      }
    }
  }, [kind]);

  const categories = useResource(`${P}/get-categories`);
  const isSkuSearch =
    kind === "products" &&
    term &&
    (term.trim().startsWith("#") ||
      (/^[a-fA-F0-9]{4,8}$/.test(term.trim()) && !term.includes(" ")));

  const path =
    c.base +
    c.list +
    query({
      page,
      limit: 10,
      ...(kind === "products"
        ? {
            keyword: isSkuSearch ? "" : term,
            showInactive: true,
            category: filter,
          }
        : kind === "news"
          ? { status: filter }
          : {}),
    });
  return (
    <>
      <div className="card">
        <div className="toolbar">
          <form
            className="searchbox"
            onSubmit={(e) => {
              e.preventDefault();
              setTerm(search.trim());
              setPage(1);
            }}
          >
            <Icon name="search" />
            <input
              aria-label="Tìm kiếm"
              placeholder={
                kind === "products"
                  ? "Tìm theo tên hoặc mã SKU…"
                  : kind === "news"
                  ? "Tìm tiêu đề trong trang hiện tại…"
                  : `Tìm kiếm ${c.singular}…`
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="searchbox-clear"
                onClick={() => {
                  setSearch("");
                  setTerm("");
                  setPage(1);
                }}
                aria-label="Xóa tìm kiếm"
                title="Xóa tìm kiếm"
              >
                ×
              </button>
            )}
          </form>
          {kind === "categories" ? (
            <select
              aria-label="Lọc trạng thái hiển thị"
              value={categoryStatusFilter}
              onChange={(e) => {
                setCategoryStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trạng thái hiển thị</option>
              <option value="active">Đang hiển thị</option>
              <option value="inactive">Tạm ẩn</option>
            </select>
          ) : (
            <select
              aria-label="Bộ lọc"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">
                {kind === "products" ? "Tất cả danh mục" : "Tất cả trạng thái"}
              </option>
              {kind === "products" ? (
                (categories.data?.data || []).map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="draft">Bản nháp</option>
                  <option value="published">Đã xuất bản</option>
                  <option value="hidden">Đã ẩn</option>
                </>
              )}
            </select>
          )}
          {kind === "products" && (
            <select
              aria-label="Trạng thái kho"
              value={stockStatus}
              onChange={(e) => {
                setStockStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trạng thái kho</option>
              <option value="in_stock">Còn hàng</option>
              <option value="low_stock">Sắp hết hàng</option>
              <option value="out_of_stock">Hết hàng</option>
            </select>
          )}
        </div>
        <CatalogRows
          key={`${path}:${term}:${stockStatus}:${categoryStatusFilter}`}
          {...{
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
          }}
          categories={categories.data?.data || []}
          categoryError={categories.error}
        />
      </div>
      {kind === "categories" && (
        <p className="footnote">
          Chức năng "Bật/Tắt hiển thị danh mục" cho phép tạm ẩn danh mục khỏi sàn
          người dùng mà vẫn bảo toàn liên kết của các sản phẩm bên trong. Chức năng
          xóa danh mục đã được thay thế hoàn toàn bằng cơ chế Tạm ẩn.
        </p>
      )}
    </>
  );
}
function CatalogRows({
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
  const [editing, setEditing] = useState(null),
    [detailing, setDetailing] = useState(null),
    [deleting, setDeleting] = useState(null),
    [quickStockItem, setQuickStockItem] = useState(null),
    [togglingIds, setTogglingIds] = useState({}),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");

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
    // 1. Áp dụng override cho các danh mục trả về từ API
    const merged = rawAll.map((cat) => {
      const ovr = overrides[cat._id];
      return ovr ? { ...cat, ...ovr } : cat;
    });
    // 2. Giữ lại các danh mục tạm ẩn trong overrides nếu API chưa trả về
    Object.values(overrides).forEach((ovrCat) => {
      if (ovrCat && ovrCat._id && !merged.some((c) => c._id === ovrCat._id)) {
        merged.push(ovrCat);
      }
    });
    return merged;
  }, [rawAll, kind]);

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
        loading={loading}
        error={error}
        empty={!loading && !error && !rows.length}
        retry={reload}
      />
      {!loading && !error && rows.length > 0 && (
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
        <Editor
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
function QuickStockModal({ item, close, saved, notify }) {
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

export { toSlug };


function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Editor({
  kind,
  c,
  user,
  categories,
  categoryError,
  existingCategories = [],
  item,
  close,
  saved,
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [colors, setColors] = useState(item.colors || []);

  const [categoryName, setCategoryName] = useState(item.name || "");
  const [categorySlug, setCategorySlug] = useState(
    item.slug || (item.name ? toSlug(item.name) : ""),
  );
  const [isManualSlug, setIsManualSlug] = useState(!!item.slug);
  const [categoryIsActive, setCategoryIsActive] = useState(
    item.isActive !== false,
  );

  const isDuplicateCategoryName =
    kind === "categories" &&
    categoryName.trim() &&
    existingCategories.some(
      (cat) =>
        cat._id !== item._id &&
        (cat.name || "").trim().toLowerCase() === categoryName.trim().toLowerCase(),
    );

  const edit = !!item._id;

  // Khởi tạo danh sách ảnh Gallery ban đầu nếu là sản phẩm
  const [galleryImages, setGalleryImages] = useState(() => {
    if (kind !== "products" || !item) return [];
    const list = [];
    if (item.image) {
      list.push({ url: item.image, name: "Ảnh chính hiện tại", isMain: true, isExisting: true });
    }
    let existingImages = item.images;
    if (typeof existingImages === "string") {
      try {
        existingImages = JSON.parse(existingImages);
      } catch {
        existingImages = [existingImages];
      }
    }
    if (Array.isArray(existingImages)) {
      existingImages.forEach((img, i) => {
        if (img && img !== item.image && !list.some((x) => x.url === img)) {
          list.push({ url: img, name: `Ảnh phụ ${i + 1}`, isMain: false, isExisting: true });
        }
      });
    }
    return list;
  });

  const [urlInput, setUrlInput] = useState("");
  const [uploadError, setUploadError] = useState("");

  // Dọn dẹp object URLs khi unmount
  useEffect(() => {
    return () => {
      galleryImages.forEach((img) => {
        if (img.file && img.previewUrl) {
          try {
            URL.revokeObjectURL(img.previewUrl);
          } catch {}
        }
      });
    };
  }, []);

  function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadError("");

    const newItems = [];
    for (const file of files) {
      // 1. Kiểm tra dung lượng không vượt quá 5MB
      if (file.size > 5 * 1024 * 1024) {
        setUploadError(
          `Ảnh "${file.name}" (${(file.size / (1024 * 1024)).toFixed(
            1,
          )}MB) vượt quá dung lượng tối đa 5MB. Vui lòng chọn ảnh khác.`,
        );
        e.target.value = "";
        return;
      }
      // 2. Kiểm tra định dạng ảnh
      if (!file.type.startsWith("image/")) {
        setUploadError(`Tệp "${file.name}" không phải là định dạng hình ảnh hợp lệ.`);
        e.target.value = "";
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      newItems.push({
        file,
        previewUrl,
        name: file.name,
        isMain: galleryImages.length === 0 && newItems.length === 0,
      });
    }

    setGalleryImages((prev) => [...prev, ...newItems]);
    e.target.value = "";
  }

  function handleAddUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      setUploadError("Vui lòng nhập đường dẫn URL hình ảnh hợp lệ (bắt đầu bằng http:// hoặc https://).");
      return;
    }
    setUploadError("");
    setGalleryImages((prev) => [
      ...prev,
      {
        url: trimmed,
        previewUrl: trimmed,
        name: "Ảnh từ URL",
        isMain: prev.length === 0,
      },
    ]);
    setUrlInput("");
  }

  function removeImage(idx) {
    setGalleryImages((prev) => {
      const target = prev[idx];
      if (target?.file && target?.previewUrl) {
        try {
          URL.revokeObjectURL(target.previewUrl);
        } catch {}
      }
      const updated = prev.filter((_, i) => i !== idx);
      if (target?.isMain && updated.length > 0) {
        updated[0].isMain = true;
      }
      return updated;
    });
  }

  function setMainImage(idx) {
    setGalleryImages((prev) =>
      prev.map((item, i) => ({
        ...item,
        isMain: i === idx,
      })),
    );
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const form = new FormData(e.currentTarget);
      if (!form.get("image")?.size) form.delete("image");
      let body = form;
      if (kind === "products") {
        const price = Number(form.get("price"));
        const costPrice = Number(form.get("costPrice"));
        if (isNaN(price) || price <= 0) {
          throw new Error("Giá bán phải là một số dương lớn hơn 0.");
        }
        if (isNaN(costPrice) || costPrice <= 0) {
          throw new Error("Giá vốn phải là một số dương lớn hơn 0.");
        }
        form.set("price", String(price));
        form.set("costPrice", String(costPrice));

        if (colors.some((x) => !x.name.trim() || !/^#[a-f\d]{6}$/i.test(x.hex)))
          throw new Error("Mỗi màu cần tên và mã HEX hợp lệ.");
        form.set("colors", JSON.stringify(colors));

        if (galleryImages.length === 0 && !edit) {
          throw new Error("Vui lòng tải lên hoặc thêm ít nhất một ảnh sản phẩm.");
        }

        // Chọn ảnh chính gửi cho backend trường 'image'
        const mainImg = galleryImages.find((x) => x.isMain) || galleryImages[0];
        if (mainImg?.file) {
          form.set("image", mainImg.file);
        } else if (mainImg?.url) {
          form.set("image", mainImg.url);
        }

        // Danh sách URL ảnh lưu vào trường 'images'
        const urlList = [];
        for (const img of galleryImages) {
          if (img.url && !img.file) {
            urlList.push(img.url);
          } else if (img.file && img !== mainImg) {
            try {
              const dataUrl = await fileToDataUrl(img.file);
              urlList.push(dataUrl);
            } catch {}
          }
        }
        form.set("images", JSON.stringify(urlList));
      }
      if (kind === "categories") {
        const catName = form.get("name")?.trim();
        if (!catName) {
          throw new Error("Vui lòng nhập tên danh mục.");
        }
        const duplicate = existingCategories.some(
          (cat) =>
            cat._id !== item._id &&
            (cat.name || "").trim().toLowerCase() === catName.toLowerCase(),
        );
        if (duplicate) {
          throw new Error(
            `Tên danh mục "${catName}" đã tồn tại trong danh sách hiện tại. Vui lòng chọn tên khác.`,
          );
        }
        form.set("name", catName);
        if (categorySlug) {
          form.set("slug", categorySlug.trim());
        }
        form.set("isActive", String(categoryIsActive));
        if (item._id) {
          saveCategoryOverride(item._id, {
            ...item,
            name: catName,
            slug: categorySlug.trim(),
            description: form.get("description"),
            orderIndex: form.get("orderIndex"),
            isActive: categoryIsActive,
          });
        }
      }
      await request(c.base + (edit ? c.update + item._id : c.add), {
        method: edit ? "PUT" : "POST",
        body,
      });
      saved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const choices =
    categories.some((x) => x._id === item.category?._id) || !item.category?._id
      ? categories
      : [...categories, item.category];

  return (
    <Modal
      title={`${edit ? "Chỉnh sửa" : "Thêm"} ${c.singular}`}
      close={close}
      busy={busy}
      className={kind === "products" ? "modal-wide" : ""}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="modal-body form-grid">
          {kind === "categories" ? (
            <>
              <Field label="Tên danh mục *">
                <input
                  name="name"
                  required
                  maxLength={250}
                  value={categoryName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCategoryName(val);
                    if (!isManualSlug) {
                      setCategorySlug(toSlug(val));
                    }
                  }}
                  placeholder="VD: Điện thoại & Tablet..."
                />
                {isDuplicateCategoryName && (
                  <p className="field-duplicate-warning" role="alert">
                    ⚠️ Tên danh mục này đã tồn tại trong danh sách hiện tại.
                  </p>
                )}
              </Field>

              <Field label="Đường dẫn SEO (Slug)">
                <div className="slug-input-wrapper">
                  <span className="slug-prefix">/danh-muc/</span>
                  <input
                    name="slug"
                    value={categorySlug}
                    onChange={(e) => {
                      setCategorySlug(e.target.value);
                      setIsManualSlug(true);
                    }}
                    placeholder="dien-thoai-tablet"
                  />
                  <button
                    type="button"
                    className="btn-resync-slug"
                    onClick={() => {
                      const generated = toSlug(categoryName);
                      setCategorySlug(generated);
                      setIsManualSlug(false);
                    }}
                    title="Tạo lại slug tự động từ tên danh mục"
                  >
                    <Icon name="refresh" size={13} />
                    <span>Làm mới</span>
                  </button>
                </div>
                <small className="muted" style={{ margin: "3px 0 0", fontSize: "11px" }}>
                  Đường dẫn chuẩn SEO không dấu (tự động sinh theo tên hoặc tùy chỉnh thủ công).
                </small>
              </Field>

              <Field label="Mô tả ngành hàng">
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={item.description || ""}
                  placeholder="Nhập mô tả tóm tắt cho ngành hàng này..."
                />
              </Field>

              <Field label="Thứ tự hiển thị (trên trang chủ)">
                <input
                  name="orderIndex"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={item.orderIndex || item.sortOrder || 1}
                  placeholder="VD: 1, 2, 3..."
                />
              </Field>

              <Field label="Trạng thái hiển thị">
                <div className="category-status-editor-row">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={categoryIsActive}
                    className={`status-toggle-switch ${
                      categoryIsActive ? "active" : "inactive"
                    }`}
                    onClick={() => setCategoryIsActive(!categoryIsActive)}
                    title={
                      categoryIsActive
                        ? "Click để Tạm ẩn danh mục khỏi sàn"
                        : "Click để Bật hiển thị danh mục ra sàn"
                    }
                  >
                    <span className="toggle-thumb" />
                  </button>
                  <span
                    className={`status-toggle-label ${
                      categoryIsActive ? "active" : "inactive"
                    }`}
                  >
                    {categoryIsActive ? "Đang hiển thị" : "Tạm ẩn (ẩn khỏi sàn)"}
                  </span>
                </div>
                <small className="muted" style={{ margin: "4px 0 0", fontSize: "11px" }}>
                  Khi tạm ẩn, danh mục không xuất hiện trên sàn người dùng nhưng các sản phẩm bên trong vẫn giữ nguyên liên kết.
                </small>
              </Field>
            </>
          ) : (
            <Field
              label={kind === "news" ? "Tiêu đề *" : "Tên *"}
              name={kind === "news" ? "title" : "name"}
              defaultValue={item.title || item.name || ""}
              required
              maxLength={250}
            />
          )}
          {kind === "products" && (
            <>
              <div className="two-col">
                <Field
                  label="Mã SKU (tùy chọn)"
                  name="sku"
                  placeholder="VD: SKU-101, AP-05..."
                  defaultValue={item.sku || ""}
                  maxLength={50}
                />
                <Field
                  label="Số lượng tồn kho *"
                  name="stock"
                  type="number"
                  min="0"
                  step="1"
                  required
                  defaultValue={item.stock ?? 0}
                />
              </div>
              <div className="two-col">
                <Field
                  label="Giá bán (VNĐ) *"
                  name="price"
                  type="number"
                  min="1"
                  step="1"
                  required
                  defaultValue={item.price || ""}
                  placeholder="VD: 16000000"
                />
                <Field
                  label="Giá vốn (VNĐ) *"
                  name="costPrice"
                  type="number"
                  min="1"
                  step="1"
                  required
                  defaultValue={item.costPrice || item.originalPrice || ""}
                  placeholder="VD: 11000000"
                />
              </div>
              <Field label="Danh mục *">
                <select
                  name="category"
                  required
                  defaultValue={item.category?._id || item.category || ""}
                >
                  <option value="">Chọn danh mục</option>
                  {choices.map((x) => (
                    <option key={x._id} value={x._id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>
              {categoryError && <p className="error">{categoryError}</p>}
              {!choices.length && (
                <p className="footnote">
                  Hãy tạo danh mục trước khi thêm sản phẩm.
                </p>
              )}
              <Field label="Trạng thái">
                <select
                  name="isActive"
                  defaultValue={String(item.isActive ?? true)}
                >
                  <option value="true">Đang bán</option>
                  <option value="false">Ngừng bán</option>
                </select>
              </Field>
              <Field label="Mô tả">
                <textarea
                  name="description"
                  defaultValue={item.description || ""}
                  rows={4}
                  placeholder="Nhập mô tả chi tiết sản phẩm..."
                />
              </Field>
              <div className="field">
                <span>Màu sắc</span>
                {colors.map((color, i) => (
                  <div className="color-row" key={i}>
                    <input
                      aria-label={`Tên màu ${i + 1}`}
                      placeholder="Tên màu"
                      value={color.name}
                      onChange={(e) =>
                        setColors(
                          colors.map((v, j) =>
                            j === i ? { ...v, name: e.target.value } : v,
                          ),
                        )
                      }
                    />
                    <input
                      aria-label={`Mã màu ${i + 1}`}
                      type="color"
                      value={color.hex || "#000000"}
                      onChange={(e) =>
                        setColors(
                          colors.map((v, j) =>
                            j === i ? { ...v, hex: e.target.value } : v,
                          ),
                        )
                      }
                    />
                    <label>
                      <input
                        type="radio"
                        name="defaultColor"
                        checked={!!color.isDefault}
                        onChange={() =>
                          setColors(
                            colors.map((v, j) => ({
                              ...v,
                              isDefault: j === i,
                            })),
                          )
                        }
                      />
                      Mặc định
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setColors(colors.filter((_, j) => j !== i))
                      }
                      aria-label={`Xóa màu ${i + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setColors([
                      ...colors,
                      {
                        name: "",
                        hex: "#000000",
                        isDefault: colors.length === 0,
                      },
                    ])
                  }
                >
                  Thêm màu
                </button>
              </div>
            </>
          )}
          {kind === "news" && (
            <>
              <Field label="Nội dung *">
                <textarea
                  name="content"
                  required
                  rows={9}
                  defaultValue={item.content || ""}
                />
              </Field>
              <Field label="Trạng thái">
                <select name="status" defaultValue={item.status || "draft"}>
                  <option value="draft">Bản nháp</option>
                  <option value="published">Xuất bản</option>
                  <option value="hidden">Ẩn</option>
                </select>
              </Field>
            </>
          )}
          {kind === "users" ? (
            <>
              <Field
                label="Email *"
                name="email"
                type="email"
                required
                defaultValue={item.email || ""}
              />
              <Field
                label="Số điện thoại (10 chữ số)"
                name="phone"
                required={!edit}
                pattern="[0-9]{10}"
                defaultValue={item.phone || ""}
              />
              <Field
                label={
                  edit ? "Mật khẩu mới (để trống nếu giữ nguyên)" : "Mật khẩu *"
                }
                name="password"
                type="password"
                required={!edit}
                minLength={8}
                pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,}"
                autoComplete="new-password"
                title="Ít nhất 8 ký tự, gồm chữ và số"
              />
              <Field
                label="Địa chỉ"
                name="address"
                defaultValue={item.address || ""}
              />
              {isSuper(user) && (
                <Field label="Vai trò">
                  <select name="role" defaultValue={item.role || "customer"}>
                    <option value="customer">Khách hàng</option>
                    <option value="admin">Quản trị viên</option>
                    {edit && !["admin", "customer"].includes(item.role) && (
                      <option value={item.role}>{item.role}</option>
                    )}
                  </select>
                </Field>
              )}
            </>
          ) : kind === "products" ? (
            <div className="field product-gallery-uploader">
              <span className="gallery-header-label">
                Thư viện hình ảnh sản phẩm {!edit && galleryImages.length === 0 ? "*" : ""}
              </span>
              <p className="muted" style={{ margin: "3px 0 10px", fontSize: "11px" }}>
                Tải lên nhiều hình ảnh (tối đa 5MB/ảnh) hoặc thêm link URL. Ảnh đầu tiên hoặc ảnh được đánh dấu sẽ làm ảnh đại diện chính.
              </p>

              <div className="gallery-uploader-toolbar">
                <label className="btn-upload-file">
                  <span>Chọn ảnh từ máy tính (nhiều ảnh)</span>
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                    onChange={handleFilesSelected}
                    onCancel={(e) => e.stopPropagation()}
                    style={{ display: "none" }}
                  />
                </label>

                <div className="url-input-group">
                  <input
                    type="url"
                    placeholder="Hoặc dán URL hình ảnh (https://...)..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddUrl();
                      }
                    }}
                  />
                  <button type="button" onClick={handleAddUrl}>
                    Thêm URL
                  </button>
                </div>
              </div>

              {uploadError && (
                <p className="error" style={{ margin: "8px 0 0", fontSize: "12px" }}>
                  {uploadError}
                </p>
              )}

              {galleryImages.length > 0 ? (
                <div className="gallery-preview-grid">
                  {galleryImages.map((img, idx) => (
                    <div
                      key={idx}
                      className={`gallery-preview-card ${img.isMain ? "is-main" : ""}`}
                    >
                      <img
                        src={img.previewUrl || imageUrl(img.url)}
                        alt={img.name || `Ảnh ${idx + 1}`}
                      />
                      <button
                        type="button"
                        className="btn-remove-thumb"
                        onClick={() => removeImage(idx)}
                        title="Xóa ảnh này"
                        aria-label="Xóa ảnh"
                      >
                        ×
                      </button>
                      {img.isMain ? (
                        <span className="badge-main-photo">Ảnh chính</span>
                      ) : (
                        <button
                          type="button"
                          className="btn-set-main"
                          onClick={() => setMainImage(idx)}
                        >
                          Đặt làm chính
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="gallery-empty-state">
                  <Icon name="photo" size={28} />
                  <span>Chưa có hình ảnh nào trong thư viện</span>
                  <small>Định dạng JPG, PNG, WEBP, GIF · Tối đa 5 MB mỗi ảnh</small>
                </div>
              )}
            </div>
          ) : (
            <>
              {item.image && (
                <Photo src={item.image} name="Ảnh hiện tại" large />
              )}
              <FileField required={!edit && kind !== "categories"} />
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </fieldset>
        <footer>
          <button type="button" disabled={busy} onClick={close}>
            Hủy
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

function ProductDetailModal({ item, close, onEdit, onQuickStock }) {
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
