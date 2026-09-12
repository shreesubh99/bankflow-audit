import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_PATH = BASE_DIR / "bankflow_audit.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATABASE_PATH}")

MAX_FILE_SIZE_MB = 100
ALLOWED_EXTENSIONS = {".xlsx", ".xls", ".csv"}

DEFAULT_CONFIDENCE_THRESHOLD = 75.0
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 500
