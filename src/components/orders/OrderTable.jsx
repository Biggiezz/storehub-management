import { money } from "../../api";
import { Badge } from "../UI";

export default function OrderTable({ pageRows = [], onSelectOrder }) {
  if (!pageRows.length) return null;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mã đơn / Ngày đặt</th>
            <th>Khách hàng</th>
            <th>Tổng tiền</th>
            <th>Thanh toán</th>
            <th>Trạng thái</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {pageRows.map((o) => (
            <tr key={o._id}>
              <td>
                <strong className="order-code">
                  {o.orderCode || o._id.slice(-8)}
                </strong>
                <small className="block">
                  {o.createdAt
                    ? new Date(o.createdAt).toLocaleString("vi-VN", {
                        timeZone: "Asia/Ho_Chi_Minh",
                      })
                    : "—"}
                </small>
              </td>
              <td>
                <strong>{o.receiverName || o.user?.name || "—"}</strong>
                <small className="block">
                  {o.receiverPhone || o.user?.phone || "—"}
                </small>
              </td>
              <td className="strong nowrap">
                {money(o.totalAmount ?? o.totalPrice)}
              </td>
              <td>{o.paymentMethod}</td>
              <td>
                <Badge>{o.status}</Badge>
              </td>
              <td>
                <button type="button" onClick={() => onSelectOrder(o._id)}>
                  Chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
