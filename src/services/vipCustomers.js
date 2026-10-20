import { request, query, U } from '../api.js'

// app.js mounts usersRouter at both /users and /api/usersRouter.
// request() already prepends /api: do not use the Swagger /users prefix here.
export const VIP_ENDPOINT = `${U}/admin/loyal-customers`
export const EMPTY_VIP_FILTERS = { keyword: '', minSpent: '', maxSpent: '', tier: '', isVip: '', sort: 'spent_desc' }
const SORTS = {
  spent_desc: { sortBy: 'totalSpent', sortOrder: 'desc' },
  spent_asc: { sortBy: 'totalSpent', sortOrder: 'asc' },
  orders_desc: { sortBy: 'completedOrdersCount', sortOrder: 'desc' },
  name_asc: { sortBy: 'name', sortOrder: 'asc' },
  recent_desc: { sortBy: 'lastOrderDate', sortOrder: 'desc' },
}
export function validateVipFilters(filters) {
  for (const key of ['minSpent', 'maxSpent']) {
    const value = filters[key]
    if (value !== '' && (!Number.isSafeInteger(Number(value)) || Number(value) < 0)) return 'Tổng chi tiêu phải là số nguyên không âm, nằm trong giới hạn an toàn.'
  }
  if (filters.minSpent !== '' && filters.maxSpent !== '' && Number(filters.minSpent) > Number(filters.maxSpent)) return 'Chi tiêu tối thiểu không được lớn hơn chi tiêu tối đa.'
  if (!SORTS[filters.sort]) return 'Kiểu sắp xếp không hợp lệ.'
  if (!['', 'true', 'false'].includes(filters.isVip)) return 'Bộ lọc VIP không hợp lệ.'
  return ''
}
const nonNegative = value => Number.isFinite(value) && value >= 0
const count = value => Number.isSafeInteger(value) && value >= 0
export function validateVipResponse(result, page, limit) {
  const p = result.pagination
  if (!Array.isArray(result.data) || !p || !count(p.totalItems) || p.currentPage !== page || p.pageSize !== limit || p.totalPages !== Math.max(1, Math.ceil(p.totalItems / limit))) throw new Error('API khách hàng thân thiết trả dữ liệu phân trang không hợp lệ (cần pageSize). Kiểm tra BE mới đã được deploy.')
  const ids = new Set()
  for (const customer of result.data) {
    if (!customer?._id || ids.has(customer._id) || typeof customer.name !== 'string' || !nonNegative(customer.stats?.totalSpent) || !count(customer.stats?.completedOrdersCount) || !count(customer.stats?.totalOrdersCount) || !customer.tier?.key || !customer.tier?.name || typeof customer.tier?.isVip !== 'boolean') throw new Error('API thiếu stats hoặc thông tin hạng khách hàng. Không thể hiển thị số liệu chính xác.')
    ids.add(customer._id)
  }
  const expectedCount = Math.min(limit, Math.max(0, p.totalItems - (page - 1) * limit))
  if (result.data.length !== expectedCount) throw new Error('Số lượng khách hàng không khớp phân trang. Vui lòng tải lại.')
  const summary = result.summary
  if (!summary || !count(summary.totalFilteredCustomers) || summary.totalFilteredCustomers !== p.totalItems || !nonNegative(summary.filteredRevenueSum) || !count(summary.vipCount) || !count(summary.totalSystemCustomers)) throw new Error('API chưa trả đầy đủ thống kê khách hàng thân thiết.')
  return result
}
export async function fetchVipCustomers(filters, page, { signal, transport = request } = {}) {
  const error = validateVipFilters(filters)
  if (error) throw new Error(error)
  if (!Number.isInteger(page) || page < 1) throw new Error('Trang không hợp lệ.')
  const params = {
    search: filters.keyword.trim(), minSpent: filters.minSpent, maxSpent: filters.maxSpent,
    rank: filters.tier, isVip: filters.isVip, ...SORTS[filters.sort],
    filterLogic: 'AND', rankMode: 'any', page, limit: 10,
  }
  const result = await transport(VIP_ENDPOINT + query(params), { signal })
  return validateVipResponse(result, page, 10)
}
export async function fetchVipTiers({ signal, transport = request } = {}) {
  const result = await transport(`${VIP_ENDPOINT}/tiers`, { signal })
  const keys = new Set()
  if (!Array.isArray(result.data) || !result.data.length) throw new Error('API chưa trả danh sách thứ hạng.')
  for (const tier of result.data) {
    if (!tier?.key || keys.has(tier.key) || !tier.name || !nonNegative(tier.minSpent) || !count(tier.minOrders) || typeof tier.isVip !== 'boolean') throw new Error('Cấu hình thứ hạng từ API không hợp lệ.')
    keys.add(tier.key)
  }
  return result.data
}
