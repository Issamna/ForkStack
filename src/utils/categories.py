"""Deterministic grocery-aisle categorization for shopping-list items.

Same philosophy as utils/ingredients.py: a curated keyword map beats a
guess. Phrases are checked before single words so "bell pepper" lands in
produce while bare "pepper" is a spice; the head noun (last token) wins for
single-word matches so "goat cheese" is dairy, not meat.
"""

from utils.ingredients import _singular, canonical_name

# Store-walk order; the frontend renders groups in this sequence.
CATEGORY_ORDER = [
    "produce", "meat", "dairy", "bakery", "pantry",
    "spices", "frozen", "beverages", "household", "other",
]

_HERBS = {
    "basil", "oregano", "thyme", "rosemary", "parsley", "dill", "sage",
    "mint", "tarragon", "chive", "cilantro", "marjoram",
}

# Multi-word matches, checked (longest first) before single tokens.
_PHRASES = {
    "bell pepper": "produce", "green onion": "produce",
    "sweet potato": "produce", "green bean": "produce",
    "tomato paste": "pantry", "tomato sauce": "pantry",
    "sun-dried tomato": "pantry",
    "peanut butter": "pantry", "almond butter": "pantry",
    "coconut milk": "pantry", "condensed milk": "pantry",
    "evaporated milk": "pantry",
    "olive oil": "pantry", "vegetable oil": "pantry", "canola oil": "pantry",
    "sesame oil": "pantry", "coconut oil": "pantry",
    "soy sauce": "pantry", "fish sauce": "pantry", "hot sauce": "pantry",
    "worcestershire sauce": "pantry", "oyster sauce": "pantry",
    "chicken broth": "pantry", "chicken stock": "pantry",
    "beef broth": "pantry", "beef stock": "pantry",
    "vegetable broth": "pantry", "vegetable stock": "pantry",
    "baking soda": "pantry", "baking powder": "pantry",
    "brown sugar": "pantry", "powdered sugar": "pantry",
    "maple syrup": "pantry", "corn syrup": "pantry",
    "sour cream": "dairy", "heavy cream": "dairy", "whipping cream": "dairy",
    "cream cheese": "dairy", "half and half": "dairy",
    "ice cream": "frozen",
    "black pepper": "spices", "white pepper": "spices",
    "garlic powder": "spices", "onion powder": "spices",
    "chili powder": "spices", "red pepper flake": "spices",
    "bay leaf": "spices",
}

_TOKENS = {
    # produce (fresh herbs assumed fresh; "dried X" is handled separately)
    **dict.fromkeys(
        [
            "onion", "tomato", "garlic", "potato", "carrot", "celery",
            "lettuce", "spinach", "kale", "arugula", "romaine", "cucumber",
            "zucchini", "squash", "broccoli", "cauliflower", "cabbage",
            "mushroom", "avocado", "lime", "lemon", "orange", "apple",
            "banana", "strawberry", "blueberry", "raspberry", "blackberry",
            "berry", "grape", "mango", "pineapple", "melon", "watermelon",
            "cantaloupe", "peach", "pear", "plum", "cherry", "apricot",
            "kiwi", "cilantro", "parsley", "basil", "mint", "rosemary",
            "thyme", "dill", "sage", "scallion", "shallot", "leek", "ginger",
            "jalapeno", "jalapeño", "serrano", "habanero", "poblano",
            "eggplant", "corn", "pea", "asparagus", "radish", "beet",
            "turnip", "fennel", "chard", "lemongrass", "coconut", "sprout",
        ],
        "produce",
    ),
    **dict.fromkeys(
        [
            "chicken", "beef", "pork", "lamb", "turkey", "bacon", "sausage",
            "ham", "steak", "brisket", "rib", "veal", "duck", "shrimp",
            "prawn", "salmon", "tuna", "cod", "tilapia", "halibut", "trout",
            "fish", "crab", "lobster", "scallop", "clam", "mussel",
            "anchovy", "sardine", "chorizo", "pepperoni", "prosciutto",
            "meat", "meatball",
        ],
        "meat",
    ),
    **dict.fromkeys(
        [
            "milk", "cheese", "cheddar", "mozzarella", "parmesan", "feta",
            "ricotta", "gouda", "brie", "swiss", "butter", "yogurt", "cream",
            "egg", "buttermilk", "mascarpone", "provolone", "ghee",
        ],
        "dairy",
    ),
    **dict.fromkeys(
        [
            "bread", "bun", "bagel", "tortilla", "pita", "baguette",
            "croissant", "muffin", "naan", "flatbread",
        ],
        "bakery",
    ),
    **dict.fromkeys(
        [
            "pasta", "spaghetti", "penne", "macaroni", "noodle", "rice",
            "flour", "sugar", "oil", "vinegar", "bean", "lentil", "chickpea",
            "quinoa", "oat", "oatmeal", "cereal", "sauce", "salsa", "broth",
            "stock", "honey", "syrup", "jam", "jelly", "peanut", "almond",
            "walnut", "pecan", "cashew", "pistachio", "nut", "chocolate",
            "cocoa", "vanilla", "yeast", "cornstarch", "breadcrumb",
            "ketchup", "mustard", "mayonnaise", "mayo", "olive", "caper",
            "raisin", "cracker", "tahini", "miso", "couscous", "barley",
            "polenta",
        ],
        "pantry",
    ),
    **dict.fromkeys(
        [
            "salt", "pepper", "paprika", "cumin", "oregano", "cinnamon",
            "nutmeg", "turmeric", "coriander", "cayenne", "curry",
            "allspice", "cardamom", "seasoning", "spice", "saffron", "chili",
        ],
        "spices",
    ),
    "frozen": "frozen",
    **dict.fromkeys(
        ["water", "juice", "soda", "coffee", "tea", "wine", "beer",
         "lemonade"],
        "beverages",
    ),
    **dict.fromkeys(
        [
            "towel", "soap", "detergent", "sponge", "foil", "parchment",
            "napkin", "tissue", "bleach", "cleaner",
        ],
        "household",
    ),
}

_PHRASES_BY_LENGTH = sorted(_PHRASES, key=len, reverse=True)


def categorize(name) -> str:
    c = canonical_name(name)
    if not c:
        return "other"

    # "dried basil" is a spice, "dried apricots" live in the pantry.
    if c.startswith("dried "):
        rest = c.split()[1:]
        return "spices" if rest and _singular(rest[-1]) in _HERBS else "pantry"

    # Container/state overrides win over the produce head noun: "canned
    # tomatoes" is pantry (not produce), "frozen corn" is frozen (not produce).
    tokens = [_singular(t) for t in c.split()]
    if "frozen" in tokens:
        return "frozen"
    if any(t in {"can", "canned", "jar", "jarred"} for t in tokens):
        return "pantry"

    for phrase in _PHRASES_BY_LENGTH:
        if phrase in c:
            return _PHRASES[phrase]

    for tok in reversed(tokens):  # head noun last: "goat cheese" -> dairy
        if tok in _TOKENS:
            return _TOKENS[tok]
    return "other"
