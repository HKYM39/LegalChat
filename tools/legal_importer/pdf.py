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


@dataclass(slots=True)
class PageLine:
    text: str
    y0: float
    y1: float


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
    pages = [extract_page_lines_with_pymupdf_words(page, metadata) for page in document]
    repeated_margin_lines = detect_repeated_margin_lines(pages)
    page_texts = [
        render_page_lines(page_index, lines, metadata, repeated_margin_lines)
        for page_index, lines in enumerate(pages)
    ]
    return "\n\n".join(text for text in page_texts if text).strip()


def extract_page_lines_with_pymupdf_words(page, metadata: PdfFilenameMetadata) -> list[PageLine]:
    lines_by_key: dict[tuple[int, int], list[tuple[int, str]]] = defaultdict(list)
    line_boxes: dict[tuple[int, int], list[tuple[float, float]]] = defaultdict(list)
    for _, y0, _, y1, word, block_no, line_no, word_no in page.get_text("words", sort=True):
        sanitized_word = sanitize_word(word)
        if not sanitized_word:
            continue
        lines_by_key[(block_no, line_no)].append((word_no, sanitized_word))
        line_boxes[(block_no, line_no)].append((y0, y1))

    page_lines: list[PageLine] = []
    for (block_no, _line_no) in sorted(lines_by_key):
        line = " ".join(word for _, word in sorted(lines_by_key[(block_no, _line_no)]))
        line = repair_line(line, metadata)
        if line:
            y_positions = line_boxes[(block_no, _line_no)]
            page_lines.append(
                PageLine(
                    text=line,
                    y0=min(y0 for y0, _ in y_positions),
                    y1=max(y1 for _, y1 in y_positions),
                )
            )

    return page_lines


def detect_repeated_margin_lines(pages: list[list[PageLine]]) -> set[str]:
    repeated_lines: defaultdict[str, set[int]] = defaultdict(set)
    for page_index, lines in enumerate(pages):
        if not lines:
            continue
        page_height = max(line.y1 for line in lines)
        for line in lines:
            if is_margin_line(line, page_height):
                repeated_lines[normalize_margin_text(line.text)].add(page_index)

    return {
        line_text
        for line_text, page_indexes in repeated_lines.items()
        if len(page_indexes) >= 2
    }


def render_page_lines(
    page_index: int,
    lines: list[PageLine],
    metadata: PdfFilenameMetadata,
    repeated_margin_lines: set[str],
) -> str:
    if not lines:
        return ""

    page_height = max(line.y1 for line in lines)
    filtered_lines = [
        line
        for line in lines
        if not should_drop_page_line(line, page_height, repeated_margin_lines)
    ]

    if page_index == 0:
        filtered_lines = trim_first_page_source_banner(filtered_lines, metadata)

    block_lines: list[str] = []
    current_block: list[str] = []
    previous_line: PageLine | None = None
    for line in filtered_lines:
        if previous_line is not None and line.y0 - previous_line.y1 > 16:
            if current_block:
                block_lines.append("\n".join(current_block))
                current_block = []
        current_block.append(line.text)
        previous_line = line

    if current_block:
        block_lines.append("\n".join(current_block))

    return "\n\n".join(block.strip() for block in block_lines if block.strip()).strip()


def should_drop_page_line(
    line: PageLine,
    page_height: float,
    repeated_margin_lines: set[str],
) -> bool:
    normalized = normalize_margin_text(line.text)
    if is_known_noise_line(normalized):
        return True
    if is_margin_line(line, page_height) and normalized in repeated_margin_lines:
        return True
    return False


def is_margin_line(line: PageLine, page_height: float) -> bool:
    return line.y0 <= 20 or line.y1 >= page_height - 20


def normalize_margin_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def is_known_noise_line(text: str) -> bool:
    if not text:
        return False
    if text == "AustLII":
        return True
    if text.startswith("https://www.austlii.edu.au/cgi-bin/viewdoc/"):
        return True
    if re.fullmatch(r"第\s*\d+\s*页\s*共\s*\d+\s*页", text):
        return True
    if re.fullmatch(r"\d{4}/\d{1,2}/\d{1,2}\s+\d{1,2}:\d{2}", text):
        return True
    return False


def trim_first_page_source_banner(
    lines: list[PageLine],
    metadata: PdfFilenameMetadata,
) -> list[PageLine]:
    trimmed_index = 0
    while trimmed_index < len(lines):
        line = lines[trimmed_index]
        if line.y1 > 120:
            break
        if not is_first_page_banner_line(line.text, metadata):
            break
        trimmed_index += 1
    return lines[trimmed_index:]


def is_first_page_banner_line(text: str, metadata: PdfFilenameMetadata) -> bool:
    normalized = normalize_margin_text(text)
    if not normalized:
        return False
    if normalized == "AustLII":
        return True
    if normalized.startswith("Last Updated:"):
        return True
    if metadata.title and normalized == metadata.title:
        return True
    if metadata.title and metadata.neutral_citation and metadata.decision_date_text:
        rendered_title = (
            f"{metadata.title} {metadata.neutral_citation} ({metadata.decision_date_text})"
        )
        if normalized == rendered_title:
            return True
    if normalized in {
        "High Court of Australia",
        "Supreme Court of Australia",
        "Federal Court of Australia",
    }:
        return True
    return False


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
