// login.js — đăng nhập rồi chuyển đúng trang theo vai trò (student → Nhận diện, còn lại → Dashboard)
function redirectByRole(role) {
  location.href = role === "student" ? "index.html" : "dashboard.html";
}

if (localStorage.getItem("access_token")) redirectByRole(localStorage.getItem("role"));

async function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("loginMessage");
  const btn = document.getElementById("loginBtn");

  if (!username || !password) {
    msg.textContent = "Nhập tên đăng nhập và mật khẩu.";
    (username ? document.getElementById("password") : document.getElementById("username")).focus();
    return;
  }

  btn.disabled = true;
  btn.innerHTML = icon("loader", "spin") + " Đang đăng nhập…";
  msg.textContent = "";

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      msg.textContent = err.detail || "Sai tên đăng nhập hoặc mật khẩu.";
      return;
    }
    const data = await res.json();
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("username", data.username);
    localStorage.setItem("role", data.role);
    redirectByRole(data.role);
  } catch {
    msg.textContent = "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Đăng nhập";
  }
}
document.addEventListener("DOMContentLoaded", () => {
  const slides = document.querySelectorAll(".login-slider .slide");
  if (slides.length === 0) return;

  let currentIndex = 0;
  const slideInterval = 5000;

  function nextSlide() {
    slides[currentIndex].classList.remove("active");
    currentIndex = (currentIndex + 1) % slides.length;
    slides[currentIndex].classList.add("active");
  }

  let autoSlide = setInterval(nextSlide, slideInterval);

  const container = document.querySelector(".login-slider");
  if (container) {
    container.addEventListener("mouseenter", () => clearInterval(autoSlide));
    container.addEventListener("mouseleave", () => {
      autoSlide = setInterval(nextSlide, slideInterval);
    });
  }
});