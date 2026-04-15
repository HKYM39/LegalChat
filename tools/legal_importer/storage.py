from __future__ import annotations

import json
from datetime import datetime, timezone

from tools.legal_importer.models import NormalizedDocument


def connect(database_url: str):
    try:
        import psycopg
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Missing dependency 'psycopg'. Install with: pip install -r tools/requirements.txt"
        ) from exc

    return psycopg.connect(database_url)


def import_document(connection, document: NormalizedDocument) -> None:
    now = datetime.now(timezone.utc)
    with connection.transaction():
        upsert_document(connection, document, now.isoformat())
        delete_children(connection, document.id)
        insert_paragraphs(connection, document)
        insert_chunks(connection, document)


def upsert_document(connection, document: NormalizedDocument, imported_at: str) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO legal_documents (
              id,
              source_type,
              source_url,
              external_source_id,
              title,
              neutral_citation,
              parallel_citation,
              court,
              jurisdiction,
              decision_date,
              judges,
              parties,
              document_type,
              language,
              docket_number,
              summary_text,
              full_text,
              raw_text,
              text_checksum,
              parse_status,
              indexing_status,
              is_active,
              imported_at,
              updated_at
            ) VALUES (
              %(id)s,
              %(source_type)s,
              %(source_url)s,
              %(external_source_id)s,
              %(title)s,
              %(neutral_citation)s,
              %(parallel_citation)s,
              %(court)s,
              %(jurisdiction)s,
              %(decision_date)s,
              %(judges)s,
              %(parties)s,
              %(document_type)s,
              %(language)s,
              %(docket_number)s,
              %(summary_text)s,
              %(full_text)s,
              %(raw_text)s,
              %(text_checksum)s,
              %(parse_status)s,
              %(indexing_status)s,
              TRUE,
              %(imported_at)s,
              NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              source_type = EXCLUDED.source_type,
              source_url = EXCLUDED.source_url,
              external_source_id = EXCLUDED.external_source_id,
              title = EXCLUDED.title,
              neutral_citation = EXCLUDED.neutral_citation,
              parallel_citation = EXCLUDED.parallel_citation,
              court = EXCLUDED.court,
              jurisdiction = EXCLUDED.jurisdiction,
              decision_date = EXCLUDED.decision_date,
              judges = EXCLUDED.judges,
              parties = EXCLUDED.parties,
              document_type = EXCLUDED.document_type,
              language = EXCLUDED.language,
              docket_number = EXCLUDED.docket_number,
              summary_text = EXCLUDED.summary_text,
              full_text = EXCLUDED.full_text,
              raw_text = EXCLUDED.raw_text,
              text_checksum = EXCLUDED.text_checksum,
              parse_status = EXCLUDED.parse_status,
              indexing_status = EXCLUDED.indexing_status,
              is_active = TRUE,
              imported_at = EXCLUDED.imported_at,
              updated_at = NOW()
            """,
            {
                "id": document.id,
                "source_type": document.source_type,
                "source_url": document.source_url,
                "external_source_id": document.external_source_id,
                "title": document.title,
                "neutral_citation": document.neutral_citation,
                "parallel_citation": document.parallel_citation,
                "court": document.court,
                "jurisdiction": document.jurisdiction,
                "decision_date": document.decision_date,
                "judges": document.judges,
                "parties": document.parties,
                "document_type": document.document_type,
                "language": document.language,
                "docket_number": document.docket_number,
                "summary_text": document.summary_text,
                "full_text": document.full_text,
                "raw_text": document.raw_text,
                "text_checksum": document.text_checksum,
                "parse_status": document.parse_status,
                "indexing_status": document.indexing_status,
                "imported_at": imported_at,
            },
        )


def delete_children(connection, document_id: str) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            "DELETE FROM legal_document_chunks WHERE document_id = %s",
            (document_id,),
        )
        cursor.execute(
            "DELETE FROM legal_document_paragraphs WHERE document_id = %s",
            (document_id,),
        )


def insert_paragraphs(connection, document: NormalizedDocument) -> None:
    with connection.cursor() as cursor:
        cursor.executemany(
            """
            INSERT INTO legal_document_paragraphs (
              id,
              document_id,
              section_id,
              paragraph_no,
              paragraph_order,
              paragraph_text,
              char_start,
              char_end,
              token_count
            ) VALUES (
              %(id)s,
              %(document_id)s,
              %(section_id)s,
              %(paragraph_no)s,
              %(paragraph_order)s,
              %(paragraph_text)s,
              %(char_start)s,
              %(char_end)s,
              %(token_count)s
            )
            """,
            [
                {
                    "id": paragraph.id,
                    "document_id": paragraph.document_id,
                    "section_id": paragraph.section_id,
                    "paragraph_no": paragraph.paragraph_no,
                    "paragraph_order": paragraph.paragraph_order,
                    "paragraph_text": paragraph.paragraph_text,
                    "char_start": paragraph.char_start,
                    "char_end": paragraph.char_end,
                    "token_count": paragraph.token_count,
                }
                for paragraph in document.paragraphs
            ],
        )


def insert_chunks(connection, document: NormalizedDocument) -> None:
    with connection.cursor() as cursor:
        cursor.executemany(
            """
            INSERT INTO legal_document_chunks (
              id,
              document_id,
              section_id,
              chunk_index,
              chunk_type,
              chunk_text,
              paragraph_start_no,
              paragraph_end_no,
              heading_path,
              token_count,
              chunk_metadata,
              is_active,
              updated_at
            ) VALUES (
              %(id)s,
              %(document_id)s,
              %(section_id)s,
              %(chunk_index)s,
              %(chunk_type)s,
              %(chunk_text)s,
              %(paragraph_start_no)s,
              %(paragraph_end_no)s,
              %(heading_path)s,
              %(token_count)s,
              %(chunk_metadata)s::jsonb,
              TRUE,
              NOW()
            )
            """,
            [
                {
                    "id": chunk.id,
                    "document_id": chunk.document_id,
                    "section_id": chunk.section_id,
                    "chunk_index": chunk.chunk_index,
                    "chunk_type": chunk.chunk_type,
                    "chunk_text": chunk.chunk_text,
                    "paragraph_start_no": chunk.paragraph_start_no,
                    "paragraph_end_no": chunk.paragraph_end_no,
                    "heading_path": chunk.heading_path,
                    "token_count": chunk.token_count,
                    "chunk_metadata": json.dumps(chunk.chunk_metadata),
                }
                for chunk in document.chunks
            ],
        )
