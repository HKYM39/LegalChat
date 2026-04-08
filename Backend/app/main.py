from fastapi import FastAPI
from app.db.session import Base, engine

from app.models.document import (
    LegalDocument,
    LegalDocumentParagraph,
    LegalDocumentChunk,
    SearchQuery,
    AnswerSession,
)

app = FastAPI(title="Legal Casebase API")

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

@app.get("/health")
def health():
    return {"status": "ok"}