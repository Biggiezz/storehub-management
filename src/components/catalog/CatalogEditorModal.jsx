import { useState, useEffect } from "react";
import {
  request,
  imageUrl,
  isSuper,
  toSlug,
  saveCategoryOverride,
} from "../../api";
import { Icon, Photo, Modal, Field, FileField } from "../UI";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CatalogEditorModal({
  kind,
  c,
  user,
  categories = [],
  categoryError,
  existingCategories = [],
  item = {},
  close,
  saved,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [colors, setColors] = useState(item.colors || []);

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
      list.push({
        url: item.image,
        name: "Ảnh chính hiện tại",
        isMain: true,
        isExisting: true,
      });
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
          list.push({
            url: img,
            name: `Ảnh phụ ${i + 1}`,
            isMain: false,
            isExisting: true,
          });
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
      setUploadError(
        "Vui lòng nhập đường dẫn URL hình ảnh hợp lệ (bắt đầu bằng http:// hoặc https://).",
      );
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
                <small
                  className="muted"
                  style={{ margin: "3px 0 0", fontSize: "11px" }}
                >
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
                <small
                  className="muted"
                  style={{ margin: "4px 0 0", fontSize: "11px" }}
                >
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
              <p
                className="muted"
                style={{ margin: "3px 0 10px", fontSize: "11px" }}
              >
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
                <p
                  className="error"
                  style={{ margin: "8px 0 0", fontSize: "12px" }}
                >
                  {uploadError}
                </p>
              )}

              {galleryImages.length > 0 ? (
                <div className="gallery-preview-grid">
                  {galleryImages.map((img, idx) => (
                    <div
                      key={idx}
                      className={`gallery-preview-card ${
                        img.isMain ? "is-main" : ""
                      }`}
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
