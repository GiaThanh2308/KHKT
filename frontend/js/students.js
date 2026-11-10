// students.js — Chỉ dành cho teacher/admin
requireAuth();
requireTeacher();
renderNav("students");

let allStudents = [];

async function loadStudents() {
  try {
    const res = await apiFetch("/students");
    if (!res.ok) { showError("Không tải được danh sách học sinh (lỗi " + res.status + ")"); return; }
    allStudents = await res.json();

    const classes  = new Set(allStudents.map(s => s.class_name).filter(Boolean));
    const withFace = allStudents.filter(s => s.face_label).length;

    document.getElementById("studentCount").textContent = allStudents.length;
    document.getElementById("classCount").textContent   = classes.size;
    document.getElementById("faceCount").textContent    = withFace;

    // Cập nhật bộ lọc lớp
    buildClassFilter(classes);
    filterStudents(true);
  } catch (e) {
    console.error("loadStudents:", e);
    showError(e instanceof TypeError && /fetch|network/i.test(e.message)
      ? "Không kết nối được server"
      : "Lỗi hiển thị danh sách: " + e.message);
  }
}

// "10A2" -> "10"; sắp xếp tự nhiên để 10A2 đứng trước 10A10
const khoiOf = (cls) => (String(cls || "").match(/^\d+/) || [""])[0];
const natCmp = (a, b) => String(a).localeCompare(String(b), "vi", { numeric: true, sensitivity: "base" });

let classesByKhoi = {}; // { "10": ["10A1","10A2",...], ... }
let activeKhoi = "";

function buildClassFilter(classes) {
  const keepLop = document.getElementById("lopFilter")?.value || "";
  classesByKhoi = {};
  [...classes].forEach(cls => {
    const k = khoiOf(cls);
    (classesByKhoi[k] = classesByKhoi[k] || []).push(cls);
  });
  Object.values(classesByKhoi).forEach(list => list.sort(natCmp));

  // Nếu khối đang chọn không còn tồn tại thì quay về "Tất cả"
  if (activeKhoi && !classesByKhoi[activeKhoi]) activeKhoi = "";

  const bar = document.getElementById("classFilterBar");
  if (bar) {
    const khois = Object.keys(classesByKhoi).sort(natCmp);
    bar.innerHTML =
      `<button type="button" aria-pressed="${activeKhoi === ""}" onclick="setKhoiFilter('', this)">Tất cả</button>` +
      khois.map(k => `<button type="button" aria-pressed="${activeKhoi === k}" onclick="setKhoiFilter('${k}', this)">Khối ${k}</button>`).join("");
  }
  populateLopSelect(keepLop);
}

// Dropdown lớp chỉ hiện các lớp thuộc khối đang chọn (đã sắp xếp)
function populateLopSelect(keep = "") {
  const sel = document.getElementById("lopFilter");
  if (!sel) return;
  sel.innerHTML = `<option value="">${activeKhoi ? `Tất cả lớp khối ${activeKhoi}` : "Tất cả lớp"}</option>`;

  const khois = activeKhoi ? [activeKhoi] : Object.keys(classesByKhoi).sort(natCmp);
  khois.forEach(k => {
    const addOpt = (parent, cls) => {
      const o = document.createElement("option");
      o.value = cls; o.textContent = cls;
      parent.appendChild(o);
    };
    if (activeKhoi) {
      (classesByKhoi[k] || []).forEach(cls => addOpt(sel, cls));
    } else {
      const g = document.createElement("optgroup");
      g.label = `Khối ${k}`;
      (classesByKhoi[k] || []).forEach(cls => addOpt(g, cls));
      sel.appendChild(g);
    }
  });
  sel.value = keep && [...sel.options].some(o => o.value === keep) ? keep : "";
}

function setKhoiFilter(khoi, btn) {
  activeKhoi = khoi;
  document.querySelectorAll("#classFilterBar button").forEach(b => b.setAttribute("aria-pressed", "false"));
  btn.setAttribute("aria-pressed", "true");
  populateLopSelect(); // đổi khối → làm mới danh sách lớp, bỏ lớp cũ
  filterStudents();
}

function filterStudents(keepPage = false) {
  const q      = (document.getElementById("searchInput")?.value || "").toLowerCase();
  const lopVal = document.getElementById("lopFilter")?.value || "";

  let filtered = allStudents;

  if (activeKhoi) filtered = filtered.filter(s => khoiOf(s.class_name) === activeKhoi);
  if (lopVal)     filtered = filtered.filter(s => s.class_name === lopVal);

  if (q) {
    filtered = filtered.filter(s =>
      (s.full_name    || "").toLowerCase().includes(q) ||
      (s.student_code || "").toLowerCase().includes(q) ||
      (s.class_name   || "").toLowerCase().includes(q)
    );
  }

  renderTable(filtered, keepPage === true);
}

