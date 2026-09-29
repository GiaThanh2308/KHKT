FROM python:3.13-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

# Tạo admin mặc định nếu chưa có
CMD ["sh", "-c", "python create_admin.py --username admin --password Admin@123 --role admin || true; uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
