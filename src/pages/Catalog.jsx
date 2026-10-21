import { useState, useEffect } from "react";
import { P, N, query, toSlug } from "../api";
import { useResource } from "../hooks";
import { Icon } from "../components/UI";
import CatalogTable from "../components/catalog/CatalogTable";

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
  const [filter, setFilter] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [categoryStatusFilter, setCategoryStatusFilter] = useState("");
  const [page, setPage] = useState(1);

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
        <CatalogTable
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

export { toSlug };