function showError(msg) {
  const tbody = document.getElementById("studentTable");
  if (tbody)
    tbody.innerHTML = `<tr><td colspan="6" class="empty" style="color:var(--red)" role="alert">${escapeHtml(msg)}</td></tr>`;
}


const PAGE_SIZE = 50;
let viewList = [], page = 1;

const initials = (n) => (n || "?").trim().split(/\s+/).slice(-2).map(w => w[0]).join("").toUpperCase();

function renderTable(students, keepPage = false) {
  viewList = students;
  if (!keepPage) page = 1;
  const pages = Math.max(1, Math.ceil(viewList.length / PAGE_SIZE));
  page = Math.min(page, pages);

  const tbody = document.getElementById("studentTable");
  if (!viewList.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty"><b>Không có học sinh nào</b>Thử đổi bộ lọc, hoặc thêm học sinh mới.</td></tr>`;
    renderPager(0, 1);
    return;
  }
  const start = (page - 1) * PAGE_SIZE;
  tbody.innerHTML = viewList.slice(start, start + PAGE_SIZE).map((s, i) => {
    const img = apiAssetUrl(s.face_image_url, { withToken: true });
    const nm = escapeHtml(s.full_name);
    return `
    <tr>
      <td class="num">${start + i + 1}</td>
      <td class="c-meta" data-label="Mã HS"><span class="badge">${escapeHtml(s.student_code)}</span></td>
      <td class="c-name">
        <div class="who">
          <span class="avatar" aria-hidden="true">${escapeHtml(initials(s.full_name))}${img ? `<img loading="lazy" decoding="async" src="${escapeHtml(img)}" alt="" onerror="this.remove()">` : ""}</span>
          <strong>${nm}</strong>
        </div>
      </td>
      <td class="c-meta" data-label="Lớp">${escapeHtml(s.class_name)}</td>
      <td class="c-meta" data-label="SĐT">${escapeHtml(s.phone) || "—"}</td>
      <td class="c-acts">
        <div class="acts">
          <button type="button" class="btn-icon edit" onclick="openEdit(${s.id})" aria-label="Sửa ${nm}" title="Sửa">${icon("pen")}</button>
          <button type="button" class="btn-icon del" onclick="deleteStudent(${s.id})" aria-label="Xóa ${nm}" title="Xóa">${icon("trash")}</button>
        </div>
      </td>
    </tr>`;
  }).join("");
  renderPager(viewList.length, pages);
}

function renderPager(total, pages) {
  const el = document.getElementById("pager");
  if (!el) return;
  if (total <= PAGE_SIZE) { el.innerHTML = total ? `<span class="pager-info">${total} học sinh</span>` : ""; return; }
  el.innerHTML = `
    <span class="pager-info">${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} / ${total} học sinh</span>
    <div class="pager-btns">
      <button type="button" class="btn" onclick="goPage(${page - 1})" ${page <= 1 ? "disabled" : ""} aria-label="Trang trước">${icon("chevron-left")}</button>
      <span class="pager-cur" aria-live="polite">Trang ${page} / ${pages}</span>
      <button type="button" class="btn" onclick="goPage(${page + 1})" ${page >= pages ? "disabled" : ""} aria-label="Trang sau">${icon("chevron-right")}</button>
    </div>`;
}

