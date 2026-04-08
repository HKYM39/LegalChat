from sqlalchemy import String, Text, Date, Integer, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import uuid

from app.db.session import Base

def uuid_str() -> str:
    return str(uuid.uuid4())

class LegalDocument(Base):
    __tablename__ = "legal_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    neutral_citation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    court: Mapped[str | None] = mapped_column(String(255), nullable=True)
    jurisdiction: Mapped[str | None] = mapped_column(String(255), nullable=True)
    decision_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    document_type: Mapped[str] = mapped_column(String(100), nullable=False, default="case")
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    full_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    paragraphs = relationship("LegalDocumentParagraph", back_populates="document")
    chunks = relationship("LegalDocumentChunk", back_populates="document")


class LegalDocumentParagraph(Base):
    __tablename__ = "legal_document_paragraphs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    document_id: Mapped[str] = mapped_column(ForeignKey("legal_documents.id"), nullable=False)
    paragraph_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    paragraph_order: Mapped[int] = mapped_column(Integer, nullable=False)
    paragraph_text: Mapped[str] = mapped_column(Text, nullable=False)

    document = relationship("LegalDocument", back_populates="paragraphs")


class LegalDocumentChunk(Base):
    __tablename__ = "legal_document_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    document_id: Mapped[str] = mapped_column(ForeignKey("legal_documents.id"), nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    paragraph_start_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    paragraph_end_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    heading_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    vector_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    embedding_model_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    document = relationship("LegalDocument", back_populates="chunks")


class SearchQuery(Base):
    __tablename__ = "search_queries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    query_text: Mapped[str] = mapped_column(Text, nullable=False)
    query_type: Mapped[str] = mapped_column(String(50), nullable=False)
    filters_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AnswerSession(Base):
    __tablename__ = "answer_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    query_id: Mapped[str | None] = mapped_column(ForeignKey("search_queries.id"), nullable=True)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    answer_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    answer_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)