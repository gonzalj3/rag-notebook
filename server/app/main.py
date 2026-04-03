from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import health, ingest, projects, query


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load embedding model at startup
    from app.services.embedder import load_model

    load_model()
    yield


app = FastAPI(title="RAG Notebook", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(ingest.router, prefix="/ingest", tags=["ingest"])
app.include_router(query.router, tags=["query"])
app.include_router(projects.router, prefix="/projects", tags=["projects"])
