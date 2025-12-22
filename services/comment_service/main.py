from fastapi import FastAPI, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Text
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from datetime import datetime
import os
from jose import jwt, JWTError

# --- Config ---
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/RepoNote")
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
ALGORITHM = "HS256"

# --- DB Setup ---
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, index=True)
    version_id = Column(Integer, nullable=True, index=True)
    user_id = Column(Integer)
    username = Column(String) # Store username for display
    content = Column(Text)
    created_at = Column(String, default=lambda: str(datetime.utcnow()))

Base.metadata.create_all(bind=engine)

# --- Dependencies ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Token")
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload # {"user_id": ..., "sub": username}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid Token")

# --- Schemas ---
class CommentCreate(BaseModel):
    document_id: int
    version_id: int | None = None
    content: str

class CommentOut(BaseModel):
    id: int
    document_id: int
    version_id: int | None
    user_id: int
    username: str
    content: str
    created_at: str

# --- App ---
app = FastAPI(title="Comment Service")

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/comments", response_model=CommentOut)
def add_comment(comment: CommentCreate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    new_comment = Comment(
        document_id=comment.document_id,
        version_id=comment.version_id,
        content=comment.content,
        user_id=user["user_id"],
        username=user["sub"]
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    return new_comment

class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, index=True)

@app.get("/comments/{document_id}", response_model=list[CommentOut])
def list_comments(document_id: int, version_id: int | None = None, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # Check ownership
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # We only restrict if user is NOT the owner? 
    # Actually, usually comments are visible to the owner. 
    # If this is a shared doc system, viewers might see comments. 
    # But currently it's "private notes", so only owner should access.
    if doc.owner_id != user["user_id"]:
         raise HTTPException(status_code=403, detail="Not authorized to view comments")

    query = db.query(Comment).filter(Comment.document_id == document_id)
    if version_id:
        query = query.filter(Comment.version_id == version_id)
    return query.all()
