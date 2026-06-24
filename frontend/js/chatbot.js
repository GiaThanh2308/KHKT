// chatbot.js — Giao diện chatbot AI
// requireAuth() được gọi từ chatbot.html

const chatHistory = []; // lưu lịch sử hội thoại để gửi lên backend

async function sendMessage() {
  const input   = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const text    = input.value.trim();
  if (!text) return;

  appendMsg(text, "user");
  chatHistory.push({ role: "user", content: text });
  input.value      = "";
  sendBtn.disabled = true;

  const typingEl = appendTyping();

  try {
    const res = await apiFetch("/chatbot", {
      method: "POST",
      body:   JSON.stringify({ messages: chatHistory }),
    });

    typingEl.remove();

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      appendMsg("❌ Lỗi: " + (err.detail || "Server lỗi"), "bot");
      return;
    }

    const data  = await res.json();
    const reply = data.reply || "(không có phản hồi)";
    appendMsg(reply, "bot");
    chatHistory.push({ role: "assistant", content: reply });

  } catch (e) {
    typingEl.remove();
    appendMsg("❌ Không kết nối được server", "bot");
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

/**
 * FIX: render đúng cấu trúc .msg > .msg-avatar + .msg-bubble
 * Trước đây dùng el.textContent = text nên mất hết markdown và CSS không áp dụng.
 * Nay dùng innerHTML với markdownToHtml() để hiển thị bullet list từ bot.
 */
function appendMsg(text, cls) {
  const box = document.getElementById("chatMessages");
  const el  = document.createElement("div");
  el.className = "msg " + cls;

  const avatarIcon = cls === "bot"
    ? '<i class="fa-solid fa-robot"></i>'
    : '<i class="fa-solid fa-user"></i>';

  // FIX: bot message dùng innerHTML với markdown parser, user message escape HTML
  const bubbleContent = cls === "bot"
    ? markdownToHtml(text)
    : escapeHtml(text);

  el.innerHTML = `
    <div class="msg-avatar">${avatarIcon}</div>
    <div class="msg-bubble">${bubbleContent}</div>`;

  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
  return el;
}

/**
 * Chuyển markdown đơn giản sang HTML:
 * - **text** → <strong>text</strong>
 * - `code` → <code>code</code>
 * - Dòng bắt đầu bằng • hoặc - → <ul><li>...</li></ul>
 * - Dòng trắng → ngắt đoạn
 */
function markdownToHtml(text) {
  // Escape HTML trước để tránh XSS
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Xử lý bullet list: gom các dòng bắt đầu bằng - hoặc •
  const lines = html.split("\n");
  const result = [];
  let inList = false;

  for (const line of lines) {
    const bulletMatch = line.match(/^[\s]*[-•]\s+(.+)/);
    if (bulletMatch) {
      if (!inList) { result.push("<ul>"); inList = true; }
      result.push(`<li>${bulletMatch[1]}</li>`);
    } else {
      if (inList) { result.push("</ul>"); inList = false; }
      result.push(line === "" ? "<br>" : `<p>${line}</p>`);
    }
  }
  if (inList) result.push("</ul>");

  // Bỏ <p></p> rỗng
  return result.join("").replace(/<p><\/p>/g, "");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function appendTyping() {
  const box = document.getElementById("chatMessages");
  const el  = document.createElement("div");
  el.className = "msg bot";
  el.innerHTML = `
    <div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>
    <div class="msg-bubble">
      <div class="typing">
        <span></span><span></span><span></span>
      </div>
    </div>`;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
  return el;
}

function clearChat() {
  chatHistory.length = 0;
  const box = document.getElementById("chatMessages");
  box.innerHTML = `
    <div class="msg bot">
      <div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>
      <div class="msg-bubble">
        Xin chào! Tôi là AI School Assistant. Tôi có thể giúp bạn:<br /><br />
        • Tra cứu thông tin và lịch sử vi phạm của học sinh<br />
        • Xem thống kê vi phạm theo ngày, tuần, tháng<br />
        • Tổng hợp báo cáo nhanh<br /><br />
        Bạn cần hỗ trợ gì?
      </div>
    </div>`;
}

function quickAsk(text) {
  document.getElementById("chatInput").value = text;
  sendMessage();
}

function searchStudent() {
  const q = document.getElementById("studentSearch").value.trim();
  if (!q) return;
  quickAsk(`Tìm học sinh: ${q}`);
}

// Load context badge
(async function loadContextBadge() {
  try {
    const res = await apiFetch("/stats/summary");
    if (!res.ok) return;
    const data = await res.json();
    const badge = document.getElementById("contextBadge");
    if (badge) {
      badge.textContent = `${data.total_students} học sinh · ${data.total_violations} vi phạm`;
    }
  } catch (e) {
    const badge = document.getElementById("contextBadge");
    if (badge) badge.textContent = "Đã kết nối";
  }
})();
