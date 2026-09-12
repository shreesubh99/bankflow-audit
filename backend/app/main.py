from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.api import (
    upload, dashboard, daily_audit, transactions,
    funds, sectors, reconciliation, exceptions, rules, settings,
    system
)

# Initialize database schema
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="BankFlow Audit Intelligence API",
    description="Production-grade financial-data processing, multi-sheet Excel normalization, reconciliation, and fund traceability engine.",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(upload.router)
app.include_router(dashboard.router)
app.include_router(daily_audit.router)
app.include_router(transactions.router)
app.include_router(funds.router)
app.include_router(sectors.router)
app.include_router(reconciliation.router)
app.include_router(exceptions.router)
app.include_router(rules.router)
app.include_router(settings.router)
app.include_router(system.router)

import os
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Check for frontend build
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

@app.get("/api/health")
def health_check():
    return {"status": "HEALTHY"}

if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return None
        file_path = frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")
else:
    @app.get("/")
    def root():
        return {
            "app": "BankFlow Audit Intelligence API",
            "version": "1.0.0",
            "status": "ONLINE",
            "docs": "/docs"
        }
