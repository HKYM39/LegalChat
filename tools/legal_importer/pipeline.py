from __future__ import annotations

import hashlib
import json
import logging
import re
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from tools.legal_importer.config import PipelineConfig
from tools.legal_importer.models import ChunkRecord, NormalizedDocument, ParagraphRecord
from tools.legal_importer.pdf import extract_pdf_text

LOGGER = logging.getLogger(__name__)
PARAGRAPH_NO_RE = re.compile(r"^\[(\d{1,3})\]\s*")
FILENAME_RE = re.compile(
    r"^(?P<title>.+?)\s+(?P<citation>\[\d{4}\]\s+[A-Z]{2,}\s+\d+)\s+\((?P<date>[^)]+)\)$"
)


def discover_pdfs(source_dir: Path, limit: int | None = None) -> list[Path]:
    pdfs = sorted(source_dir.glob("*.pdf"))
    if limit is not None:
        return pdfs[:limit]
    return pdfs


def normalize_document(pdf_path: Path, config: PipelineConfig) -> NormalizedDocument:
    raw_text = extract_pdf_text(pdf_path)
    cleaned_text = clean_raw_text(raw_text)
    metadata = derive_metadata(pdf_path, cleaned_text, config.root_dir)
    paragraphs = build_paragraphs(metadata["document_id"], cleaned_text)
    chunks = build_chunks(metadata["document_id"], paragraphs, config)

    return NormalizedDocument(
        id=metadata["document_id"],
        source_path=str(pdf_path.relative_to(config.root_dir)),
        source_type="offline_import",
        source_url=None,
        external_source_id=metadata["external_source_id"],
        title=metadata["title"],
        neutral_citation=metadata["neutral_citation"],
        parallel_citation=None,
        court=metadata["court"],
        jurisdiction=metadata["jurisdiction"],
        decision_date=metadata["decision_date"],
        judges=None,
        parties=metadata["parties"],
        document_type="case",
        language="en",
        docket_number=None,
        summary_text=build_summary(paragraphs),
        full_text="\n\n".join(paragraph.paragraph_text for paragraph in paragraphs),
        raw_text=raw_text,
        text_checksum=sha256_hex(cleaned_text),
        parse_status="completed",
        indexing_status="pending",
        paragraphs=paragraphs,
        chunks=chunks,
        warnings=collect_warnings(cleaned_text, paragraphs, chunks),
    )


def clean_raw_text(raw_text: str) -> str:
    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\u00a0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    lines = [line.strip() for line in text.splitlines()]
    lines = [line for line in lines if not is_noise_line(line)]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def is_noise_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if re.fullmatch(r"\d+", stripped):
        return True
    if stripped.startswith("[EMPTY_PAGE_"):
        return True
    if stripped.lower().startswith("page ") and len(stripped.split()) <= 3:
        return True
    if "https://www.austlii.edu.au/cgi-bin/viewdoc/" in stripped:
        return True
    if re.search(r"第\s*\d+\s*页\s*共\s*\d+\s*页", stripped):
        return True
    if stripped.startswith("Last Updated:"):
        return True
    if stripped.startswith("Date of Hearing:") and re.fullmatch(
        r"Date of Hearing:\s+[A-Za-z]+",
        stripped,
    ):
        return True
    if re.fullmatch(r"[A-Z]\s*/", stripped):
        return True
    return False


def derive_metadata(pdf_path: Path, cleaned_text: str, root_dir: Path) -> dict[str, object]:
    stem = pdf_path.stem
    match = FILENAME_RE.match(stem)
    if match:
        title = match.group("title").strip()
        neutral_citation = match.group("citation").strip()
        decision_date = parse_decision_date(match.group("date").strip())
    else:
        title = stem
        neutral_citation = None
        decision_date = None

    court = infer_court(neutral_citation, cleaned_text)
    jurisdiction = "Australia" if court else None
    parties = title if " v " in title else None
    relative_path = str(pdf_path.relative_to(root_dir))
    external_source_id = sha256_hex(relative_path)[:24]
    document_id = str(
        uuid5(
            NAMESPACE_URL,
            f"legal-document:{relative_path}:{neutral_citation or title}",
        )
    )
    return {
        "document_id": document_id,
        "external_source_id": external_source_id,
        "title": title,
        "neutral_citation": neutral_citation,
        "decision_date": decision_date,
        "court": court,
        "jurisdiction": jurisdiction,
        "parties": parties,
    }


