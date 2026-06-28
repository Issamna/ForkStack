import re
from typing import Optional

_UNICODE_FRACTIONS = {
    "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3,
    "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8, "⅙": 1 / 6,
    "⅚": 5 / 6, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
}


def parse_quantity(text) -> Optional[float]:
    """Parse a quantity string to a float.

    Handles ints, decimals, fractions, mixed numbers, unicode fractions, and
    ranges (uses the upper bound so we don't under-buy). Returns None when no
    number is present (e.g. "to taste").
    """
    if text is None:
        return None
    s = str(text).strip().lower()
    if not s:
        return None

    parts = re.split(r"\s*(?:-|–|—|to)\s*", s)
    if len(parts) > 1:
        vals = [v for v in (parse_quantity(p) for p in parts) if v is not None]
        return max(vals) if vals else None

    total = 0.0
    found = False
    for sym, val in _UNICODE_FRACTIONS.items():
        if sym in s:
            total += val * s.count(sym)
            found = True
            s = s.replace(sym, " ")

    for tok in s.split():
        frac = re.fullmatch(r"(\d+)/(\d+)", tok)
        if frac and int(frac.group(2)):
            total += int(frac.group(1)) / int(frac.group(2))
            found = True
            continue
        if re.fullmatch(r"\d+(?:\.\d+)?", tok):
            total += float(tok)
            found = True

    return total if found else None


def parse_servings(text) -> Optional[int]:
    """Pull a serving count out of a string like "4 servings" or "Serves 6"."""
    if text is None:
        return None
    if isinstance(text, (int, float)):
        return int(text) or None
    m = re.search(r"\d+", str(text))
    return int(m.group()) if m else None


def format_quantity(val: Optional[float]) -> str:
    if val is None:
        return ""
    r = round(val, 2)
    if abs(r - round(r)) < 1e-9:
        return str(int(round(r)))
    return f"{r:g}"


def normalize_name(name) -> str:
    return re.sub(r"\s+", " ", str(name).strip().lower()).strip(" .,")
