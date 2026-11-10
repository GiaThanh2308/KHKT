/**
 * api.js — tiện ích dùng chung cho mọi trang: gọi API, đăng nhập/đăng xuất, kiểm tra quyền, dựng menu.
 * Vai trò: admin / teacher = dùng mọi trang · student = chỉ trang Nhận diện (index.html).
 */

/** Địa chỉ API. Mở file trực tiếp hoặc bằng Live Server (5500/5501) → server ở 127.0.0.1:8000;
 *  còn lại (server tự phục vụ giao diện, kể cả qua tunnel) → cùng origin với trang. */
function getApiBase() {
  const manual = localStorage.getItem("api_base");
  if (manual) return manual.replace(/\/$/, "");
  const devServer = location.protocol === "file:" || ["5500", "5501"].includes(location.port);
  return devServer ? "http://127.0.0.1:8000" : location.origin;
}

const API_BASE = getApiBase();
const TEACHER_ROLES = ["admin", "teacher"];
const ROLE_LABEL = { admin: "Admin", teacher: "Giáo viên", student: "Học sinh" };

function escapeHtml(value) {
  return value == null
    ? ""
    : String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getRole() {
  return localStorage.getItem("role") || "student";
}
function isTeacher() {
  return TEACHER_ROLES.includes(localStorage.getItem("role"));
}

/** Địa chỉ đầy đủ của một đường dẫn trả về từ API; đính token cho ảnh (thẻ <img> không gửi được header). */
function apiAssetUrl(path, { withToken = false } = {}) {
  if (!path) return "";
  let url = /^https?:\/\//i.test(path) ? path : `${API_BASE}${path.startsWith("/") ? path : "/" + path}`;
  if (withToken) {
    const token = encodeURIComponent(localStorage.getItem("access_token") || "");
    url += `${url.includes("?") ? "&" : "?"}token=${token}`;
  }
  return url;
}

function clearSession() {
  ["access_token", "username", "role"].forEach((k) => localStorage.removeItem(k));
}

/** options.timeout (ms) = tự hủy nếu server không trả lời kịp (ném lỗi có name "AbortError"). Mặc định: không giới hạn. */
async function apiFetch(path, options = {}) {
  const { timeout = 0, ...fetchOptions } = options;
  options = fetchOptions;
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const token = localStorage.getItem("access_token");
  if (token) headers.Authorization = `Bearer ${token}`;

  const ctrl = timeout > 0 ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeout) : null;
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers, ...(ctrl ? { signal: ctrl.signal } : {}) });
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (res.status === 401) {
    clearSession();
    location.href = "login.html";
  }
  return res;
}

function logout() {
  clearSession();
  location.href = "login.html";
}

/** Chưa đăng nhập → về trang đăng nhập. */
function requireAuth() {
  if (!localStorage.getItem("access_token")) location.href = "login.html";
}

/** Chỉ admin/teacher; student bị đưa về trang Nhận diện. (Server cũng kiểm tra lại — đây chỉ là lớp giao diện.) */
function requireTeacher() {
  if (!isTeacher()) location.href = "index.html";
}

const NAV_ITEMS = [
  { key: "dashboard", href: "dashboard.html", icon: "chart", label: "Tổng quan" },
  { key: "index", href: "index.html", icon: "camera", label: "Nhận diện" },
  { key: "students", href: "students.html", icon: "users", label: "Học sinh" },
  { key: "chatbot", href: "chatbot.html", icon: "chat", label: "Chatbot AI" },
];

const LOGO_SVG = `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="8" fill="var(--primary)"/><path d="M10 7v18" stroke="#ff8a9d" stroke-width="2" stroke-linecap="round"/><path d="M15 11h9M15 16h9M15 21h6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`;

/** Dựng thanh trên (máy tính) và thanh dưới (điện thoại). activePage: dashboard | index | students | chatbot */
function renderNav(activePage) {
  const role = getRole();
  const username = localStorage.getItem("username") || "---";
  const items = isTeacher() ? NAV_ITEMS : NAV_ITEMS.filter((i) => i.key === "index");
  const cur = (i) => (i.key === activePage ? ' aria-current="page"' : "");

  const bar = document.getElementById("appbar");
  if (bar) {
    bar.innerHTML = `
      <a class="brand" href="${items[0].href}">${LOGO_SVG}<span>AI School</span></a>
      <nav class="nav" aria-label="Chính">${items.map((i) => `<a href="${i.href}"${cur(i)}>${icon(i.icon)}${i.label}</a>`).join("")}</nav>
      <div class="appbar-end">
        <div class="me"><b>${escapeHtml(username)}</b><small>${ROLE_LABEL[role] || role}</small></div>
        <button type="button" class="btn-icon" data-theme-toggle onclick="toggleTheme()">${icon("moon")}</button>
        <button type="button" class="btn-icon" onclick="logout()" aria-label="Đăng xuất" title="Đăng xuất">${icon("logout")}</button>
      </div>`;
    bar.querySelectorAll("[data-theme-toggle]").forEach(window.syncToggle);
  }

  const tabs = document.getElementById("mobileNav");
  if (tabs) {
    tabs.setAttribute("aria-label", "Điều hướng chính");
    tabs.hidden = items.length < 2; // tài khoản học sinh chỉ có một trang, không cần thanh dưới
    tabs.innerHTML = items.map((i) => `<a href="${i.href}"${cur(i)}>${icon(i.icon)}<span>${i.label}</span></a>`).join("");
  }
}

