// students.js — Chỉ dành cho teacher/admin
requireAuth();
requireTeacher();

document.getElementById("usernameDisplay").textContent =
  localStorage.getItem("username") || "---";

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
    filterStudents();
  } catch {
    showError("Không kết nối được server");
  }
}

function buildClassFilter(classes) {
  const khoisSet = new Set();
  const classMap = {}; // khoi → [lop]

  [...classes].sort().forEach(cls => {
    const khoi = cls.replace(/[^0-9]/g, "").slice(0, 2); // "10A1" → "10"
    if (!classMap[khoi]) classMap[khoi] = [];
    classMap[khoi].push(cls);
    khoisSet.add(khoi);
  });

  // Render filter bar
  const bar = document.getElementById("classFilterBar");
  if (!bar) return;

  let html = `<button class="filter-btn active" onclick="setKhoiFilter('', this)">Tất cả</button>`;
  [...khoisSet].sort().forEach(khoi => {
    html += `<button class="filter-btn" onclick="setKhoiFilter('${khoi}', this)">Khối ${khoi}</button>`;
  });
  bar.innerHTML = html;

  // Render lớp dropdown
  const lopSel = document.getElementById("lopFilter");
  if (!lopSel) return;
  lopSel.innerHTML = `<option value="">Tất cả lớp</option>`;
  Object.keys(classMap).sort().forEach(khoi => {
    const group = document.createElement("optgroup");
    group.label = `Khối ${khoi}`;
    classMap[khoi].sort().forEach(cls => {
      const opt = document.createElement("option");
      opt.value = cls;
      opt.textContent = cls;
      group.appendChild(opt);
    });
    lopSel.appendChild(group);
  });
}

let activeKhoi = "";

function setKhoiFilter(khoi, btn) {
  activeKhoi = khoi;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  // Reset lớp filter
  const lopSel = document.getElementById("lopFilter");
  if (lopSel) lopSel.value = "";
  filterStudents();
}

function filterStudents() {
  const q      = (document.getElementById("searchInput")?.value || "").toLowerCase();
  const lopVal = document.getElementById("lopFilter")?.value || "";

  let filtered = allStudents;

  // Lọc khối
  if (activeKhoi) {
    filtered = filtered.filter(s => (s.class_name || "").startsWith(activeKhoi));
  }

  // Lọc lớp cụ thể
  if (lopVal) {
    filtered = filtered.filter(s => s.class_name === lopVal);
  }

  // Tìm kiếm text
  if (q) {
    filtered = filtered.filter(s =>
      (s.full_name    || "").toLowerCase().includes(q) ||
      (s.student_code || "").toLowerCase().includes(q) ||
      (s.class_name   || "").toLowerCase().includes(q)
    );
  }

  renderTable(filtered);
}

function showError(msg) {
  const tbody = document.getElementById("studentTable");
  if (tbody)
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--danger);padding:32px">${escapeHtml(msg)}</td></tr>`;
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function renderTable(students) {
  const tbody = document.getElementById("studentTable");
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--gray-400);padding:32px">Chưa có học sinh nào</td></tr>`;
    return;
  }
  tbody.innerHTML = students.map((s, i) => `
    <tr>
      <td style="color:var(--gray-400)">${i + 1}</td>
      <td><span class="badge badge-blue">${escapeHtml(s.student_code)}</span></td>
      <td><strong>${escapeHtml(s.full_name)}</strong></td>
      <td>${escapeHtml(s.class_name)}</td>
      <td style="font-size:13px">${escapeHtml(s.phone) || "—"}</td>
      <td>
        <div class="action-btns">
          <button class="btn-sm edit-btn"   onclick="openEdit(${s.id})"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-sm delete-btn" onclick="deleteStudent(${s.id})"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join("");
}

function openModal() {
  document.getElementById("modalTitle").textContent = "Thêm học sinh";
  document.getElementById("editingId").value = "";
  ["studentCode","fullName","className","faceLabel","phone"].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById("studentModal").classList.add("open");
  document.body.classList.add("modal-open");
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
  document.getElementById("studentModal").classList.add("open");
}

function closeModal() {
  document.getElementById("studentModal").classList.remove("open");
  document.body.classList.remove("modal-open");
}

async function saveStudent() {
  const id   = document.getElementById("editingId").value;
  const body = {
    student_code: document.getElementById("studentCode").value.trim(),
    full_name:    document.getElementById("fullName").value.trim(),
    class_name:   document.getElementById("className").value.trim(),
    face_label:   document.getElementById("faceLabel").value.trim() || null,
    phone:        document.getElementById("phone").value.trim(),
  };

  if (!body.student_code || !body.full_name || !body.class_name) {
    alert("Vui lòng điền đầy đủ thông tin bắt buộc (*)"); return;
  }

  try {
    const res = await apiFetch(id ? `/students/${id}` : "/students", {
      method: id ? "PUT" : "POST",
      body:   JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || "Lỗi khi lưu học sinh"); return;
    }
    closeModal();
    loadStudents();
  } catch { alert("Lỗi kết nối server"); }
}

const createStudent = saveStudent;

async function deleteStudent(id) {
  const s    = allStudents.find(x => x.id === id);
  const name = s ? s.full_name : `ID ${id}`;
  if (!confirm(`Xóa học sinh "${name}"? Tất cả vi phạm liên quan cũng sẽ bị xóa.`)) return;
  try {
    const res = await apiFetch(`/students/${id}`, { method: "DELETE" });
    if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.detail || "Xóa thất bại"); return; }
    loadStudents();
  } catch { alert("Lỗi kết nối server"); }
}

loadStudents();
