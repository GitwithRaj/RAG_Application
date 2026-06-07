import os
from pathlib import Path
from langchain_community.embeddings import JinaEmbeddings

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env file manually if it exists
env_path = BASE_DIR / ".env"
if env_path.exists():
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip()

class Settings:
    # Database file stored in user‑specific folder (default: C:\Users\<username>\.aether_rag)
    USER_DATA_ROOT: Path = Path(os.getenv("USER_DATA_ROOT", Path.home() / ".aether_rag"))
    USER_DATA_ROOT.mkdir(parents=True, exist_ok=True)
    
    database_url = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{USER_DATA_ROOT / 'rag_app.db'}"
)
    if database_url.startswith("postgres://"):
        database_url = database_url.replace(
        "postgres://",
        "postgresql://",
        1
    )
    DATABASE_URL: str = database_url

    SECRET_KEY: str = os.getenv("SECRET_KEY", "aether_rag_secret_key_change_me_in_prod")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    JINA_API_KEY: str = os.getenv("JINA_API_KEY", "")
    
    # Storage paths – all inside the user‑specific folder
    UPLOAD_DIR: Path = USER_DATA_ROOT / "uploads"
    VECTOR_STORE_DIR: Path = USER_DATA_ROOT / "vector_stores"
    
    # Langchain config
    embeddings = JinaEmbeddings(jina_api_key=JINA_API_KEY, model_name=os.getenv("EMBEDDING_MODEL_NAME", "jina-embeddings-v3"))
    EMBEDDING_MODEL_NAME: str = os.getenv("EMBEDDING_MODEL_NAME", "jina-embeddings-v3")
    GROQ_MODEL_NAME: str = os.getenv("GROQ_MODEL_NAME", "llama-3.3-70b-versatile")

settings = Settings()

# Ensure storage directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.VECTOR_STORE_DIR.mkdir(parents=True, exist_ok=True)