/* ── Thông báo + hộp thoại dùng chung ── */
function toast(msg, err = false, ms = 3200) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const t = document.createElement("div");
  t.className = "toast" + (err ? " err" : "");
  t.setAttribute("role", err ? "alert" : "status"); // trình đọc màn hình đọc to thông báo
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

const _FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
/** Giữ phím Tab xoay vòng trong hộp thoại */
function _trapTab(box, e) {
  if (e.key !== "Tab") return;
  const f = [...box.querySelectorAll(_FOCUSABLE)].filter((n) => n.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/** Mở hộp thoại (.modal > .modal-box): role=dialog, Esc/bấm nền để đóng, giữ focus bên trong, trả focus về nút đã mở. */
function openDialog(el, opener = document.activeElement) {
  const box = el.querySelector(".modal-box") || el;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  const h = box.querySelector("h2");
  if (h) { h.id = h.id || el.id + "Title"; box.setAttribute("aria-labelledby", h.id); }
  el.classList.add("open");
  document.body.classList.add("modal-open");
  const onKey = (e) => { if (e.key === "Escape") closeDialog(el); else _trapTab(box, e); };
  const onBackdrop = (e) => { if (e.target === el) closeDialog(el); };
  document.addEventListener("keydown", onKey);
  el.addEventListener("mousedown", onBackdrop);
  el._dlg = { onKey, onBackdrop, opener };
  const first = box.querySelector("input:not([type=hidden]),select,textarea") || box.querySelector(".btn-primary");
  if (first) first.focus();
}
function closeDialog(el) {
  if (!el._dlg) { el.classList.remove("open"); return; }
  document.removeEventListener("keydown", el._dlg.onKey);
  el.removeEventListener("mousedown", el._dlg.onBackdrop);
  el.classList.remove("open");
  if (![...document.querySelectorAll(".modal.open")].length) document.body.classList.remove("modal-open");
  const opener = el._dlg.opener;
  el._dlg = null;
  if (opener && opener.focus) opener.focus();
}

function confirmDialog({ title = "Xác nhận", message = "", okText = "Đồng ý", danger = false } = {}) {
  return new Promise((resolve) => {
    const opener = document.activeElement;
    const box = document.createElement("div");
    box.className = "dlg-backdrop";
    box.innerHTML = `<div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlgTitle" aria-describedby="dlgMsg">
      <h3 id="dlgTitle">${escapeHtml(title)}</h3><p id="dlgMsg">${escapeHtml(message)}</p>
      <div class="dlg-btns"><button type="button" class="dlg-cancel">Hủy</button>
      <button type="button" class="dlg-ok${danger ? " danger" : ""}">${escapeHtml(okText)}</button></div></div>`;
    const dlg = box.firstElementChild;
    const onKey = (e) => { if (e.key === "Escape") done(false); else _trapTab(dlg, e); };
    const done = (v) => { document.removeEventListener("keydown", onKey); box.remove(); if (opener && opener.focus) opener.focus(); resolve(v); };
    box.addEventListener("mousedown", (e) => { if (e.target === box) done(false); });
    box.querySelector(".dlg-cancel").onclick = () => done(false);
    box.querySelector(".dlg-ok").onclick = () => done(true);
    document.addEventListener("keydown", onKey);
    document.body.appendChild(box);
    box.querySelector(".dlg-cancel").focus();
  });
}

/* Ảnh cần đăng nhập: <img data-auth-src="/face-image/..."> được tải bằng fetch (header Authorization)
   rồi dựng blob — token không còn nằm trong URL (log, lịch sử trình duyệt, Referer). */
const _imgCache = new Map();
const _imgObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { _imgObserver.unobserve(e.target); _loadAuthImg(e.target); }
    }), { rootMargin: "200px" })
  : null;

async function _loadAuthImg(img) {
  const path = img.dataset.authSrc;
  if (!path) return;
  try {
    if (!_imgCache.has(path)) {
      _imgCache.set(path, apiFetch(path).then(async (r) => {
        if (!r.ok) throw new Error(r.status);
        return URL.createObjectURL(await r.blob());
      }));
    }
    img.src = await _imgCache.get(path);
  } catch {
    _imgCache.delete(path);
    img.remove();
  }
}

function hydrateAuthImages(root = document) {
  root.querySelectorAll("img[data-auth-src]:not([src])").forEach((img) => (_imgObserver ? _imgObserver.observe(img) : _loadAuthImg(img)));
}
