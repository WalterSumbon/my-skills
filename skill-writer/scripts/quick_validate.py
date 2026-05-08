#!/usr/bin/env python3
"""Validate a Codex skill folder.

The validator intentionally uses only the Python standard library so it can run
in minimal environments.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence


NAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]$")
ALLOWED_FRONTMATTER_KEYS = {"name", "description"}


@dataclass(frozen=True)
class ValidationResult:
    """Validation output for one skill folder.

    Attributes:
        errors: Fatal validation failures.
        warnings: Non-fatal quality warnings.
    """

    errors: list[str]
    warnings: list[str]

    @property
    def is_valid(self) -> bool:
        """Return whether the skill passed validation."""

        return not self.errors


def parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    """Parse simple YAML frontmatter from a skill file.

    Args:
        text: Full SKILL.md content.

    Returns:
        A tuple of parsed frontmatter values and Markdown body content.

    Raises:
        ValueError: If frontmatter is missing, malformed, or unsupported.
    """

    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError("SKILL.md must start with YAML frontmatter delimiter '---'.")

    closing_index = None
    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            closing_index = index
            break

    if closing_index is None:
        raise ValueError("SKILL.md frontmatter must end with delimiter '---'.")

    frontmatter: dict[str, str] = {}
    for line_number, raw_line in enumerate(lines[1:closing_index], start=2):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            raise ValueError(
                f"Frontmatter line {line_number} must be a 'key: value' pair."
            )

        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            raise ValueError(f"Frontmatter line {line_number} has an empty key.")
        if key in frontmatter:
            raise ValueError(f"Frontmatter key '{key}' is duplicated.")
        frontmatter[key] = _strip_yaml_quotes(value)

    body = "\n".join(lines[closing_index + 1 :]).strip()
    return frontmatter, body


def validate_skill(skill_path: Path) -> ValidationResult:
    """Validate a skill folder.

    Args:
        skill_path: Path to a skill directory.

    Returns:
        Validation result with errors and warnings.
    """

    errors: list[str] = []
    warnings: list[str] = []

    if not skill_path.exists():
        return ValidationResult([f"Skill path does not exist: {skill_path}"], warnings)
    if not skill_path.is_dir():
        return ValidationResult([f"Skill path must be a directory: {skill_path}"], warnings)

    skill_file = skill_path / "SKILL.md"
    if not skill_file.is_file():
        return ValidationResult([f"Missing required file: {skill_file}"], warnings)

    try:
        frontmatter, body = parse_frontmatter(skill_file.read_text(encoding="utf-8"))
    except UnicodeDecodeError:
        return ValidationResult(["SKILL.md must be valid UTF-8."], warnings)
    except ValueError as exc:
        return ValidationResult([str(exc)], warnings)

    errors.extend(_validate_frontmatter(frontmatter, skill_path.name))
    if not body:
        errors.append("SKILL.md body must not be empty.")

    description = frontmatter.get("description", "")
    if description and not _looks_like_trigger_description(description):
        warnings.append(
            "Description should describe both capability and when to use the skill."
        )

    return ValidationResult(errors, warnings)


def _validate_frontmatter(frontmatter: dict[str, str], folder_name: str) -> list[str]:
    """Validate required frontmatter fields and naming rules."""

    errors: list[str] = []
    keys = set(frontmatter)
    missing_keys = ALLOWED_FRONTMATTER_KEYS - keys
    extra_keys = keys - ALLOWED_FRONTMATTER_KEYS

    for key in sorted(missing_keys):
        errors.append(f"Missing required frontmatter field: {key}")
    for key in sorted(extra_keys):
        errors.append(f"Unsupported frontmatter field: {key}")

    name = frontmatter.get("name", "")
    description = frontmatter.get("description", "")

    if not name:
        errors.append("Frontmatter field 'name' must not be empty.")
    elif not NAME_PATTERN.fullmatch(name):
        errors.append(
            "Skill name must use lowercase letters, digits, and hyphens; "
            "start and end with a letter or digit; and be 64 characters or fewer."
        )
    elif name != folder_name:
        errors.append(
            f"Skill name '{name}' must match folder name '{folder_name}'."
        )

    if not description:
        errors.append("Frontmatter field 'description' must not be empty.")

    return errors


def _strip_yaml_quotes(value: str) -> str:
    """Strip one layer of simple YAML quotes."""

    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


def _looks_like_trigger_description(description: str) -> bool:
    """Heuristically check that description mentions a trigger context."""

    lowered = description.lower()
    trigger_markers = (
        "use when",
        "when ",
        "用于",
        "适用于",
        "当",
        "场景",
        "请求",
        "任务",
    )
    return any(marker in lowered for marker in trigger_markers)


def build_parser() -> argparse.ArgumentParser:
    """Build the command-line parser."""

    parser = argparse.ArgumentParser(
        description="Validate a Codex skill folder containing SKILL.md."
    )
    parser.add_argument("skill_path", type=Path, help="Path to the skill folder.")
    parser.add_argument(
        "--strict-warnings",
        action="store_true",
        help="Treat warnings as validation failures.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Run the validator CLI."""

    args = build_parser().parse_args(argv)
    result = validate_skill(args.skill_path)

    for warning in result.warnings:
        print(f"WARNING: {warning}", file=sys.stderr)
    for error in result.errors:
        print(f"ERROR: {error}", file=sys.stderr)

    if result.errors or (args.strict_warnings and result.warnings):
        print("Skill is invalid.", file=sys.stderr)
        return 1

    print("Skill is valid!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
