from fastapi import APIRouter, Depends, Header, HTTPException, status
from typing import Optional
from app.auth import get_current_user
from app.models import User
from app.schemas import ChatQueryRequest, ChatQueryResponse
from app.rag import query_user_documents

router = APIRouter(prefix="/api/chat", tags=["Chat"])

@router.post("/query", response_model=ChatQueryResponse)
def query_documents(
    query_in: ChatQueryRequest,
    current_user: User = Depends(get_current_user),
    x_groq_api_key: Optional[str] = Header(None, alias="X-Groq-Api-Key")
):
    # Call RAG system
    res = query_user_documents(
        user_id=current_user.id,
        question=query_in.question,
        file_ids=query_in.file_ids,
        custom_groq_api_key=x_groq_api_key
    )
    
    # If returned answer starts with Error, raise it
    if res["answer"].startswith("Error:"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res["answer"]
        )
        
    return res
