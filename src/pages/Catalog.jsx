import { useState, useEffect } from "react";
import {
  request,
  P,
  N,
  query,
  money,
  date,
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
  const path =
    c.base +
    c.list +
    query({
      page,
      limit: 10,
      ...(kind === "products"
        ? { keyword: term, showInactive: true, category: filter }
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
                kind === "news"
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
        </div>
        <CatalogRows
          key={`${path}:${term}`}
          {...{ kind, c, user, notify, path, page, setPage, term }}
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
  categories,
  categoryError,
}) {
  const { data, loading, error, reload } = useResource(path);
  const [editing, setEditing] = useState(null),
    [deleting, setDeleting] = useState(null),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");
  const all = data?.data || [],
    rows = ["news", "categories"].includes(kind)
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
          {data?.pagination?.totalProducts != null
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
                        <small>
                          {kind === "users"
                            ? x.email
                            : `#${x._id.slice(-8).toUpperCase()}`}
                        </small>
                      </div>
                    </div>
                  </td>
                  {kind === "products" ? (
                    <>
                      <td>{x.category?.name || "Chưa phân loại"}</td>
                      <td className="nowrap strong">{money(x.price)}</td>
                      <td>
                        <span className={x.stock < 5 ? "stock-low" : ""}>
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
                      {writable && <button onClick={() => setEditing(x)}>Sửa</button>}
                      {allowedDelete && writable && x._id !== user._id && (
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
          total={data.pagination?.totalProducts}
          hasNext={
            data.pagination
              ? page < data.pagination.totalPages
              : all.length === 10
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
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const form = new FormData(e.currentTarget);
      if (!form.get("image")?.size) form.delete("image");
      let body = form;
      if (kind === "products") {
        if (colors.some((x) => !x.name.trim() || !/^#[a-f\d]{6}$/i.test(x.hex)))
          throw new Error("Mỗi màu cần tên và mã HEX hợp lệ.");
        form.set("colors", JSON.stringify(colors));
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
                  label="Giá bán (VNĐ) *"
                  name="price"
                  type="number"
                  min="1"
                  step="1"
                  required
                  defaultValue={item.price || ""}
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
