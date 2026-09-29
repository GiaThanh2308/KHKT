import os
import shutil
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.getenv("DB_PATH", os.path.join(_BASE_DIR, "school.db"))

# ── HF Dataset sync ──────────────────────────────────────────────────────────
HF_TOKEN        = os.getenv("HF_TOKEN", "")
HF_DATASET_REPO = os.getenv("HF_DATASET_REPO", "")  # vd: GiaThanh/KHKT-database
DB_FILENAME     = "school.db"


def _hf_api():
    """Trả về huggingface_hub.HfApi nếu có token, ngược lại None."""
    if not HF_TOKEN or not HF_DATASET_REPO:
        return None
    try:
        from huggingface_hub import HfApi
        return HfApi(token=HF_TOKEN)
    except ImportError:
        print("⚠️  huggingface_hub chưa cài — bỏ qua sync HF Dataset")
        return None


def pull_db():
    """Tải school.db từ HF Dataset về (nếu có)."""
    api = _hf_api()
    if api is None:
        return
    try:
        from huggingface_hub import hf_hub_download
        path = hf_hub_download(
            repo_id=HF_DATASET_REPO,
            filename=DB_FILENAME,
            repo_type="dataset",
            token=HF_TOKEN,
            local_dir=_BASE_DIR,
        )
        if path != DB_PATH:
            shutil.copy(path, DB_PATH)
        print(f"✅ Đã tải database từ HF Dataset ({HF_DATASET_REPO})")
    except Exception as e:
        print(f"ℹ️  Không tải được DB từ HF (có thể chưa có): {e}")


def push_db():
    """Đẩy school.db lên HF Dataset."""
    api = _hf_api()
    if api is None:
        return
    if not os.path.exists(DB_PATH):
        return
    try:
        api.upload_file(
            path_or_fileobj=DB_PATH,
            path_in_repo=DB_FILENAME,
            repo_id=HF_DATASET_REPO,
            repo_type="dataset",
            commit_message="Auto-sync school.db",
        )
        print("✅ Đã đẩy database lên HF Dataset")
    except Exception as e:
        print(f"⚠️  Không đẩy được DB lên HF: {e}")


# Tải DB về ngay khi module được import (lúc server khởi động)
pull_db()

# ── SQLAlchemy setup ──────────────────────────────────────────────────────────
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()
