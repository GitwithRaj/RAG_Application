from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routes import auth_routes, file_routes, chat_routes

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Aether RAG API",
    description="User-specific Retrieval-Augmented Generation API powered by FastAPI, LangChain, FAISS, and Groq.",
    version="1.0.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify React frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(auth_routes.router)
app.include_router(file_routes.router)
app.include_router(chat_routes.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Aether RAG API",
        "version": "1.0.0",
        "docs_url": "/docs"
    }
