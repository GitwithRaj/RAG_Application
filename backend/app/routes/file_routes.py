import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Document
from app.schemas import DocumentResponse, TextNoteCreate
from app.auth import get_current_user
from app.config import settings
from app.rag import add_document_to_index, rebuild_user_index, extract_text_from_pdf

router = APIRouter(prefix="/api/files", tags=["Files"])

def get_user_upload_dir(user_id: int) -> str:
    user_dir = settings.UPLOAD_DIR / f"user_{user_id}"
    user_dir.mkdir(parents=True, exist_ok=True)
    return str(user_dir)

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check file type
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    
    if ext not in [".pdf", ".txt"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Only PDF and TXT files are allowed."
        )
        
    file_type = "pdf" if ext == ".pdf" else "txt"
    
    # Save file to disk
    user_upload_dir = get_user_upload_dir(current_user.id)
    file_path = os.path.join(user_upload_dir, filename)
    
    # Resolve duplicate naming by suffixing if needed
    base, extension = os.path.splitext(filename)
    counter = 1
    while os.path.exists(file_path):
        filename = f"{base}_{counter}{extension}"
        file_path = os.path.join(user_upload_dir, filename)
        counter += 1
        
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )
        
    # Read text content for vector indexing
    text = ""
    if file_type == "pdf":
        text = extract_text_from_pdf(file_path)
    else:  # txt
        try:
            text = content.decode("utf-8", errors="ignore")
        except Exception as e:
            # Clean up saved file
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to decode TXT file: {str(e)}"
            )
            
    if not text.strip():
        # Clean up
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The file content is empty or could not be parsed."
        )
        
    # Create DB entry
    db_doc = Document(
        user_id=current_user.id,
        filename=filename,
        file_type=file_type,
        file_path=file_path
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    
    # Add to FAISS Vector store
    try:
        add_document_to_index(current_user.id, text, filename, db_doc.id)
    except Exception as e:
        # Revert DB entry if indexing fails completely
        db.delete(db_doc)
        db.commit()
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to index file in vector database: {str(e)}"
        )
        
    return db_doc

@router.post("/text", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def create_text_note(
    note_in: TextNoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not note_in.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Content cannot be empty"
        )
        
    # Create DB entry
    db_doc = Document(
        user_id=current_user.id,
        filename=note_in.title,
        file_type="note",
        text_content=note_in.content
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    
    # Add to FAISS Vector store
    try:
        add_document_to_index(current_user.id, note_in.content, note_in.title, db_doc.id)
    except Exception as e:
        db.delete(db_doc)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to index note: {str(e)}"
        )
        
    return db_doc

@router.get("", response_model=List[DocumentResponse])
def list_files(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    return docs

@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
def delete_file(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Find document
    db_doc = db.query(Document).filter(
        Document.id == document_id, 
        Document.user_id == current_user.id
    ).first()
    
    if not db_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found."
        )
        
    # Delete file from disk if applicable
    if db_doc.file_path and os.path.exists(db_doc.file_path):
        try:
            os.remove(db_doc.file_path)
        except Exception as e:
            print(f"Error deleting file from disk: {e}")
            
    # Delete from DB
    db.delete(db_doc)
    db.commit()
    
    # Rebuild user's vector store index from scratch
    # This guarantees that the deleted document's chunks are fully removed
    remaining_docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    rebuild_user_index(current_user.id, remaining_docs)
    
    return {"message": "File deleted successfully"}
