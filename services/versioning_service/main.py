from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from datetime import datetime
import os
import requests
from jose import jwt, JWTError

# --- Config ---
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/RepoNote")
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
ALGORITHM = "HS256"
STORAGE_SERVICE_URL = os.getenv("STORAGE_SERVICE_URL", "http://storage_service:8000")
STORAGE_PUBLIC_URL = os.getenv("STORAGE_PUBLIC_URL", "http://localhost:8005")

# --- DB Setup ---
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Version(Base):
    __tablename__ = "versions"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, index=True)
    version_number = Column(Integer)
    storage_path = Column(String)
    file_name = Column(String)
    created_at = Column(String, default=lambda: str(datetime.utcnow()))

class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    owner_id = Column(Integer, index=True)
    tags = Column(String, nullable=True)
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
class VersionOut(BaseModel):
    id: int
    document_id: int
    version_number: int
    file_name: str
    created_at: str
    download_url: str | None = None

# --- App ---
app = FastAPI(title="Versioning Service")

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/versions", response_model=VersionOut)
async def create_version(
    document_id: int, 
    file: UploadFile = File(...), 
    user_id: int = Depends(get_current_user_id),
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    # 0. Check Ownership
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to add version to this document")
    
    # 1. Upload to Storage Service
    files = {'file': (file.filename, file.file, file.content_type)}
    # We forward the request to storage service
    try:
        # Note: In real world, we might use Minio client directly here or presigned URLs. 
        # For this setup, we'll proxy or just separate the concern. 
        # Let's assume Storage Service has an upload endpoint that returns the path.
        res = requests.post(f"{STORAGE_SERVICE_URL}/upload", files=files, headers={"Authorization": authorization})
        if res.status_code != 200:
            raise HTTPException(status_code=500, detail="Storage upload failed")
        storage_data = res.json()
        storage_path = storage_data["path"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Storage Service Error: {str(e)}")

    # 2. Determine Version Number
    last_version = db.query(Version).filter(Version.document_id == document_id).order_by(Version.version_number.desc()).first()
    new_version_num = (last_version.version_number + 1) if last_version else 1

    # 3. Save Metadata
    new_version = Version(
        document_id=document_id,
        version_number=new_version_num,
        storage_path=storage_path,
        file_name=file.filename
    )
    db.add(new_version)
    db.commit()
    db.refresh(new_version)
    
    return {
        "id": new_version.id, 
        "document_id": new_version.document_id, 
        "version_number": new_version.version_number,
        "file_name": new_version.file_name,
        "created_at": new_version.created_at,
        "download_url": f"{STORAGE_PUBLIC_URL}/download/{storage_path}" 
    }

@app.get("/versions/{document_id}", response_model=list[VersionOut])
def list_versions(document_id: int, db: Session = Depends(get_db)):
    versions = db.query(Version).filter(Version.document_id == document_id).all()
    # Populate download URL
    return [
        {
            "id": v.id,
            "document_id": v.document_id,
            "version_number": v.version_number,
            "file_name": v.file_name,
            "created_at": v.created_at,
            "download_url": f"{STORAGE_PUBLIC_URL}/download/{v.storage_path}"
        }
        for v in versions
    ]
