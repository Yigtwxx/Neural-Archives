from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Header
from fastapi.responses import RedirectResponse
from minio import Minio
import os
import uuid
from jose import jwt, JWTError

# --- Config ---
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
BUCKET_NAME = os.getenv("BUCKET_NAME", "reponote-files")
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
ALGORITHM = "HS256"
USE_SSL = False

# --- Minio Client ---
client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=USE_SSL
)

# Ensure bucket exists
if not client.bucket_exists(BUCKET_NAME):
    client.make_bucket(BUCKET_NAME)

# --- Auth ---
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

app = FastAPI(title="Storage Service")

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), user_id: int = Depends(get_current_user_id)):
    try:
        file_ext = file.filename.split(".")[-1]
        object_name = f"{uuid.uuid4()}.{file_ext}"
        
        # Upload
        client.put_object(
            BUCKET_NAME,
            object_name,
            file.file,
            length=-1,
            part_size=10*1024*1024
        )
        return {"path": object_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download/{object_name}")
def download_file(object_name: str, user_id: int = Depends(get_current_user_id)):
    try:
        # Get presigned URL
        url = client.presigned_get_object(BUCKET_NAME, object_name)
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=404, detail="File not found")
