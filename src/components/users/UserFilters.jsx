import { Icon } from "../UI";

export default function UserFilters({
  search,
  setSearch,
  term,
  setTerm,
  filter,
  setFilter,
  setPage,
  vipTierFilter,
  setVipTierFilter,
  minSpentFilter,
  setMinSpentFilter,
  minOrdersFilter,
  setMinOrdersFilter,
  setVipPage,
  hasVipFilters,
  resetVipFilters,
  onExportCsv,
}) {
  return (
    <>
      {/* Toolbar: Tìm kiếm & Bộ lọc vai trò & Nút Export CSV */}
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
            aria-label="Tìm theo tên hoặc email"
            placeholder="Tìm theo tên hoặc email người dùng…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {term && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setTerm("");
                setPage(1);
              }}
            >
              Xóa
            </button>
          )}
          <button type="submit">Tìm</button>
        </form>

        <select
          value={filter}
          aria-label="Bộ lọc vai trò"
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả vai trò</option>
          <option value="customer">Khách hàng</option>
          <option value="staff">Nhân viên / Quản trị</option>
        </select>

        {/* US24 AC3: Nút Xuất danh sách VIP (Export CSV) */}
        <button
          type="button"
          className="export-csv-btn"
          onClick={onExportCsv}
          title="Xuất file CSV danh sách khách hàng thân thiết kèm Email/SĐT để phục vụ gửi voucher tri ân"
        >
          <span>Xuất danh sách VIP (CSV)</span>
        </button>
      </div>

      {/* US24 AC1: Thanh bộ lọc phân hạng khách hàng thân thiết (VIP Loyalty) */}
      <div className="vip-filter-toolbar">
        <span className="vip-filter-label">
          <span>Phân hạng VIP:</span>
        </span>
        <div className="vip-filter-inputs">
          <select
            value={vipTierFilter}
            aria-label="Lọc theo hạng VIP"
            onChange={(e) => {
              setVipTierFilter(e.target.value);
              setVipPage(1);
            }}
          >
            <option value="">Tất cả hạng thành viên (Mặc định)</option>
            <option value="top_spent">
              ⭐ Tất cả khách hàng có đơn (Chi tiêu cao → thấp)
            </option>
            <option value="diamond">
              💎 Kim Cương (&gt; 20 triệu hoặc &gt; 10 đơn)
            </option>
            <option value="gold">👑 Vàng (10 - 20 triệu)</option>
            <option value="silver">🥈 Bạc (5 - 10 triệu)</option>
            <option value="bronze">🥉 Thành viên Đồng (&lt; 5 triệu)</option>
          </select>

          <input
            type="number"
            min="0"
            step="500000"
            value={minSpentFilter}
            onChange={(e) => {
              setMinSpentFilter(e.target.value);
              setVipPage(1);
            }}
            placeholder="Chi tiêu tối thiểu (VNĐ)…"
            title="Lọc theo chi tiêu tích lũy tối thiểu (VNĐ)"
          />

          <input
            type="number"
            min="0"
            step="1"
            value={minOrdersFilter}
            onChange={(e) => {
              setMinOrdersFilter(e.target.value);
              setVipPage(1);
            }}
            placeholder="Số đơn tối thiểu…"
            title="Lọc theo số đơn hoàn thành tối thiểu"
          />

          {hasVipFilters && (
            <button
              type="button"
              className="vip-filter-clear-btn"
              onClick={resetVipFilters}
              title="Xóa bộ lọc phân hạng VIP"
            >
              Xóa lọc VIP
            </button>
          )}
        </div>
      </div>
    </>
  );
}
