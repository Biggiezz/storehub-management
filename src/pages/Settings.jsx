import { useState } from 'react'
import { API_BASE, U, request, setSession, getSession } from '../api'
import { Field, FileField } from '../components/UI'
export default function Settings({ user, onUser, notify }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function save(e, password = false) {
    e.preventDefault(); const form = e.currentTarget; setBusy(true); setError('')
    try {
      const data = new FormData(form)
      if (!data.get('image')?.size) data.delete('image')
      if (password && data.get('newPassword') !== data.get('confirm')) throw new Error('Mật khẩu xác nhận không khớp.')
      if (!password && !data.get('phone') && !user.phone) data.delete('phone')
      const result = await request(U + (password ? '/change-password' : '/update-profile'), { method: 'PUT', body: password ? { oldPassword: data.get('oldPassword'), newPassword: data.get('newPassword') } : data })
      if (!password) { const updated = { ...user, ...result.data }; setSession({ ...getSession(), user: updated }); onUser(updated) } else form.reset()
      notify(password ? 'Đã đổi mật khẩu.' : 'Đã cập nhật hồ sơ.')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <><div className="welcome"><div><span className="eyebrow">TÀI KHOẢN / CÀI ĐẶT</span><h1>Hồ sơ quản trị</h1><p>Quản lý thông tin cá nhân và mật khẩu đăng nhập.</p></div></div>{error && <p className="error" role="alert">{error}</p>}<div className="settings-grid"><form className="card form-card" onSubmit={save}><h2>Thông tin cá nhân</h2><fieldset disabled={busy}><Field label="Họ tên *" name="name" defaultValue={user.name} required/><Field label="Email"><input value={user.email || ''} disabled/></Field><Field label="Số điện thoại" name="phone" pattern="[0-9]{10}" defaultValue={user.phone || ''}/><Field label="Địa chỉ" name="address" defaultValue={user.address || ''}/><FileField/><button className="primary">{busy ? 'Đang lưu…' : 'Lưu hồ sơ'}</button></fieldset></form><div><form className="card form-card" onSubmit={e => save(e, true)}><h2>Đổi mật khẩu</h2><fieldset disabled={busy}><Field label="Mật khẩu hiện tại" name="oldPassword" type="password" required autoComplete="current-password"/><Field label="Mật khẩu mới" name="newPassword" type="password" required minLength={8} pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,}" title="Ít nhất 8 ký tự, gồm chữ và số" autoComplete="new-password"/><Field label="Nhập lại mật khẩu mới" name="confirm" type="password" required autoComplete="new-password"/><button className="primary">Đổi mật khẩu</button></fieldset></form><div className="card connection"><h3>Kết nối hệ thống</h3><small>Địa chỉ BE đang dùng</small><code>{API_BASE}</code><p>Thay đổi VITE_API_BASE_URL trong file .env và khởi động lại FE để đổi máy chủ.</p></div></div></div></>
}
