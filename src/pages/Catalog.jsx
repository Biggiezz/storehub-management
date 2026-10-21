import { useState, useEffect } from "react";
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
            <button type="submit">Tìm</button>
          </form>
          {kind !== "categories" && (
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
          key={`${path}:${term}:${stockStatus}`}
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
          }}
          categories={categories.data?.data || []}
          categoryError={categories.error}
        />
      </div>
      {kind === "categories" && (
        <p className="footnote">
          API hiện tại chỉ trả về danh mục đang hoạt động. Giao diện không cung
          cấp thao tác ẩn danh mục để tránh mất khả năng quản lý lại.
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
  categories,
  categoryError,
}) {
  const { data, loading, error, reload } = useResource(path);
  const [editing, setEditing] = useState(null),
    [detailing, setDetailing] = useState(null),
    [deleting, setDeleting] = useState(null),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");
  const all = data?.data || [],
    rows =
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
        : ["news", "categories"].includes(kind)
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
              <Icon name="plus" size={17} />
              Thêm {c.singular}
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
              {rows.map((x) => (
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
                      </td>
                      <td>
                        <Badge>
                          {x.isActive === false ? "Ngừng bán" : "Đang bán"}
                        </Badge>
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
                      {/* Nút xóa sản phẩm được ẩn theo yêu cầu US08 */}
                      {kind !== "products" && allowedDelete && writable && x._id !== user._id && (
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
      {editing && (
        <Editor
          {...{ kind, c, user, categories, categoryError }}
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
  item,
  close,
  saved,
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [colors, setColors] = useState(item.colors || []);

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
          <Field
            label={kind === "news" ? "Tiêu đề *" : "Tên *"}
            name={kind === "news" ? "title" : "name"}
            defaultValue={item.title || item.name || ""}
            required
            maxLength={250}
          />
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
                  + Thêm màu
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
                  <Icon name="photo" size={15} />
                  <span>Chọn ảnh từ máy tính (nhiều ảnh)</span>
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                    onChange={handleFilesSelected}
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
                    + Thêm URL
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

function ProductDetailModal({ item, close, onEdit }) {
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
            <Icon name="plus" size={15} />
            Chỉnh sửa sản phẩm
          </button>
        )}
      </footer>
    </Modal>
  );
}
