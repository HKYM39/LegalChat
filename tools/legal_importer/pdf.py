from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

FILENAME_RE = re.compile(
    r"^(?P<title>.+?)\s+(?P<citation>\[\d{4}\]\s+[A-Z]{2,}\s+\d+)\s+\((?P<date>[^)]+)\)$"
)


@dataclass(slots=True)
class PdfFilenameMetadata:
    title: str | None
    neutral_citation: str | None
    decision_date_text: str | None


def extract_pdf_text(pdf_path: Path) -> str:
    try:
        return extract_pdf_text_with_pymupdf(pdf_path)
    except ModuleNotFoundError:
        pass
    except Exception:
        pass

    try:
        from pypdf import PdfReader
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Missing PDF dependencies. Install with: pip install -r tools/requirements.txt"
        ) from exc

    reader = PdfReader(str(pdf_path))
    page_texts: list[str] = []
    for page_index, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text(extraction_mode="layout") or ""
        cleaned_page = page_text.replace("\x00", "").strip()
        if cleaned_page:
            page_texts.append(cleaned_page)
        else:
            page_texts.append(f"[EMPTY_PAGE_{page_index}]")
    return "\n\n".join(page_texts).strip()


def extract_pdf_text_with_pymupdf(pdf_path: Path) -> str:
    import fitz

    metadata = parse_filename_metadata(pdf_path)
    document = fitz.open(pdf_path)
    page_texts = [
        extract_page_text_with_pymupdf_words(page, metadata)
        for page in document
    ]
    return "\n\n".join(text for text in page_texts if text).strip()


def extract_page_text_with_pymupdf_words(page, metadata: PdfFilenameMetadata) -> str:
    lines_by_key: dict[tuple[int, int], list[tuple[int, str]]] = defaultdict(list)
    for _, _, _, _, word, block_no, line_no, word_no in page.get_text("words", sort=True):
        sanitized_word = sanitize_word(word)
        if not sanitized_word:
            continue
        lines_by_key[(block_no, line_no)].append((word_no, sanitized_word))

    block_lines: dict[int, list[str]] = defaultdict(list)
    for (block_no, _line_no) in sorted(lines_by_key):
        line = " ".join(word for _, word in sorted(lines_by_key[(block_no, _line_no)]))
        line = repair_line(line, metadata)
        if line:
            block_lines[block_no].append(line)

    rendered_blocks: list[str] = []
    for block_no in sorted(block_lines):
        block_text = "\n".join(block_lines[block_no]).strip()
        if block_text:
            rendered_blocks.append(block_text)

    return "\n\n".join(rendered_blocks).strip()


def sanitize_word(word: str) -> str:
    cleaned = "".join(char for char in word if char.isprintable())
    cleaned = cleaned.replace("\x00", "").strip()
    return cleaned


def repair_line(line: str, metadata: PdfFilenameMetadata) -> str:
    normalized = re.sub(r"[ \t]+", " ", line).strip()
    if not normalized:
        return ""

    if metadata.title and metadata.neutral_citation and metadata.decision_date_text:
        title = re.escape(metadata.title)
        if re.fullmatch(rf"{title}\s+\[\s*\]\s+[A-Z]{{2,}}\s+\(\s*[A-Za-z]+\s*\)", normalized):
            return f"{metadata.title} {metadata.neutral_citation} ({metadata.decision_date_text})"
        if re.fullmatch(r"\[\s*\]\s+[A-Z]{2,}", normalized):
            return metadata.neutral_citation
        if normalized.startswith("Date of Judgment:"):
            return f"Date of Judgment: {metadata.decision_date_text}"
        if normalized.startswith("Last Updated:"):
            return f"Last Updated: {metadata.decision_date_text}"

    normalized = re.sub(r"\[\s+\]", "[]", normalized)
    normalized = re.sub(r"\(\s+", "(", normalized)
    normalized = re.sub(r"\s+\)", ")", normalized)
    normalized = re.sub(r"\s+([,.;:?!])", r"\1", normalized)
    return normalized


def parse_filename_metadata(pdf_path: Path) -> PdfFilenameMetadata:
    match = FILENAME_RE.match(pdf_path.stem)
    if not match:
        return PdfFilenameMetadata(
            title=pdf_path.stem,
            neutral_citation=None,
            decision_date_text=None,
        )
    return PdfFilenameMetadata(
        title=match.group("title").strip(),
        neutral_citation=match.group("citation").strip(),
        decision_date_text=match.group("date").strip(),
    )
