/* theme.js — chế độ sáng/tối. Nạp ở <head> (không defer) để không bị nháy màu khi tải trang.
   Mặc định theo hệ thống; người dùng chọn thì nhớ lại (localStorage, có try/catch vì có thể bị chặn). */
(function () {
  const KEY = "theme";
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const write = (v) => { try { localStorage.setItem(KEY, v); } catch { /* bỏ qua */ } };
  const mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  const saved = read();
  if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;

  window.effectiveTheme = () =>
    document.documentElement.dataset.theme || (mq && mq.matches ? "dark" : "light");

  window.toggleTheme = function () {
    const next = window.effectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    write(next);
    document.querySelectorAll("[data-theme-toggle]").forEach(window.syncToggle);
  };

  window.syncToggle = function syncToggle(btn) {
    const dark = window.effectiveTheme() === "dark";
    btn.setAttribute("aria-label", dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối");
    btn.title = btn.getAttribute("aria-label");
    const use = btn.querySelector("use");
    if (use) use.setAttribute("href", dark ? "#i-sun" : "#i-moon");
  };
  if (mq && mq.addEventListener) mq.addEventListener("change", () => document.querySelectorAll("[data-theme-toggle]").forEach(window.syncToggle));
})();
