import { O, request, query } from '../api.js'

export const EMPTY_ORDER_FILTERS = { orderCode: '', customer: '', fromDate: '', toDate: '', status: '' }
export const ORDER_STATUSES = ['Chờ xác nhận', 'Đã xác nhận', 'Đã rời kho', 'Đang giao hàng', 'Đã giao hàng', 'Đã hoàn thành', 'Khiếu nại', 'Đã hủy']
export const normalizeSearch = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim()
export const hasOrderFilters = filters => Object.values(filters).some(Boolean)

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
export function validateOrderFilters(filters) {
  if ((filters.fromDate && !validDate(filters.fromDate)) || (filters.toDate && !validDate(filters.toDate))) return 'Ngày đặt không hợp lệ.'
  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) return 'Từ ngày phải nhỏ hơn hoặc bằng đến ngày.'
  return ''
}
export function filterOrders(orders, filters) {
  const error = validateOrderFilters(filters)
  if (error) throw new Error(error)
  const code = normalizeSearch(filters.orderCode), customer = normalizeSearch(filters.customer)
  // Inclusive calendar dates in Vietnam, independent of the browser's timezone.
  const from = filters.fromDate ? Date.parse(`${filters.fromDate}T00:00:00+07:00`) : -Infinity
  const until = filters.toDate ? Date.parse(`${filters.toDate}T00:00:00+07:00`) + 86400000 : Infinity
  return orders.filter(order => {
    const timestamp = Date.parse(order.createdAt)
    const customerText = [order.receiverName, order.receiverPhone, order.user?.name, order.user?.email, order.user?.phone].map(normalizeSearch).join(' ')
    return (!code || normalizeSearch(order.orderCode || order._id).includes(code)) &&
      (!customer || customerText.includes(customer)) &&
      (!filters.status || order.status === filters.status) &&
      (!(filters.fromDate || filters.toDate) || (Number.isFinite(timestamp) && timestamp >= from && timestamp < until))
  })
}

/** Compatibility adapter: the supplied BE only accepts page/limit.
 * Never label a partial page set as complete results. Abort on errors, changing
 * counts, duplicates, invalid pagination or the explicit 5,000-order ceiling.
 */
export async function fetchOrderSnapshot({ signal, onProgress = () => {}, transport = request, maxItems = 5000 } = {}) {
  const limit = 50, orders = [], seen = new Set()
  let expectedTotal, expectedPages
  for (let page = 1; ; page++) {
    signal?.throwIfAborted()
    const result = await transport(`${O}/admin/orders${query({ page, limit })}`, { signal })
    const total = result.pagination?.totalProducts, pages = result.pagination?.totalPages
    if (!Array.isArray(result.data) || !Number.isInteger(total) || total < 0 || !Number.isInteger(pages) || pages < 0 || pages !== Math.max(1, Math.ceil(total / limit)) && !(total === 0 && pages === 0)) throw new Error('API đơn hàng trả phân trang không hợp lệ. Không thể xác nhận đã tải đủ dữ liệu.')
    if (total > maxItems) throw new Error(`Có hơn ${maxItems.toLocaleString('vi-VN')} đơn hàng. Cần bổ sung API lọc phía máy chủ để tìm kiếm đầy đủ.`)
    if (expectedTotal === undefined) { expectedTotal = total; expectedPages = pages }
    if (total !== expectedTotal || pages !== expectedPages) throw new Error('Danh sách đơn hàng thay đổi trong khi tải. Vui lòng thử lại để tránh kết quả thiếu.')
    for (const order of result.data) {
      if (!order?._id || seen.has(order._id)) throw new Error('Dữ liệu đơn hàng bị trùng hoặc thiếu mã trong lúc tải. Vui lòng thử lại.')
      seen.add(order._id); orders.push(order)
    }
    onProgress({ loaded: orders.length, total })
    if (page >= pages) break
    if (result.data.length !== limit) throw new Error('API trả thiếu trang dữ liệu. Hãy thử lại; kết quả chưa được hiển thị.')
  }
  if (orders.length !== expectedTotal) throw new Error('Chưa tải đủ đơn hàng. Hãy thử lại; kết quả chưa được hiển thị.')
  return orders
}
