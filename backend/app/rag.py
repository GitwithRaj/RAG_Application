import os
from typing import List, Optional
import pypdf
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_community.embeddings import JinaEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_groq import ChatGroq
from app.config import settings

# Initialize Jina embeddings using API key
embeddings = JinaEmbeddings(jina_api_key=settings.JINA_API_KEY, model_name=settings.EMBEDDING_MODEL_NAME)

def get_user_vectorstore_dir(user_id: int) -> str:
    user_dir = settings.VECTOR_STORE_DIR / f"user_{user_id}"
    user_dir.mkdir(parents=True, exist_ok=True)
    return str(user_dir)

def extract_text_from_pdf(file_path: str) -> str:
    text = ""
    try:
        reader = pypdf.PdfReader(file_path)
        for page in reader.pages:
            content = page.extract_text()
            if content:
                text += content + "\n"
    except Exception as e:
        print(f"Error extracting PDF text: {e}")
    return text

def chunk_text(text: str, filename: str, file_id: int) -> List[Document]:
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=700,
        chunk_overlap=100
    )
    chunks = text_splitter.split_text(text)
    
    docs = []
    for i, chunk in enumerate(chunks):
        docs.append(Document(
            page_content=chunk,
            metadata={
                "source": filename,
                "file_id": file_id,
                "chunk_index": i
            }
        ))
    return docs

def add_document_to_index(user_id: int, text: str, filename: str, file_id: int):
    docs = chunk_text(text, filename, file_id)
    if not docs:
        return
        
    user_dir = get_user_vectorstore_dir(user_id)
    index_path = os.path.join(user_dir, "index")
    
    if os.path.exists(index_path) or os.path.exists(index_path + ".faiss"):
        try:
            db = FAISS.load_local(user_dir, embeddings, allow_dangerous_deserialization=True)
            db.add_documents(docs)
            db.save_local(user_dir)
        except Exception as e:
            print(f"Error loading index, creating new: {e}")
            db = FAISS.from_documents(docs, embeddings)
            db.save_local(user_dir)
    else:
        db = FAISS.from_documents(docs, embeddings)
        db.save_local(user_dir)

def rebuild_user_index(user_id: int, db_docs: List) -> bool:
    """
    Rebuild the FAISS index from scratch using list of database documents.
    This is called when a file is deleted to keep the index clean.
    """
    user_dir = get_user_vectorstore_dir(user_id)
    index_path = os.path.join(user_dir, "index")
    
    # Remove existing index files if they exist
    for ext in ["", ".faiss", ".pkl"]:
        p = index_path + ext
        if os.path.exists(p):
            try:
                os.remove(p)
            except Exception as e:
                print(f"Error removing {p}: {e}")

    all_chunks = []
    for db_doc in db_docs:
        text = ""
        if db_doc.file_type == "pdf" and db_doc.file_path and os.path.exists(db_doc.file_path):
            text = extract_text_from_pdf(db_doc.file_path)
        elif db_doc.file_type == "txt" and db_doc.file_path and os.path.exists(db_doc.file_path):
            try:
                with open(db_doc.file_path, "r", encoding="utf-8") as f:
                    text = f.read()
            except Exception as e:
                print(f"Error reading TXT file {db_doc.file_path}: {e}")
        elif db_doc.file_type == "note" and db_doc.text_content:
            text = db_doc.text_content
            
        if text.strip():
            chunks = chunk_text(text, db_doc.filename, db_doc.id)
            all_chunks.extend(chunks)
            
    if all_chunks:
        db = FAISS.from_documents(all_chunks, embeddings)
        db.save_local(user_dir)
        return True
    return False

def query_user_documents(
    user_id: int, 
    question: str, 
    file_ids: Optional[List[int]] = None,
    custom_groq_api_key: Optional[str] = None
) -> dict:
    # Get API key
    api_key = custom_groq_api_key or settings.GROQ_API_KEY
    if not api_key:
        return {
            "answer": "Error: Groq API Key is not set. Please provide a Groq API Key in your environment or settings.",
            "sources": []
        }
        
    user_dir = get_user_vectorstore_dir(user_id)
    index_path = os.path.join(user_dir, "index")
    
    if not (os.path.exists(index_path) or os.path.exists(index_path + ".faiss")):
        return {
            "answer": "No documents uploaded yet. Please upload files or add text notes first to build your knowledge base.",
            "sources": []
        }
        
    try:
        # Load user index
        db = FAISS.load_local(user_dir, embeddings, allow_dangerous_deserialization=True)
        
        # Get retriever
        # If specific file_ids are selected, we can filter vectors by metadata.
        # LangChain FAISS retriever supports filtering if we pass it.
        # FAISS in langchain supports a simple metadata dict filter.
        search_kwargs = {"k": 5}
        if file_ids:
            # Lambda function filter is supported by langchain FAISS
            search_kwargs["filter"] = lambda metadata: metadata.get("file_id") in file_ids
            
        retriever = db.as_retriever(search_kwargs=search_kwargs)
        retrieved_docs = retriever.invoke(question)
        
        if not retrieved_docs:
            return {
                "answer": "I couldn't find any relevant details in your uploaded documents to answer this question. Please make sure the relevant documents are active.",
                "sources": []
            }
            
        # Format context
        context_parts = []
        sources = set()
        for doc in retrieved_docs:
            source_name = doc.metadata.get("source", "Unknown")
            sources.add(source_name)
            context_parts.append(f"--- SOURCE: {source_name} ---\n{doc.page_content}")
            
        context = "\n\n".join(context_parts)
        
        # Initialize Groq LLM
        llm = ChatGroq(
            temperature=0.2,
            groq_api_key=api_key,
            model_name=settings.GROQ_MODEL_NAME
        )
        
        # Build prompt
        system_prompt = (
            "You are an expert AI assistant that answers questions based strictly on the provided context.\n"
            "If the provided context does not contain the answer, politely state that you cannot find the answer "
            "in the uploaded documents, but provide whatever relevant info is available in the context.\n"
            "Do not make up facts or use external knowledge unless it directly expands on the context provided.\n"
            "Make sure your response is formatted in clean Markdown.\n\n"
            f"Here is the context:\n{context}"
        )
        
        messages = [
            ("system", system_prompt),
            ("human", question)
        ]
        
        response = llm.invoke(messages)
        
        return {
            "answer": response.content,
            "sources": sorted(list(sources))
        }
        
    except Exception as e:
        print(f"RAG query error: {e}")
        return {
            "answer": f"An error occurred while running the query: {str(e)}",
            "sources": []
        }