function goPage(n) {
  page = n;
  renderTable(viewList, true);
  document.querySelector(".table-wrap")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showModal(opener) { openDialog(document.getElementById("studentModal"), opener); }

function openModal() {
  document.getElementById("modalTitle").textContent = "Thêm học sinh";
  document.getElementById("editingId").value = "";
  ["studentCode","fullName","className","faceLabel","phone"].forEach(id => {
    document.getElementById(id).value = "";
  });
  showModal(document.activeElement);
}

function openEdit(id) {
  const s = allStudents.find(x => x.id === id);
  if (!s) return;
  document.getElementById("modalTitle").textContent   = "Chỉnh sửa học sinh";
  document.getElementById("editingId").value          = id;
  document.getElementById("studentCode").value        = s.student_code;
  document.getElementById("fullName").value           = s.full_name;
  document.getElementById("className").value          = s.class_name;
  document.getElementById("faceLabel").value          = s.face_label || "";
  document.getElementById("phone").value              = s.phone || "";
  showModal(document.activeElement);
}

function closeModal() { closeDialog(document.getElementById("studentModal")); }

async function saveStudent() {
  const id   = document.getElementById("editingId").value;
  const body = {
    student_code: document.getElementById("studentCode").value.trim(),
    full_name:    document.getElementById("fullName").value.trim(),
    class_name:   document.getElementById("className").value.trim(),
    face_label:   document.getElementById("faceLabel").value.trim() || null,
    phone:        document.getElementById("phone").value.trim(),
  };

  if (!body.full_name || !body.class_name) {
    toast("Nhập họ tên và lớp của học sinh", true); (body.full_name ? document.getElementById("className") : document.getElementById("fullName")).focus(); return;
  }

  try {
    const res = await apiFetch(id ? `/students/${id}` : "/students", {
      method: id ? "PUT" : "POST",
      body:   JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast(err.detail || "Không lưu được học sinh. Thử lại.", true); return;
    }
    closeModal();
    toast(id ? "Đã lưu thay đổi" : "Đã thêm học sinh");
    loadStudents();
  } catch { toast("Không kết nối được máy chủ", true); }
}

async function deleteStudent(id) {
  const s    = allStudents.find(x => x.id === id);
  const name = s ? s.full_name : `ID ${id}`;
  const ok = await confirmDialog({ title: `Xóa học sinh ${name}?`, message: "Tất cả vi phạm của học sinh này cũng bị xóa. Không thể hoàn tác.", okText: "Xóa học sinh", danger: true });
  if (!ok) return;
  try {
    const res = await apiFetch(`/students/${id}`, { method: "DELETE" });
    if (!res.ok) { const err = await res.json().catch(() => ({})); toast(err.detail || "Không xóa được học sinh", true); return; }
    toast("Đã xóa " + name);
    loadStudents();
  } catch { toast("Không kết nối được máy chủ", true); }
}

if (isTeacher()) loadStudents(); // student đang bị chuyển trang, không gọi API nữa

/** Nút "Đồng bộ lại": học khuôn mặt người mới trong known_faces + tạo hồ sơ còn thiếu. */
async function importFromFolders() {
  const btn = document.getElementById("importBtn");
  btn.disabled = true;
  btn.innerHTML = icon("loader", "spin") + " Đang đồng bộ…";
  try {
    const res  = await apiFetch("/import-from-folders", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { toast(data.detail || "Không đồng bộ được", true); return; }
    toast(data.message + (data.errors?.length ? ` (${data.errors.length} lỗi)` : ""), !!data.errors?.length, data.errors?.length ? 6000 : 3200);
    if (data.errors?.length) console.warn("Đồng bộ:", data.errors);
    loadStudents();
  } catch {
    toast("Không kết nối được máy chủ", true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = icon("flip") + " Đồng bộ lại";
  }
}

// ───────────────────────── Nhập danh sách Excel ─────────────────────────
const el = (id) => document.getElementById(id);
function openRoster() { rosterReset(); openDialog(el("rosterModal"), document.activeElement); }
function closeRoster() { closeDialog(el("rosterModal")); }
function rosterReset() { el("rosterResult").innerHTML = ""; el("rosterApplyBtn").style.display = "none"; }

const li = (items, fmt) => items.length ? `<div class="res-list">${items.map(fmt).join("<br>")}</div>` : "";

async function runRoster(apply) {
  const file = el("rosterFile").files[0];
  if (!file) { toast("Chọn file Excel (.xlsx) trước", true); el("rosterFile").focus(); return; }
  if (apply && !(await confirmDialog({ title: "Áp dụng thay đổi?", message: "Danh sách học sinh sẽ được cập nhật theo bản xem trước.", okText: "Áp dụng" }))) return;
  const fd = new FormData();
  fd.append("file", file);
  fd.append("apply", apply ? "true" : "false");
  fd.append("allow_move", el("rosterMove").checked ? "true" : "false");
  fd.append("create_new", el("rosterCreate").checked ? "true" : "false");
  const box = el("rosterResult");
  box.innerHTML = "<p>Đang xử lý…</p>";
  try {
    const res = await apiFetch("/students/import-roster", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { box.innerHTML = `<p class="error-msg" role="alert">${escapeHtml(d.detail || "Lỗi " + res.status)}</p>`; return; }
    const c = d.counts, move = el("rosterMove").checked, create = el("rosterCreate").checked;
    const nameOnly = d.updates.filter(u => !u.move);
    const moves = d.updates.filter(u => u.move);
    box.innerHTML = `
      <div class="res-sum">
        <span>${d.rows_in_file} dòng trong file</span>
        <span>${c.updates - d.moves} sửa tên có dấu</span>
        <span>${d.unchanged} đã đúng</span>
        <span class="${d.moves ? "warn" : ""}">${d.moves} đổi lớp${d.moves && !move ? " (chưa bật)" : ""}</span>
        <span class="${c.ambiguous ? "warn" : ""}">${c.ambiguous} cần xử lý tay</span>
        ${create ? `<span class="${c.to_create ? "ok" : ""}">${c.to_create} học sinh mới (tự cấp mã)</span>` : `<span class="${c.not_found ? "warn" : ""}">${c.not_found} chưa có trong hệ thống (chưa bật tạo mới)</span>`}
        ${c.invalid_class ? `<span class="warn">${c.invalid_class} dòng sai tên lớp</span>` : ""}
        <span>${c.not_in_list} không có trong file</span>
      </div>
      ${apply ? `<p><b>Đã áp dụng ${d.applied_count} thay đổi${d.created_count ? ` và tạo ${d.created_count} học sinh mới` : ""}.</b></p>` : ""}
      ${d.warnings.length ? `<div class="res-title">Cảnh báo</div>${li(d.warnings, escapeHtml)}` : ""}
      ${nameOnly.length ? `<div class="res-title">Sửa tên${c.updates - d.moves > nameOnly.length ? " (hiện 200 đầu)" : ""}</div>${li(nameOnly, u => `${escapeHtml(u.old_name)} → <b>${escapeHtml(u.new_name)}</b> (${escapeHtml(u.old_class)})`)}` : ""}
      ${moves.length ? `<div class="res-title">Đổi lớp</div>${li(moves, u => `${escapeHtml(u.new_name)}: ${escapeHtml(u.old_class)} → <b>${escapeHtml(u.new_class)}</b>`)}` : ""}
      ${c.ambiguous ? `<div class="res-title">Cần xử lý tay (trùng tên)</div>${li(d.ambiguous, a => `${escapeHtml(a.name)} (${escapeHtml(a.class_name)}) — ${escapeHtml(a.reason)}`)}` : ""}
      ${c.to_create ? `<div class="res-title">${apply ? "Đã tạo" : "Sẽ tạo"} học sinh mới${c.to_create > d.to_create.length ? " (hiện 200 đầu)" : ""}</div>${li(d.to_create, a => `<b>${escapeHtml(a.code)}</b> ${escapeHtml(a.name)} (${escapeHtml(a.class_name)})`)}` : ""}
      ${c.label_taken ? `<div class="res-title">Trùng nhãn khuôn mặt — vẫn tạo nhưng chưa gắn nhãn, hãy sửa tay</div>${li(d.label_taken, a => `${escapeHtml(a.name)} (${escapeHtml(a.class_name)}) — nhãn ${escapeHtml(a.label)} đã có người dùng`)}` : ""}
      ${c.invalid_class ? `<div class="res-title">Tên lớp không hợp lệ (phải bắt đầu bằng khối, ví dụ 10A1) — bỏ qua</div>${li(d.invalid_class, a => `${escapeHtml(a.name)} (${escapeHtml(a.class_name)}) — ${escapeHtml(a.where)}`)}` : ""}
      ${!create && c.not_found ? `<div class="res-title">Có trong file, chưa có trong hệ thống</div>${li(d.not_found, a => `${escapeHtml(a.name)} (${escapeHtml(a.class_name)})`)}` : ""}
      ${c.not_in_list ? `<div class="res-title">Có trong hệ thống, không thấy trong file (cùng các lớp có trong file)</div>${li(d.not_in_list, a => `${escapeHtml(a.name)} (${escapeHtml(a.class_name)})`)}` : ""}`;
    el("rosterApplyBtn").style.display = !apply && (nameOnly.length || (move && moves.length) || (create && c.to_create)) ? "" : "none";
    if (apply) loadStudents();
  } catch { box.innerHTML = '<p class="error-msg" role="alert">Không kết nối được máy chủ</p>'; }
}

async function downloadRosterTemplate() {
  try {
    const res = await apiFetch("/students/roster-template");
    if (!res.ok) { toast("Không tải được file mẫu", true); return; }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url; a.download = "mau_danh_sach_lop.xlsx"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { toast("Không kết nối được máy chủ", true); }
}
