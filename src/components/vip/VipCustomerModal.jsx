import { money, date } from "../../api";
import { Badge, Modal } from "../UI";

export default function VipCustomerModal({ customer, onClose }) {
  if (!customer) return null;

  return (
    <Modal
      title={customer.name || "Khách hàng thân thiết"}
      close={onClose}
    >
      <div className="modal-body">
        <Badge tone={customer.tier.isVip ? "green" : "blue"}>
          {customer.tier.name}
        </Badge>
        <p className="loyalty-contact">
          {customer.email || "Chưa có email"}
          <br />
          {customer.phone || "Chưa có số điện thoại"}
          <br />
          {customer.address || "Chưa có địa chỉ"}
        </p>
        <div className="totals">
          <p>
            <span>Tổng chi tiêu</span>
            <strong>{money(customer.stats.totalSpent)}</strong>
          </p>
          <p>
            <span>Đơn hoàn tất / tổng đơn</span>
            <strong>
              {customer.stats.completedOrdersCount} /{" "}
              {customer.stats.totalOrdersCount}
            </strong>
          </p>
          <p>
            <span>Đặt hàng gần nhất</span>
            <strong>{date(customer.stats.lastOrderDate)}</strong>
          </p>
        </div>
        <h3>Đặc quyền theo cấu hình hạng</h3>
        {Array.isArray(customer.tier.perks) && customer.tier.perks.length ? (
          <ul>
            {customer.tier.perks.map((perk, i) => (
              <li key={i}>{perk}</li>
            ))}
          </ul>
        ) : (
          <p>Chưa có thông tin đặc quyền.</p>
        )}
      </div>
      <footer>
        <button onClick={onClose}>Đóng</button>
      </footer>
    </Modal>
  );
}
