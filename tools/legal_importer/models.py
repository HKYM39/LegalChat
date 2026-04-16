from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date
from typing import Any


@dataclass(slots=True)
class ParagraphRecord:
    id: str
    document_id: str
    paragraph_order: int
    paragraph_text: str
    paragraph_no: int | None
    char_start: int
    char_end: int
    token_count: int
    heading_path: str | None = None
    section_id: str | None = None


@dataclass(slots=True)
class NormalizedDocument:
    id: str
    source_path: str
    source_type: str
    source_url: str | None
    external_source_id: str | None
    title: str
    neutral_citation: str | None
    parallel_citation: str | None
    court: str | None
    jurisdiction: str | None
    decision_date: date | None
    judges: str | None
    parties: str | None
    document_type: str
    language: str
    docket_number: str | None
    summary_text: str | None
    full_text: str
    raw_text: str
    text_checksum: str
    parse_status: str
    indexing_status: str
    paragraphs: list[ParagraphRecord]
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        if self.decision_date is not None:
            data["decision_date"] = self.decision_date.isoformat()
        return data
