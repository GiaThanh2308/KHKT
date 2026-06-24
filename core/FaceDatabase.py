import os
import pickle
import numpy as np
from datetime import datetime


class FaceDatabase:
    def __init__(self, database_path="face_database.pkl"):
        # FIX: nhận database_path từ ngoài, KHÔNG tự load ngay
        # Để tránh load từ sai đường dẫn trước khi caller kịp set path
        self.database_path = database_path
        self.known_encodings = []
        self.known_names = []
        self.face_metadata = {}
        # Chỉ tự load nếu file tồn tại ở path mặc định
        # Nếu caller muốn load từ path khác, họ sẽ set database_path rồi gọi load_database()
        if os.path.exists(self.database_path):
            self.load_database()

    def load_database(self):
        if os.path.exists(self.database_path):
            try:
                with open(self.database_path, 'rb') as f:
                    data = pickle.load(f)
                    self.known_encodings = data.get('encodings', [])
                    self.known_names     = data.get('names', [])
                    self.face_metadata   = data.get('metadata', {})
                print(f"📂 Đã tải database: {len(self.known_names)} người từ {self.database_path}")
            except Exception as e:
                print(f"⚠️ Không đọc được database: {e}. Sẽ tạo mới.")
                self.known_encodings = []
                self.known_names     = []
                self.face_metadata   = {}
        else:
            print(f"⚠️ Không tìm thấy database tại: {self.database_path}")

    def save_database(self):
        data = {
            'encodings': self.known_encodings,
            'names':     self.known_names,
            'metadata':  self.face_metadata,
        }
        os.makedirs(os.path.dirname(os.path.abspath(self.database_path)), exist_ok=True)
        with open(self.database_path, 'wb') as f:
            pickle.dump(data, f)
        print(f"💾 Đã lưu database: {len(self.known_names)} người → {self.database_path}")

    def add_person(self, name, encodings, metadata=None):
        if not encodings:
            return False

        mean_vec  = np.mean(encodings, axis=0)
        mean_vec /= np.linalg.norm(mean_vec) + 1e-10

        self.known_encodings.append(mean_vec.astype(np.float32))
        self.known_names.append(name)

        self.face_metadata[name] = {
            "embeddings": [e.astype(np.float32) for e in encodings],
            "added":      datetime.now().isoformat(),
            "num_images": len(encodings),
        }

        self.save_database()
        return True
