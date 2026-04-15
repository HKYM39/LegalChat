from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(slots=True)
class PipelineConfig:
    root_dir: Path
    source_dir: Path
    output_dir: Path
    normalized_dir: Path
    chunks_dir: Path
    database_url: str | None
    fail_fast: bool
    skip_db: bool
    limit: int | None
    verbose: bool
    chunk_paragraph_target: int = 3
    chunk_paragraph_max: int = 5
    chunk_char_soft_limit: int = 3500


def build_config(
    *,
    root_dir: Path,
    source_dir: Path | None = None,
    output_dir: Path | None = None,
    database_url: str | None = None,
    fail_fast: bool = False,
    skip_db: bool = False,
    limit: int | None = None,
    verbose: bool = False,
) -> PipelineConfig:
    resolved_root = root_dir.resolve()
    resolved_source = (source_dir or resolved_root / "Data" / "Source").resolve()
    resolved_output = (output_dir or resolved_root / "tools" / "output").resolve()
    normalized_dir = resolved_output / "normalized"
    chunks_dir = resolved_output / "chunks"

    return PipelineConfig(
        root_dir=resolved_root,
        source_dir=resolved_source,
        output_dir=resolved_output,
        normalized_dir=normalized_dir,
        chunks_dir=chunks_dir,
        database_url=database_url or os.environ.get("DATABASE_URL"),
        fail_fast=fail_fast,
        skip_db=skip_db,
        limit=limit,
        verbose=verbose,
    )