def parse_decision_date(value: str):
    try:
        return datetime.strptime(value, "%d %B %Y").date()
    except ValueError:
        return None


def infer_court(neutral_citation: str | None, cleaned_text: str) -> str | None:
    if neutral_citation and " HCA " in neutral_citation:
        return "High Court of Australia"
    first_lines = " ".join(cleaned_text.splitlines()[:5]).lower()
    if "high court of australia" in first_lines:
        return "High Court of Australia"
    return None


def build_summary(paragraphs: list[ParagraphRecord]) -> str | None:
    if not paragraphs:
        return None
    snippet = " ".join(paragraph.paragraph_text for paragraph in paragraphs[:2]).strip()
    if len(snippet) <= 400:
        return snippet or None
    return f"{snippet[:397].rstrip()}..."


def build_paragraphs(document_id: str, cleaned_text: str) -> list[ParagraphRecord]:
    blocks = split_paragraph_blocks(cleaned_text)
    paragraphs: list[ParagraphRecord] = []
    cursor = 0
    fallback_number = 1

    for order, block in enumerate(blocks, start=1):
        normalized_block = " ".join(part.strip() for part in block.splitlines() if part.strip())
        if not normalized_block:
            continue
        paragraph_no: int | None = None
        match = PARAGRAPH_NO_RE.match(normalized_block)
        if match:
            paragraph_no = int(match.group(1))
            normalized_block = normalized_block[match.end() :].strip()
        else:
            paragraph_no = fallback_number
        fallback_number = paragraph_no + 1 if paragraph_no is not None else fallback_number + 1

        char_start = cursor
        char_end = char_start + len(normalized_block)
        cursor = char_end + 2
        paragraph_id = str(
            uuid5(
                NAMESPACE_URL,
                f"paragraph:{document_id}:{order}:{paragraph_no}:{normalized_block}",
            )
        )
        paragraphs.append(
            ParagraphRecord(
                id=paragraph_id,
                document_id=document_id,
                paragraph_order=order,
                paragraph_text=normalized_block,
                paragraph_no=paragraph_no,
                char_start=char_start,
                char_end=char_end,
                token_count=estimate_tokens(normalized_block),
            )
        )

    return paragraphs


def split_paragraph_blocks(cleaned_text: str) -> list[str]:
    blocks = [block.strip() for block in re.split(r"\n\s*\n", cleaned_text) if block.strip()]
    if blocks:
        return merge_wrapped_blocks(blocks)
    lines = [line.strip() for line in cleaned_text.splitlines() if line.strip()]
    return lines


def merge_wrapped_blocks(blocks: list[str]) -> list[str]:
    merged: list[str] = []
    current = blocks[0]

    for next_block in blocks[1:]:
        if should_merge_blocks(current, next_block):
            current = f"{current}\n{next_block}"
        else:
            merged.append(current)
            current = next_block

    merged.append(current)
    return merged


def should_merge_blocks(current: str, next_block: str) -> bool:
    current = current.strip()
    next_block = next_block.strip()
    if not current or not next_block:
        return False
    if is_heading_like(current) or is_heading_like(next_block):
        return False
    if re.match(r"^\[\d+\]", next_block):
        return False
    if re.match(r"^\d+[.)]\s+", next_block):
        return False
    if re.search(r"[.!?:;\"'\])]\s*$", current):
        return False
    if next_block[:1].islower():
        return True
    if len(current) < 120 and len(next_block) < 120:
        return True
    return False


def is_heading_like(block: str) -> bool:
    compact = " ".join(part.strip() for part in block.splitlines() if part.strip())
    if not compact:
        return False
    if len(compact) <= 80 and compact.isupper():
        return True
    return compact in {
        "Representation",
        "ORDER",
        "CATCHWORDS",
        "This appeal",
    }


