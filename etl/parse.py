"""Small, strict parsers for GCAT text fields.

The staging tables are all ``text`` on purpose. These helpers are the only place
where a raw string becomes a number, so the rules are easy to audit.
"""

from __future__ import annotations

import re

NULLS = {"", "-", "*", "?"}
NUMERIC = re.compile(r"^-?\d+(?:\.\d+)?$")


def clean(value: str | None) -> str | None:
    """Trim a text field and normalise GCAT's null markers to ``None``."""
    if value is None:
        return None
    text = value.strip()
    return None if text in NULLS else text


def parse_float(value: str | None) -> float | None:
    """Parse a decimal value, returning ``None`` for blanks and null markers."""
    text = clean(value)
    if text is None:
        return None
    text = text.replace(",", "")
    if not NUMERIC.fullmatch(text):
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_int(value: str | None) -> int | None:
    number = parse_float(value)
    return None if number is None else int(number)


def parse_flag(value: str | None) -> str | None:
    """Keep the uncertainty marker next to the number it qualifies."""
    if value is None:
        return None
    text = value.strip()
    return text or None


def is_numeric(value: str | None) -> bool:
    text = clean(value)
    return bool(text and re.fullmatch(r"\d+", text))


def cospar_piece(value: str | None) -> str | None:
    """Return a piece identifier only when it looks like COSPAR.

    GCAT's ``Piece`` column usually looks like ``1969-059C`` but sometimes holds
    a free-form label. Only the structured form is stored as a COSPAR alias.
    """
    text = clean(value)
    if text is None:
        return None
    return text if re.fullmatch(r"\d{4}-\d{3}[A-Z0-9]{0,3}", text) else None
