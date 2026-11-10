// face.js — Trang nhận diện (index.html): đóng băng khung hình khi chụp + hiệu ứng quét mặt
requireAuth();
renderNav("index");

const $ = (id) => document.getElementById(id);
const IS_TEACHER = isTeacher(); // cờ đỏ (student) quét + ghi lỗi nhưng không xem/sửa số liệu
const video = $("video"), stage = $("stage"), freezeImg = $("freezeImg");
let stream = null, facing = "user", busy = false, freezeUrl = null;

let TYPES = ["Không đồng phục","Đi trễ","Dùng điện thoại","Không đeo thẻ","Không đội mũ bảo hiểm","Gây mất trật tự","Khác"];
let lastCapture = null; // tên ảnh chụp (server tự lưu, có đóng dấu ngày giờ) của lần quét gần nhất
// Danh sách lỗi lấy từ server để luôn khớp với bản được phép lưu
apiFetch("/violation-types").then(r => r.ok ? r.json() : null).then(d => { if (d?.types?.length) TYPES = d.types; }).catch(() => {});
const BADGE = { ok:"check", unknown:"help", fail:"x" };
const MIN_SCAN_MS = 1400; // quét tối thiểu để animation đủ đẹp dù server trả nhanh

const esc = escapeHtml;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const initials = (n) => (n || "?").trim().split(/\s+/).slice(-2).map(w => w[0]).join("").toUpperCase();

function setState(state, text) {
  stage.dataset.state = state;
  if (text) $("statusText").textContent = text;
  if (BADGE[state]) $("camBadge").innerHTML = icon(BADGE[state]);
}

// ── Camera ──────────────────────────────────────────────
async function startCamera() {
  try {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false,
    });
    video.srcObject = stream;
    await video.play().catch(() => {});
    if (facing === "user") stage.setAttribute("data-mirror", ""); else stage.removeAttribute("data-mirror");
    releaseFreeze();
    setState("live", "Đưa khuôn mặt vào khung");
  } catch (e) {
    toast("Không mở được camera. Hãy cho phép trình duyệt dùng camera, hoặc chọn ảnh có sẵn.", true);
  }
}

function stopCamera() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null; video.srcObject = null;
  releaseFreeze();
  setState("idle");
}

async function flipCamera() {
  facing = facing === "user" ? "environment" : "user";
  await startCamera();
}

function releaseFreeze() {
  if (freezeUrl) { URL.revokeObjectURL(freezeUrl); freezeUrl = null; }
  freezeImg.removeAttribute("src");
}

// Quay lại camera trực tiếp sau khi xem kết quả
function resumeLive() {
  releaseFreeze();
  if (stream) setState("live", "Đưa khuôn mặt vào khung");
  else setState("idle");
}

// ── Chụp: dừng ngay khung hình, rồi quét ────────────────
async function captureAndRecognize() {
  if (busy) return;
  if (!stream || !video.videoWidth) { toast("Bật camera trước khi chụp", true); return; }

  const c = $("canvas");
  c.width = video.videoWidth; c.height = video.videoHeight;
  c.getContext("2d").drawImage(video, 0, 0, c.width, c.height); // ảnh GỐC (không lật) gửi cho AI
  const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.9));

  releaseFreeze();
  freezeUrl = URL.createObjectURL(blob);
  freezeImg.src = freezeUrl;          // hiện đúng khung hình lúc chụp
  video.pause();
  await runRecognition(blob, "capture.jpg");
}

async function uploadImage() {
  const file = $("imageInput").files[0];
  if (!file) return;
  if (busy) return;
  releaseFreeze();
  freezeUrl = URL.createObjectURL(file);
  freezeImg.src = freezeUrl;
  stage.removeAttribute("data-mirror");
  $("imageInput").value = "";
  await runRecognition(file, file.name);
}

async function runRecognition(blob, name) {
  busy = true;
  $("shutter").disabled = true;
  setState("scanning", "Đang quét khuôn mặt…");
  showScanning();

  const fd = new FormData();
  fd.append("file", blob, name);
  const t0 = Date.now();
  let data = null, errMsg = "";
  try {
    const res = await apiFetch("/recognize-face", { method: "POST", body: fd });
    if (res.ok) { data = await res.json(); lastCapture = data.capture || null; }
    else if (res.status === 503) errMsg = "Máy chủ đang bận. Quét lại sau vài giây.";
    else errMsg = "Máy chủ gặp lỗi (" + res.status + "). Thử lại sau.";
  } catch { errMsg = "Không kết nối được máy chủ."; }

  const wait = MIN_SCAN_MS - (Date.now() - t0);
  if (wait > 0) await sleep(wait);

  if (errMsg) {
    setState("fail", errMsg); renderEmpty("alert", errMsg, "Thử lại sau ít phút.");
  } else if (!data.faces || !data.faces.length) {
    setState("fail", "Không thấy khuôn mặt"); renderEmpty("user-x", "Không thấy khuôn mặt", "Chụp lại, để khuôn mặt rõ và đủ sáng.");
  } else if (!data.faces[0].id) {
    setState("unknown", "Chưa có hồ sơ"); renderEmpty("help", "Khuôn mặt chưa có hồ sơ", "Độ khớp cao nhất: " + Math.round(data.faces[0].score * 100) + "%. Nhờ giáo viên thêm học sinh này.");
  } else {
    setState("ok", data.faces[0].full_name); renderStudent(data.faces[0]);
  }
  busy = false;
  $("shutter").disabled = false;
  await sleep(2600);
  if (!busy && stage.dataset.state !== "scanning") resumeLive(); // tự trở về camera, kết quả vẫn giữ ở thẻ bên dưới
  if (stream) video.play().catch(() => {});
}

