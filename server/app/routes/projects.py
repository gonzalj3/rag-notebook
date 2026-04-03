import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.database import get_db
from app.models.schemas import (
    AddItemRequest,
    DocumentOut,
    ProjectCreate,
    ProjectDetail,
    ProjectOut,
    ProjectUpdate,
)
from app.models.tables import Document, Project, ProjectDocument
from app.services.retriever import hybrid_search

router = APIRouter()


def _doc_out(doc: Document) -> dict:
    return {
        "id": doc.id,
        "content": doc.content,
        "source_type": doc.source_type,
        "source_url": doc.source_url,
        "source_title": doc.source_title,
        "user_note": doc.user_note,
        "reflection": doc.reflection,
        "is_read": doc.is_read,
        "token_count": doc.token_count,
        "tags": [t.name for t in doc.tags],
        "created_at": doc.created_at,
    }


@router.post("", response_model=ProjectOut)
async def create_project(req: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(name=req.name, description=req.description, icon=req.icon)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        icon=project.icon,
        status=project.status,
        notes=project.notes,
        item_count=0,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.get("", response_model=list[ProjectOut])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            Project,
            func.count(ProjectDocument.document_id).label("item_count"),
        )
        .outerjoin(ProjectDocument, Project.id == ProjectDocument.project_id)
        .group_by(Project.id)
        .order_by(Project.updated_at.desc())
    )
    projects = []
    for row in result.all():
        p = row[0]
        projects.append(
            ProjectOut(
                id=p.id,
                name=p.name,
                description=p.description,
                icon=p.icon,
                status=p.status,
                notes=p.notes,
                item_count=row[1],
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
        )
    return projects


@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(project_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.documents).selectinload(Document.tags))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return ProjectDetail(
        id=project.id,
        name=project.name,
        description=project.description,
        icon=project.icon,
        status=project.status,
        notes=project.notes,
        item_count=len(project.documents),
        created_at=project.created_at,
        updated_at=project.updated_at,
        documents=[DocumentOut(**_doc_out(d)) for d in project.documents],
    )


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(project_id: uuid.UUID, req: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)

    # Get item count
    count_result = await db.execute(
        select(func.count()).where(ProjectDocument.project_id == project_id)
    )
    item_count = count_result.scalar() or 0

    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        icon=project.icon,
        status=project.status,
        notes=project.notes,
        item_count=item_count,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.post("/{project_id}/items")
async def add_item(project_id: uuid.UUID, req: AddItemRequest, db: AsyncSession = Depends(get_db)):
    # Verify project and document exist
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    doc = await db.get(Document, req.document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    pd = ProjectDocument(project_id=project_id, document_id=req.document_id)
    db.add(pd)
    await db.commit()
    return {"status": "ok"}


@router.delete("/{project_id}/items/{document_id}")
async def remove_item(project_id: uuid.UUID, document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ProjectDocument).where(
            ProjectDocument.project_id == project_id,
            ProjectDocument.document_id == document_id,
        )
    )
    pd = result.scalar_one_or_none()
    if not pd:
        raise HTTPException(status_code=404, detail="Item not in project")

    await db.delete(pd)
    await db.commit()
    return {"status": "ok"}


@router.get("/{project_id}/suggestions", response_model=list[DocumentOut])
async def get_suggestions(project_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Suggest documents related to the project that aren't already in it."""
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.documents))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Build a query from project name + description + existing document content
    query_parts = [project.name]
    if project.description:
        query_parts.append(project.description)
    for doc in project.documents[:3]:
        query_parts.append(doc.content[:200])
    query_text = " ".join(query_parts)

    existing_doc_ids = {str(d.id) for d in project.documents}

    search_results = await hybrid_search(db, query_text, limit=10)

    suggestions = []
    for r in search_results:
        if str(r.document_id) in existing_doc_ids:
            continue
        doc_result = await db.execute(
            select(Document).options(selectinload(Document.tags)).where(Document.id == r.document_id)
        )
        doc = doc_result.scalar_one_or_none()
        if doc:
            suggestions.append(DocumentOut(**_doc_out(doc)))
        if len(suggestions) >= 5:
            break

    return suggestions
