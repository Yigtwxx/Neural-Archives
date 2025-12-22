from fastapi import FastAPI, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, ARRAY
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

class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, index=True)
    tags = Column(String, nullable=True) # Simple comma-separated for now
    created_at = Column(String, default=lambda: str(datetime.utcnow()))

Base.metadata.create_all(bind=engine)

# --- Dependencies ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user_id(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Token")
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
             raise HTTPException(status_code=401, detail="Invalid Token Payload")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid Token")

# --- Schemas ---
class DocumentCreate(BaseModel):
    title: str
    description: str | None = None
    tags: str | None = None

class DocumentUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    tags: str | None = None

class DocumentOut(BaseModel):
    id: int
    title: str
    description: str | None = None
    owner_id: int
    tags: str | None = None
    created_at: str

# --- App ---
app = FastAPI(title="Document Service")

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/documents", response_model=DocumentOut)
def create_document(doc: DocumentCreate, user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    new_doc = Document(**doc.dict(), owner_id=user_id)
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    return new_doc

@app.get("/documents", response_model=list[DocumentOut])
def list_documents(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    return db.query(Document).filter(Document.owner_id == user_id).all()

@app.get("/documents/{doc_id}", response_model=DocumentOut)
def get_document(doc_id: int, user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Enforce ownership
    if doc.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this document")
        
    return doc

@app.put("/documents/{doc_id}", response_model=DocumentOut)
def update_document(doc_id: int, doc_update: DocumentUpdate, user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Ownership check
    if doc.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this document")

    if doc_update.title is not None:
        doc.title = doc_update.title
    if doc_update.description is not None:
        doc.description = doc_update.description
    if doc_update.tags is not None:
        doc.tags = doc_update.tags
    
    db.commit()
    db.refresh(doc)
    return doc

@app.delete("/documents/{doc_id}")
def delete_document(doc_id: int, user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if doc.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this document")

    db.delete(doc)
    db.commit()
    return {"status": "success", "message": "Document deleted"}
