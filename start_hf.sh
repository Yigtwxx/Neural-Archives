#!/bin/bash

# 1. Start PostgreSQL
echo "Starting PostgreSQL..."
mkdir -p /app/data/postgres
chown -R postgres:postgres /app/data/postgres
su postgres -c "/usr/lib/postgresql/14/bin/initdb -D /app/data/postgres" || echo "Initdb skipped or failed"
su postgres -c "/usr/lib/postgresql/14/bin/pg_ctl -D /app/data/postgres -l /app/data/postgres/logfile start"

# Wait for Postgres to be ready
echo "Waiting for PostgreSQL to start..."
until su postgres -c "pg_isready"; do
  echo "Postgres not ready, waiting..."
  sleep 1
done

su postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname = 'reponote_user'\" | grep -q 1 || psql -c \"CREATE USER reponote_user WITH PASSWORD 'password';\""
su postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname = 'reponote'\" | grep -q 1 || psql -c \"CREATE DATABASE reponote OWNER reponote_user;\""
su postgres -c "psql -c \"ALTER USER reponote_user WITH SUPERUSER;\""

# 2. Start MinIO
echo "Starting MinIO..."
mkdir -p /app/data/minio
minio server /app/data/minio --address ":9000" --console-address ":9001" &

# 3. Start Microservices - LOGS TO STDOUT for Debugging
echo "Starting Services..."
export DATABASE_URL="postgresql://reponote_user:password@localhost:5432/reponote"

export MINIO_ENDPOINT="localhost:9000"
export MINIO_ACCESS_KEY="minioadmin"
export MINIO_SECRET_KEY="minioadmin"
export USE_SSL="False"
export STORAGE_SERVICE_URL="http://localhost:8005"
export STORAGE_PUBLIC_URL="/api/storage"

# Auth Service
cd /app/services/auth_service
uvicorn main:app --host 0.0.0.0 --port 8001 &
sleep 2

# Document Service
cd /app/services/document_service
uvicorn main:app --host 0.0.0.0 --port 8002 &
sleep 5 # Wait for DB tables to be created to avoid race conditions

# Versioning Service
cd /app/services/versioning_service
uvicorn main:app --host 0.0.0.0 --port 8003 &

# Comment Service
cd /app/services/comment_service
uvicorn main:app --host 0.0.0.0 --port 8004 &

# Storage Service
cd /app/services/storage_service
uvicorn main:app --host 0.0.0.0 --port 8005 &

# 3.5 Wait for Services to be Ready
echo "Waiting for Microservices to start..."
timeout=60
count=0
# Wait for Auth Service (Critical for login)
until curl -s http://localhost:8001/docs > /dev/null; do
  echo "Waiting for Auth Service (8001)..."
  sleep 2
  count=$((count+2))
  if [ $count -ge $timeout ]; then
    echo "Timeout waiting for Auth Service"
    exit 1
  fi
done
echo "Auth Service is up!"

# 4. Start Nginx (Gateway + Frontend)
echo "Starting Nginx..."
nginx -c /app/nginx.conf -g "daemon off;"