def build_chunks(
    document_id: str,
    paragraphs: list[ParagraphRecord],
    config: PipelineConfig,
) -> list[ChunkRecord]:
    chunks: list[ChunkRecord] = []
    current_group: list[ParagraphRecord] = []

    def flush_group() -> None:
        if not current_group:
            return
        chunk_index = len(chunks)
        chunk_text = "\n\n".join(
            format_paragraph_for_chunk(paragraph) for paragraph in current_group
        )
        paragraph_numbers = [p.paragraph_no for p in current_group if p.paragraph_no is not None]
        paragraph_start_no = paragraph_numbers[0] if paragraph_numbers else None
        paragraph_end_no = paragraph_numbers[-1] if paragraph_numbers else None
        chunk_id = str(
            uuid5(
                NAMESPACE_URL,
                (
                    f"chunk:{document_id}:{chunk_index}:{paragraph_start_no}:"
                    f"{paragraph_end_no}:{chunk_text}"
                ),
            )
        )
        chunks.append(
            ChunkRecord(
                id=chunk_id,
                document_id=document_id,
                chunk_index=chunk_index,
                chunk_type="paragraph_group",
                chunk_text=chunk_text,
                paragraph_start_no=paragraph_start_no,
                paragraph_end_no=paragraph_end_no,
                heading_path=select_heading_path(current_group),
                token_count=estimate_tokens(chunk_text),
                paragraph_ids=[paragraph.id for paragraph in current_group],
                chunk_metadata={
                    "paragraph_orders": [paragraph.paragraph_order for paragraph in current_group],
                    "paragraph_count": len(current_group),
                },
            )
        )
        current_group.clear()

    for paragraph in paragraphs:
        if should_flush_before_append(current_group, paragraph, config):
            flush_group()
        current_group.append(paragraph)
        if should_flush_after_append(current_group, config):
            flush_group()

    flush_group()
    return chunks


def should_flush_before_append(
    current_group: list[ParagraphRecord],
    next_paragraph: ParagraphRecord,
    config: PipelineConfig,
) -> bool:
    if not current_group:
        return False
    current_chars = sum(len(item.paragraph_text) for item in current_group)
    if current_group[-1].heading_path != next_paragraph.heading_path and len(current_group) >= 2:
        return True
    return current_chars + len(next_paragraph.paragraph_text) > config.chunk_char_soft_limit


def should_flush_after_append(
    current_group: list[ParagraphRecord],
    config: PipelineConfig,
) -> bool:
    if not current_group:
        return False
    if len(current_group) >= config.chunk_paragraph_max:
        return True
    if len(current_group) >= config.chunk_paragraph_target:
        joined_length = sum(len(item.paragraph_text) for item in current_group)
        return joined_length >= config.chunk_char_soft_limit
    return len(current_group) == 1 and len(current_group[0].paragraph_text) >= 1800


def format_paragraph_for_chunk(paragraph: ParagraphRecord) -> str:
    if paragraph.paragraph_no is None:
        return paragraph.paragraph_text
    return f"[{paragraph.paragraph_no}] {paragraph.paragraph_text}"


def select_heading_path(paragraphs: list[ParagraphRecord]) -> str | None:
    for paragraph in paragraphs:
        if paragraph.heading_path:
            return paragraph.heading_path
    return None


def collect_warnings(
    cleaned_text: str,
    paragraphs: list[ParagraphRecord],
    chunks: list[ChunkRecord],
) -> list[str]:
    warnings: list[str] = []
    if not cleaned_text:
        warnings.append("抽取后的正文为空")
    if not paragraphs:
        warnings.append("未识别到段落")
    if paragraphs and any(not paragraph.paragraph_text for paragraph in paragraphs):
        warnings.append("存在空段落文本")
    if chunks and any(
        chunk.paragraph_start_no is not None
        and chunk.paragraph_end_no is not None
        and chunk.paragraph_start_no > chunk.paragraph_end_no
        for chunk in chunks
    ):
        warnings.append("存在非法 chunk 段落范围")
    return warnings


def estimate_tokens(text: str) -> int:
    return max(1, round(len(text.split()) * 1.3))


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def ensure_output_dirs(config: PipelineConfig) -> None:
    config.output_dir.mkdir(parents=True, exist_ok=True)
    config.normalized_dir.mkdir(parents=True, exist_ok=True)
    config.chunks_dir.mkdir(parents=True, exist_ok=True)


def write_document_artifacts(document: NormalizedDocument, config: PipelineConfig) -> None:
    normalized_path = config.normalized_dir / f"{document.id}.json"
    chunk_path = config.chunks_dir / f"{document.id}.json"
    normalized_path.write_text(
        json.dumps(document.to_dict(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    chunk_path.write_text(
        json.dumps(
            {
                "document_id": document.id,
                "title": document.title,
                "chunks": [asdict(chunk) for chunk in document.chunks],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    LOGGER.debug("Wrote artifacts for %s", document.source_path)
