# Hướng dẫn áp dụng các bản fix

## Các file đã sửa / thêm mới

| File | Trạng thái | Nội dung fix |
|------|-----------|-------------|
| `backend/database/models.py` | Sửa | Timezone-aware datetime, face_label nullable |
| `backend/auth.py` | **Mới** | bcrypt hash mật khẩu + JWT token |
| `backend/main.py` | Sửa | JWT auth toàn bộ API, CORS fix, /create-user bảo vệ |
| `core/AdvancedFaceRecognitionSystem.py` | Sửa | rescan cập nhật face_metadata, build_database lưu metadata |
| `main.py` | Sửa | Bỏ hardcode đường dẫn Windows |
| `frontend/js/api.js` | **Mới** | Helper fetch tự gắn token, xử lý 401 tự động logout |
| `frontend/js/login.js` | Sửa | Lưu JWT token, kiểm tra HTTP status |
| `frontend/js/students.js` | Sửa | Dùng apiFetch, error handling, fix XSS |
| `frontend/js/face.js` | Sửa | Dùng apiFetch, fix saveViolation check, escape HTML |
| `.env.example` | **Mới** | Template biến môi trường |
| `create_admin.py` | **Mới** | Script tạo/migrate tài khoản admin |

---

## Các bước cài đặt

### 1. Cài thêm thư viện mới
```bash
pip install passlib[bcrypt] python-jose[cryptography]
```

### 2. Cấu hình file .env
```bash
cp .env.example .env
# Mở .env và điền JWT_SECRET_KEY + GEMINI_API_KEY
```

### 3. Tạo tài khoản admin (quan trọng!)
```bash
# Tạo admin mới
python create_admin.py --username admin --password MatKhauCuaBan

# Nếu đã có user cũ (plaintext), chạy lệnh này để migrate sang bcrypt
python create_admin.py --username <tên_user_cũ> --password <mật_khẩu_cũ>
```

### 4. Thêm `api.js` vào tất cả HTML cần đăng nhập
Thêm dòng này vào **trước** các script khác trong mỗi trang:
```html
<script src="js/api.js"></script>
```
Ví dụ trong `index.html`, `students.html`, `violations.html`, `stats.html`, `chatbot.html`, `plate.html`:
```html
<script src="js/api.js"></script>
<script src="js/face.js"></script>  <!-- hoặc students.js, v.v. -->
```

### 5. Cập nhật ALLOWED_ORIGINS trong .env
Nếu frontend chạy trên cổng khác (ví dụ 5173 khi dùng Vite):
```
ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
```

---

## Tóm tắt những gì đã được fix

### 🔴 Bảo mật
- **Mật khẩu** giờ được hash bằng bcrypt, không lưu plaintext nữa
- **JWT token** — mọi API đều yêu cầu token hợp lệ
- **CORS** — không còn `allow_origins=["*"]` với credentials
- **`/create-user`** — chỉ admin mới gọi được

### 🟠 Bug logic
- **Timezone** — `created_at` giờ dùng `DateTime(timezone=True)` + `datetime.now(timezone.utc)` → thống kê hôm nay/tuần chính xác
- **`rescan_known_faces`** — giờ cập nhật `face_metadata` → `build_ann_index()` hoạt động đúng
- **`face_label = ""`** — lưu `None` thay vì chuỗi rỗng → tránh lỗi unique constraint
- **`saveViolation`** — kiểm tra `res.ok` thay vì chỉ `data.id`
- **`deleteStudent`** — kiểm tra response trước khi reload
- **`loadStudents`** — có try/catch, hiển thị lỗi khi server down

### 🟡 Cải thiện khác
- Bỏ hardcode `D:\python\KHKT\resources` → dùng env var hoặc relative path
- XSS — escape HTML khi render tên học sinh, mã học sinh
- `AdvancedFaceRecognitionSystem` chỉ khởi tạo 1 lần, không load database 2 lần
