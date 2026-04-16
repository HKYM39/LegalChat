from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from tools.legal_importer.config import build_config
from tools.legal_importer.models import NormalizedDocument
from tools.legal_importer.pipeline import (
    discover_pdfs,
    ensure_output_dirs,
    normalize_document,
    write_document_artifacts,
)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    config = build_config(
        root_dir=Path(__file__).resolve().parents[2],
        source_dir=Path(args.source_dir) if args.source_dir else None,
        output_dir=Path(args.output_dir) if args.output_dir else None,
        fail_fast=args.fail_fast,
        limit=args.limit,
        verbose=args.verbose,
    )
    configure_logging(config.verbose)
    ensure_output_dirs(config)

    pdf_paths = discover_pdfs(config.source_dir, config.limit)
    if not pdf_paths:
        logging.error("No PDF files found under %s", config.source_dir)
        return 1

    processed = 0
    failures = 0
    for pdf_path in pdf_paths:
        try:
            document = normalize_document(pdf_path, config)
            validate_document(document)
            write_document_artifacts(document, config)
            processed += 1
            logging.info(
                "Normalized %s with %s paragraphs",
                document.source_path,
                len(document.paragraphs),
            )
            for warning in document.warnings:
                logging.warning("%s: %s", document.source_path, warning)
        except Exception as exc:  # noqa: BLE001
            failures += 1
            logging.exception("Failed to process %s: %s", pdf_path, exc)
            if config.fail_fast:
                return 1

    logging.info("Finished run: processed=%s failures=%s", processed, failures)
    return 0 if failures == 0 else 1


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Offline legal PDF normalization pipeline.",
    )
    parser.add_argument("--source-dir", help="PDF source directory")
    parser.add_argument("--output-dir", help="Artifact output directory")
    parser.add_argument("--fail-fast", action="store_true", help="Stop on first failure")
    parser.add_argument("--limit", type=int, help="Process only the first N PDF files")
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging")
    return parser.parse_args(argv)


def configure_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(levelname)s %(message)s",
        stream=sys.stdout,
    )


def validate_document(document: NormalizedDocument) -> None:
    if not document.title:
        raise ValueError("Missing title")
    if not document.full_text:
        raise ValueError("Missing full_text")
    if not document.paragraphs:
        raise ValueError("No paragraphs extracted")
