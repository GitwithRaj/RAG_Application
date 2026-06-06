from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

# User Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[int] = None

# Document Schemas
class DocumentResponse(BaseModel):
    id: int
    filename: str
    file_type: str
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class TextNoteCreate(BaseModel):
    title: str
    content: str

# Chat Schemas
class ChatQueryRequest(BaseModel):
    question: str
    file_ids: Optional[List[int]] = None  # Filter query by specific documents (optional)

class ChatQueryResponse(BaseModel):
    answer: str
    sources: List[str]
