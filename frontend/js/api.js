/**
 * api.js — Helper dùng chung cho toàn bộ frontend.
 * Role hệ thống:
 *   - "teacher" / "admin" : truy cập tất cả trang
 *   - "student"           : chỉ truy cập index.html (nhận diện)
 *
 * ── FIX: API_BASE linh động ──────────────────────
 * Thứ tự ưu tiên:
 *   1. localStorage["api_base"]  → có thể tự đặt thủ công qua DevTools
 *   2. Cùng host với trang web   → tự động khớp khi mở từ bất kỳ IP nào
 *   3. Fallback http://127.0.0.1:8000
 */
function getApiBase() {
  const manual = localStorage.getItem("api_base");
  if (manual) return manual.replace(/\/$/, "");

  if (location.hostname && location.hostname !== "") {
    return `${location.protocol}//${location.hostname}:8000`;
  }

  return "http://127.0.0.1:8000";
}

const API_BASE = getApiBase();

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("access_token");
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    window.location.href = "login.html";
    return res;
  }
  return res;
}

function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("username");
  localStorage.removeItem("role");
  window.location.href = "login.html";
}

/** Guard: cần đăng nhập (mọi role). Nếu chưa login → về login.html */
function requireAuth() {
  if (!localStorage.getItem("access_token")) {
    window.location.href = "login.html";
  }
}

/**
 * Guard: chỉ teacher/admin được vào.
 * Student bị chặn → về index.html (trang nhận diện).
 */
function requireTeacher() {
  const role = localStorage.getItem("role");
  if (!["admin", "teacher"].includes(role)) {
    window.location.href = "index.html";
  }
}

/**
 * Render sidebar + mobile-nav động theo role.
 * @param {string} activePage  - "dashboard" | "index" | "students" | "chatbot"
 */
function renderNav(activePage) {
  const role = localStorage.getItem("role") || "student";
  const username = localStorage.getItem("username") || "---";
  const isTeacher = ["admin", "teacher"].includes(role);

  const allItems = [
    {
      key: "dashboard",
      href: "dashboard.html",
      icon: "fa-chart-line",
      label: "Dashboard",
    },
    { key: "index", href: "index.html", icon: "fa-camera", label: "Nhận diện" },
    {
      key: "students",
      href: "students.html",
      icon: "fa-user-graduate",
      label: "Học sinh",
    },
    {
      key: "chatbot",
      href: "chatbot.html",
      icon: "fa-robot",
      label: "Chatbot AI",
    },
  ];

  const visibleItems = isTeacher
    ? allItems
    : allItems.filter((item) => item.key === "index");

  const mobileItems = isTeacher
    ? allItems.filter((i) => ["index", "students", "chatbot"].includes(i.key))
    : visibleItems;

  const sidebarEl = document.getElementById("sidebar");
  if (sidebarEl) {
    const menuHtml = visibleItems
      .map(
        (item) => `
      <li class="${item.key === activePage ? "active" : ""}">
        <a href="${item.href}">
          <i class="fa-solid ${item.icon}"></i>
          ${item.label}
        </a>
      </li>`,
      )
      .join("");

    sidebarEl.innerHTML = `
      <div class="logo">
        <i class="fa-solid fa-school"></i><span>AI School</span>
      </div>
      <ul class="menu">${menuHtml}</ul>
      <div class="sidebar-user">
        <i class="fa-solid fa-user-circle"></i>
        <div class="sidebar-user-info">
          <span class="sidebar-username">${escapeNav(username)}</span>
          <span class="sidebar-role">${isTeacher ? (role === "admin" ? "Admin" : "Giáo viên") : "Học sinh"}</span>
        </div>
      </div>
      <button class="logout-btn" onclick="logout()">
        <i class="fa-solid fa-right-from-bracket"></i> Đăng xuất
      </button>`;
  }

  const mobileNavEl = document.getElementById("mobileNav");
  if (mobileNavEl) {
    const mobileHtml = mobileItems
      .map(
        (item) => `
      <a class="mobile-item ${item.key === activePage ? "active" : ""}" href="${item.href}">
        <i class="fa-solid ${item.icon}"></i>
        <span>${item.label}</span>
      </a>`,
      )
      .join("");

    mobileNavEl.innerHTML =
      mobileHtml +
      `
      <span class="mobile-item" onclick="logout()">
        <i class="fa-solid fa-right-from-bracket"></i>
        <span>Thoát</span>
      </span>`;
  }

  const userDisplay = document.getElementById("usernameDisplay");
  if (userDisplay) userDisplay.textContent = username;

  const roleBadge = document.getElementById("roleBadge");
  if (roleBadge) {
    roleBadge.textContent = isTeacher
      ? role === "admin"
        ? "Admin"
        : "Giáo viên"
      : "Học sinh";
    roleBadge.style.cssText = `
      font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;margin-left:6px;
      background:${role === "admin" ? "#fef3c7" : role === "teacher" ? "#eff6ff" : "#f0fdf4"};
      color:${role === "admin" ? "#92400e" : role === "teacher" ? "#1e40af" : "#166534"};
    `;
  }
}

function escapeNav(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
