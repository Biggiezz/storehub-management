import test from "node:test";
import assert from "node:assert/strict";
import {
  nextStatuses,
  isSuper,
  isAdmin,
  query,
  request,
  setSession,
} from "../src/api.js";
const memory = new Map();
globalThis.sessionStorage = {
  getItem: (k) => memory.get(k),
  setItem: (k, v) => memory.set(k, v),
  removeItem: (k) => memory.delete(k),
};
globalThis.window = new EventTarget();
test("customer cannot enter admin; Vietnamese roles are normalized", () => {
  assert.equal(isAdmin({ role: "customer" }), false);
  assert.equal(isAdmin({ role: " quản lý cửa hàng " }), true);
  assert.equal(isSuper({ role: "superadmin" }), true);
});
test("order transitions match backend cancellation and final-state rules", () => {
  assert.deepEqual(nextStatuses("Chờ xác nhận", { role: "admin" }), [
    "Đã xác nhận",
  ]);
  assert.deepEqual(nextStatuses("Chờ xác nhận", { role: "superadmin" }), [
    "Đã xác nhận",
    "Đã hủy",
  ]);
  assert.equal(
    nextStatuses("Khiếu nại", { role: "admin" }).includes("Đã hủy"),
    true,
  );
  assert.equal(
    nextStatuses("Đang giao hàng", { role: "superadmin" }).includes("Đã hủy"),
    false,
  );
  assert.deepEqual(nextStatuses("Đã hoàn thành", { role: "superadmin" }), []);
  assert.deepEqual(nextStatuses("Đã hủy", { role: "superadmin" }), []);
});
test("query escapes Unicode and removes empty values", () => {
  const q = new URLSearchParams(
    query({ keyword: "Điện thoại & máy tính", page: 2, status: "" }),
  );
  assert.equal(q.get("keyword"), "Điện thoại & máy tính");
  assert.equal(q.has("status"), false);
});
test("JSON and multipart use correct authorization/body headers", async () => {
  setSession({ token: "test-token", user: { role: "admin" } });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://localhost:3000/api/usersRouter/update-profile");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    assert.equal(options.headers["Content-Type"], undefined);
    assert.ok(options.body instanceof FormData);
    return Response.json({ code: 200, data: {} });
  };
  await request("/usersRouter/update-profile", {
    method: "PUT",
    body: new FormData(),
  });
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(options.body), { name: "Test" });
    return Response.json({ code: 200 });
  };
  await request("/usersRouter/update-user/1", {
    method: "PUT",
    body: { name: "Test" },
  });
});
test("permission denial retains session; expired JWT clears it", async () => {
  setSession({ token: "test", user: { role: "admin" } });
  globalThis.fetch = async () =>
    Response.json({ message: "Bạn không có quyền" }, { status: 403 });
  await assert.rejects(request("/test"), /không có quyền/);
  assert.ok(memory.size);
  globalThis.fetch = async () =>
    Response.json({ message: "Token hết hạn" }, { status: 403 });
  await assert.rejects(request("/test"), /Token hết hạn/);
  assert.equal(memory.size, 0);
});
test("HTML server errors become actionable messages", async () => {
  globalThis.fetch = async () =>
    new Response("<html>error</html>", { status: 500 });
  await assert.rejects(request("/test"), /VITE_API_BASE_URL/);
});
