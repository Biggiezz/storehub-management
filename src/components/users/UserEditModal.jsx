import { date, isSuper } from "../../api";
import { Modal, Field } from "../UI";

export default function UserEditModal({
  selectedUser,
  currentUser,
  busy,
  editError,
  setEditError,
  close,
  onSave,
}) {
  if (!selectedUser) return null;

  return (
    <Modal
      title="Chỉnh sửa người dùng"
      close={() => {
        if (!busy) close();
      }}
      busy={busy}
    >
      <form onSubmit={onSave}>
        <div className="modal-body form-grid">
          {editError && (
            <p className="error" role="alert">
              {editError}
            </p>
          )}
          <Field label="Họ và tên *">
            <input
              name="name"
              required
              defaultValue={selectedUser.name || ""}
              placeholder="Nhập họ và tên..."
            />
          </Field>
          <Field label="Email (Không thể thay đổi)">
            <input value={selectedUser.email || ""} disabled readOnly />
          </Field>
          <div className="two-col">
            <Field label="Số điện thoại">
              <input
                name="phone"
                type="tel"
                defaultValue={selectedUser.phone || ""}
                placeholder="VD: 0912345678"
                pattern="^(0[3|5|7|8|9])[0-9]{8}$"
                title="Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09"
                onInvalid={(e) => {
                  if (e.target.validity.patternMismatch) {
                    e.target.setCustomValidity(
                      "Số điện thoại không đúng định dạng Việt Nam. Vui lòng nhập 10 chữ số bắt đầu bằng 03, 05, 07, 08 hoặc 09 (VD: 0912345678)."
                    );
                  }
                }}
                onInput={(e) => {
                  e.target.setCustomValidity("");
                  if (editError) setEditError("");
                }}
              />
              <small
                className="muted"
                style={{ fontSize: "11px", marginTop: "4px" }}
              >
                Định dạng: 10 chữ số (đầu số 03, 05, 07, 08, 09)
              </small>
            </Field>
            <Field label="Vai trò hệ thống">
              {isSuper(currentUser) ? (
                <select name="role" defaultValue={selectedUser.role || "customer"}>
                  <option value="customer">Khách hàng (customer)</option>
                  <option value="admin">Quản trị viên (admin)</option>
                  <option value="superadmin">Quản trị tối cao (superadmin)</option>
                </select>
              ) : (
                <input
                  value={selectedUser.role || "customer"}
                  disabled
                  readOnly
                />
              )}
            </Field>
          </div>
          <Field label="Địa chỉ">
            <input
              name="address"
              defaultValue={selectedUser.address || ""}
              placeholder="Nhập địa chỉ..."
            />
          </Field>
          <div className="two-col">
            <Field label="Ngày tạo tài khoản">
              <input
                value={date(selectedUser.createdAt)}
                disabled
                readOnly
              />
            </Field>
            <Field label="Chỉnh sửa gần nhất (updatedAt)">
              <input
                value={
                  selectedUser.updatedAt
                    ? date(selectedUser.updatedAt)
                    : "Chưa có lịch sử cập nhật"
                }
                disabled
                readOnly
              />
            </Field>
          </div>
        </div>
        <footer>
          <button type="button" disabled={busy} onClick={close}>
            Hủy
          </button>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
