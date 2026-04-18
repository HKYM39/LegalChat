from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(slots=True)
class PipelineConfig:
    root_dir: Path
    source_dir: Path
    output_dir: Path
    normalized_dir: Path
    review_json_dir: Path
    fail_fast: bool
    limit: int | None
    verbose: bool


def build_config(
    *,
    root_dir: Path,
    source_dir: Path | None = None,
    output_dir: Path | None = None,
    fail_fast: bool = False,
    limit: int | None = None,
    verbose: bool = False,
) -> PipelineConfig:
    resolved_root = root_dir.resolve()
    resolved_source = (source_dir or resolved_root / "Data" / "Source").resolve()
    resolved_output = (output_dir or resolved_root / "tools" / "output").resolve()
    normalized_dir = resolved_output / "normalized"
    review_json_dir = resolved_root / "Data" / "JSON"

    return PipelineConfig(
        root_dir=resolved_root,
        source_dir=resolved_source,
        output_dir=resolved_output,
        normalized_dir=normalized_dir,
        review_json_dir=review_json_dir,
        fail_fast=fail_fast,
        limit=limit,
        verbose=verbose,
    )
