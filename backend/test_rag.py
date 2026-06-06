import sys
import os

# Add the current directory to path so we can import app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.database import engine, Base, SessionLocal
from app.models import User, Document
from app.auth import get_password_hash, verify_password
from app.rag import chunk_text, add_document_to_index, query_user_documents

def test_database_and_auth():
    print("--- Cleaning Environment ---")
    import shutil
    for folder in ["vector_stores", "uploads"]:
        if os.path.exists(folder):
            shutil.rmtree(folder)
            
    # Clean tables / Drop and recreate
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    print("--- Testing Database & Auth ---")
    db = SessionLocal()
    db.query(User).filter(User.email == "test@example.com").delete()
    db.commit()
    
    # Create test user
    pwd = "supersecretpassword"
    hashed = get_password_hash(pwd)
    assert verify_password(pwd, hashed)
    
    user = User(email="test@example.com", hashed_password=hashed)
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"Created test user with ID: {user.id}")
    
    # Create test document metadata
    doc = Document(
        user_id=user.id,
        filename="test_note",
        file_type="note",
        text_content="DeepMind developed AlphaGo, which beat Lee Sedol in 2016."
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    print(f"Created test document with ID: {doc.id}")
    
    user_id = user.id
    doc_id = doc.id
    db.close()
    return user_id, doc_id

def test_rag_indexing(user_id, doc_id):
    print("--- Testing RAG Indexing ---")
    text = "DeepMind developed AlphaGo, which beat Lee Sedol in 2016. In 2017, AlphaZero was introduced."
    add_document_to_index(user_id, text, "deepmind_history", doc_id)
    print("RAG document chunked and indexed successfully.")

def test_rag_query(user_id, doc_id):
    print("--- Testing RAG Local Retrieval ---")
    # This will load the index and retrieve documents, but won't invoke Groq if API key is not set
    # Let's see if we can do retrieval test
    user_dir = os.path.join("vector_stores", f"user_{user_id}")
    index_path = os.path.join(user_dir, "index")
    
    if os.path.exists(index_path) or os.path.exists(index_path + ".faiss"):
        print("Vector index directory exists!")
        # Let's perform a retrieval using the function or manually
        from langchain_community.embeddings import HuggingFaceEmbeddings
        from langchain_community.vectorstores import FAISS
        from app.config import settings
        
        embeddings = HuggingFaceEmbeddings(model_name=settings.EMBEDDING_MODEL_NAME)
        db = FAISS.load_local(user_dir, embeddings, allow_dangerous_deserialization=True)
        retriever = db.as_retriever(search_kwargs={"k": 1})
        docs = retriever.invoke("When was AlphaGo developed?")
        
        print(f"Retrieved {len(docs)} documents.")
        for d in docs:
            print(f"Content: {d.page_content}")
            print(f"Metadata: {d.metadata}")
            assert d.metadata["file_id"] == doc_id
    else:
        print("Vector index files not found!")
        assert False

if __name__ == "__main__":
    try:
        user_id, doc_id = test_database_and_auth()
        test_rag_indexing(user_id, doc_id)
        test_rag_query(user_id, doc_id)
        print("\nAll local RAG database & indexing tests PASSED successfully!")
    except Exception as e:
        print(f"\nTest failed: {e}")
        import traceback
        traceback.print_exc()
