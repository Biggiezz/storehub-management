import { Modal, Field } from "../UI";

export default function UserBlockModal({
  selectedUser,
  busy,
  lockReason,
  setLockReason,
  close,
  onConfirm,
}) {
  if (!selectedUser) return null;

  return (
    <Modal
      title={selectedUser.isBlocked ? "Mở khóa tài khoản" : "Khóa tài khoản vi phạm"}
      close={() => {
        if (!busy) close();
      }}
      busy={busy}
    >
      <form onSubmit={onConfirm}>
        <div className="modal-body">
          <p>
            Người dùng: <strong>{selectedUser.name || selectedUser.email}</strong>
          </p>
          {selectedUser.isBlocked ? (
            <div>
              <p>
                Bạn có chắc chắn muốn mở khóa cho tài khoản này không? Người dùng sẽ
                có thể đăng nhập lại bình thường.
              </p>
              {selectedUser.blockReason && (
                <p className="muted" style={{ fontSize: "11px" }}>
                  Lý do đã khóa trước đó: {selectedUser.blockReason}
                </p>
              )}
            </div>
          ) : (
            <div className="form-grid">
              <p>
                Khi bị khóa, tài khoản sẽ bị ngắt phiên đăng nhập và không thể truy
                cập hệ thống.
              </p>
              <Field label="Lý do khóa tài khoản *">
                <textarea
                  required
                  rows={3}
                  placeholder="Nhập lý do khóa (vi phạm chính sách, hành vi bất thường, v.v.)..."
                  value={lockReason}
                  onChange={(e) => setLockReason(e.target.value)}
                />
              </Field>
            </div>
          )}
        </div>
        <footer>
          <button type="button" disabled={busy} onClick={close}>
            Hủy
          </button>
          <button
            type="submit"
            className={selectedUser.isBlocked ? "primary" : "danger"}
            disabled={busy}
          >
            {busy
              ? "Đang xử lý…"
              : selectedUser.isBlocked
              ? "Xác nhận mở khóa"
              : "Xác nhận khóa tài khoản"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
