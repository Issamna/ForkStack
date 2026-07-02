"""Deterministic ingredient canonicalization for shopping-list pooling.

Recipes keep their original ingredient text; these rules run when the
shopping list is generated, so "medium onion (diced)" and "onion, chopped"
pool onto one line. Rules are deliberately conservative: a missed merge just
shows two lines, but a false merge corrupts the count.
"""

import re

from utils.quantity import normalize_name

# Words that describe preparation/amount-hedging, never the ingredient itself.
# Used to drop whole comma-segments like ", finely chopped" or ", to taste".
_PREP_WORDS = {
    "chopped", "diced", "minced", "sliced", "grated", "shredded", "crushed",
    "peeled", "seeded", "cored", "trimmed", "halved", "quartered", "cubed",
    "julienned", "beaten", "melted", "softened", "drained", "rinsed",
    "divided", "packed", "sifted", "thawed", "zested", "juiced", "torn",
    "stemmed", "deveined", "pitted", "mashed", "crumbled", "toasted",
    "finely", "thinly", "roughly", "coarsely", "freshly", "lightly",
    "optional", "plus", "more", "extra", "taste", "to", "for", "serving",
    "garnish", "needed", "as", "at", "room", "temperature", "or", "and",
    "cut", "into", "pieces", "chunks", "wedges", "strips", "cubes", "rings",
    "small", "medium", "large", "jumbo",
}

# Leading words safe to drop: prep participles and size adjectives ("medium
# onion" -> "onion"). Kept narrow — words like "ground", "whole", "fresh" and
# "dried" change what you buy, so they stay.
_LEADING_STRIP = {
    "chopped", "diced", "minced", "sliced", "grated", "shredded", "crushed",
    "peeled", "cubed", "julienned", "melted", "softened", "crumbled",
    "finely", "thinly", "roughly", "coarsely", "freshly", "lightly",
    "small", "medium", "large", "jumbo", "extra-large",
}

_TRAILING_PHRASES = re.compile(
    r"\b(?:to taste|for garnish|for serving|as needed|if needed"
    r"|plus more\b.*|or more\b.*)\s*$"
)

_NO_SINGULAR = {"molasses", "hummus", "couscous", "asparagus", "swiss"}

_UNIT_ALIASES = {
    "teaspoon": "tsp", "teaspoons": "tsp", "tsp": "tsp",
    "tablespoon": "tbsp", "tablespoons": "tbsp", "tbsp": "tbsp", "tbs": "tbsp",
    "cup": "cup", "cups": "cup",
    "ounce": "oz", "ounces": "oz", "oz": "oz",
    "pound": "lb", "pounds": "lb", "lb": "lb", "lbs": "lb",
    "gram": "g", "grams": "g",
    "kilogram": "kg", "kilograms": "kg",
    "milliliter": "ml", "milliliters": "ml",
    "liter": "l", "liters": "l", "litre": "l", "litres": "l",
    "quart": "quart", "quarts": "quart",
    "pint": "pint", "pints": "pint",
    "gallon": "gallon", "gallons": "gallon",
    "clove": "clove", "cloves": "clove",
    "can": "can", "cans": "can",
    "package": "package", "packages": "package", "pkg": "package",
    "slice": "slice", "slices": "slice",
    "stick": "stick", "sticks": "stick",
    "pinch": "pinch", "pinches": "pinch",
    "dash": "dash", "dashes": "dash",
    "sprig": "sprig", "sprigs": "sprig",
    "stalk": "stalk", "stalks": "stalk",
    "head": "head", "heads": "head",
    "bunch": "bunch", "bunches": "bunch",
    "piece": "piece", "pieces": "piece",
    "handful": "handful", "handfuls": "handful",
}


def _singular(word: str) -> str:
    if word in _NO_SINGULAR or len(word) <= 3:
        return word
    if word.endswith("ies"):
        return word[:-3] + "y"
    if word.endswith(("oes", "ches", "shes", "sses", "xes", "zes")):
        return word[:-2]
    if word.endswith("s") and not word.endswith(("ss", "us", "is")):
        return word[:-1]
    return word


def clean_name(name) -> str:
    """Human-readable name with prep noise stripped (plural kept for display)."""
    s = normalize_name(name)
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"\s+", " ", s).strip(" .,")
    s = _TRAILING_PHRASES.sub("", s).strip(" .,")

    segments = [seg.strip() for seg in s.split(",")]
    kept = [
        seg
        for seg in segments
        if seg and not all(w in _PREP_WORDS for w in seg.split())
    ]
    if kept:
        s = ", ".join(kept)

    words = s.split()
    while len(words) > 1 and words[0] in _LEADING_STRIP:
        words.pop(0)
    s = " ".join(words).strip(" .,-")
    return s or normalize_name(name)


def canonical_name(name) -> str:
    """Matching key: cleaned name with the last word singularized."""
    words = clean_name(name).split()
    if not words:
        return ""
    words[-1] = _singular(words[-1])
    return " ".join(words)


def canonical_unit(unit) -> str:
    u = normalize_name(unit).rstrip(".")
    return _UNIT_ALIASES.get(u, u)


def item_key(name, unit) -> str:
    return f"{canonical_name(name)}|{canonical_unit(unit)}"