// ── Kết quả ─────────────────────────────────────────────
function showScanning() {
  $("studentProfile").innerHTML = `<div class="res-empty">${icon("loader", "spin")}<p>Đang phân tích…</p><small>Giữ yên thiết bị trong giây lát.</small></div>`;
}
function renderEmpty(ic, title, sub) {
  $("studentProfile").innerHTML = `<div class="res-empty">${icon(ic)}<p>${esc(title)}</p><small>${esc(sub)}</small></div>`;
}

function renderStudent(s) {
  const acc = Math.round(s.score * 100);
  const lvl = acc >= 80 ? "" : acc >= 60 ? "mid" : "low";
  const img = apiAssetUrl(s.face_image_url, { withToken: true });
  $("studentProfile").innerHTML = `
    <div class="res-head">
      <span class="avatar" aria-hidden="true">${esc(initials(s.full_name))}${img ? `<img src="${esc(img)}" alt="" onerror="this.remove()">` : ""}</span>
      <div style="min-width:0">
        <div class="res-name">${esc(s.full_name)}</div>
        <div class="res-meta">${[s.class_name, s.student_code, s.phone].filter(Boolean).map(esc).join(" · ")}</div>
      </div>
      <div class="res-score">${acc}%<small>độ khớp</small></div>
    </div>
    <div class="meter" role="img" aria-label="Độ khớp khuôn mặt ${acc}%"><b class="${lvl}" style="width:${acc}%"></b></div>
    <div id="chipsLabel" class="label">Lỗi vi phạm (chọn một hoặc nhiều)</div>
    <div class="chips" id="chips" role="group" aria-labelledby="chipsLabel">${TYPES.map(t => `<button type="button" class="chip" aria-pressed="false" onclick="pickType(this)">${esc(t)}</button>`).join("")}</div>
    <div class="field">
      <label for="violationNote">Ghi chú</label>
      <textarea id="violationNote" placeholder="Không bắt buộc"></textarea>
    </div>
    <button type="button" class="btn btn-danger btn-block" id="saveBtn" onclick="saveViolation(${s.id})">${icon("pen")} Ghi vi phạm</button>`;
  $("studentProfile").closest(".slip")?.querySelector(".stamp")?.remove();
  if (innerWidth <= 960) $("studentProfile").closest(".slip").scrollIntoView({ behavior: "smooth", block: "start" });
}
function pickType(el) { el.setAttribute("aria-pressed", el.getAttribute("aria-pressed") === "true" ? "false" : "true"); } // bấm lại để bỏ chọn

async function saveViolation(id) {
  const types = [...document.querySelectorAll("#chips .chip[aria-pressed=true]")].map(c => c.textContent.replace(/^✓\s*/, ""));
  if (!types.length) { toast("Chọn ít nhất một lỗi vi phạm", true); return; }
  const btn = $("saveBtn");
  btn.disabled = true; btn.innerHTML = icon("loader", "spin") + " Đang ghi…";
  try {
    const res = await apiFetch("/violations", { method: "POST", body: JSON.stringify({
      student_id: id, violation_types: types, note: $("violationNote").value, capture: lastCapture }) });
    const e = await res.json().catch(() => ({}));
    if (!res.ok) { toast(e.detail || "Không ghi được vi phạm. Thử lại.", true); return; }
    toast(e.duplicates?.length ? `Đã ghi ${e.saved.length} lỗi (bỏ qua lỗi vừa ghi: ${e.duplicates.join(", ")})` : `Đã ghi ${e.saved.length} lỗi`);
    $("violationNote").value = "";
    document.querySelectorAll("#chips .chip[aria-pressed=true]").forEach(c => c.setAttribute("aria-pressed", "false"));
    const slip = $("studentProfile").closest(".slip");
    slip.querySelector(".stamp")?.remove();
    slip.insertAdjacentHTML("beforeend", '<div class="stamp" aria-hidden="true">Đã ghi</div>');
    setTimeout(() => slip.querySelector(".stamp")?.remove(), 2600);
    loadRecentViolations();
  } catch { toast("Không kết nối được máy chủ", true); }
  finally { btn.disabled = false; btn.innerHTML = icon("pen") + " Ghi vi phạm"; }
}

// ── Vi phạm gần đây ─────────────────────────────────────
function fmtDate(iso) {
  const s = iso && !/Z|\+/.test(iso) ? iso + "Z" : iso, d = new Date(s);
  return d.toLocaleDateString("vi-VN") + " " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}
async function loadRecentViolations() {
  if (!IS_TEACHER) return;
  const box = $("recentViolations");
  try {
    const res = await apiFetch("/violations?limit=5");
    if (!res.ok) return;
    const data = await res.json();
    box.innerHTML = data.length ? data.map(v => `
      <div class="rv">
        <span class="avatar" aria-hidden="true">${esc(initials(v.student_name))}</span>
        <div class="rv-main"><b>${esc(v.student_name)}</b><small>${esc(v.class_name)} · ${esc(v.violation_type)}</small></div>
        <time class="rv-time" datetime="${esc(v.created_at)}">${fmtDate(v.created_at)}</time>
      </div>`).join("") : `<div class="empty"><b>Chưa có vi phạm nào</b>Lượt ghi đầu tiên sẽ hiện ở đây.</div>`;
  } catch {}
}

loadRecentViolations();
if (!IS_TEACHER) document.querySelector(".recent-card")?.remove();
