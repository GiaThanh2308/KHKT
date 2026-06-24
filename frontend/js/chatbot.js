// chatbot.js — Giao diện chatbot AI
// requireAuth() được gọi từ chatbot.html, không cần gọi lại ở đây

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

function appendMsg(text, cls) {
  const box = document.getElementById("chatMessages");
  const el  = document.createElement("div");
  el.className   = "msg " + cls;
  el.textContent = text;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
  return el;
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
