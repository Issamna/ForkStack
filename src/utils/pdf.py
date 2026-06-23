import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)

_INK = colors.HexColor("#3f3f46")


def _esc(value) -> str:
    """Escape for reportlab's XML-ish paragraph markup."""
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def build_recipe_pdf(recipe: dict) -> bytes:
    """Render a recipe dict to PDF bytes (title, tags, source, ingredients,
    numbered instructions)."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        title=str(recipe.get("title") or "Recipe"),
        leftMargin=0.9 * inch,
        rightMargin=0.9 * inch,
        topMargin=0.9 * inch,
        bottomMargin=0.9 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "RecipeTitle", parent=styles["Title"], fontSize=22, spaceAfter=4,
        alignment=0, textColor=_INK,
    )
    section = ParagraphStyle(
        "Section", parent=styles["Heading2"], fontSize=14, spaceBefore=16,
        spaceAfter=6, textColor=_INK,
    )
    body = styles["BodyText"]
    small = ParagraphStyle("Small", parent=body, fontSize=9, textColor=colors.grey)

    story = [Paragraph(_esc(recipe.get("title") or "Recipe"), title_style)]

    tags = recipe.get("recipe_tags") or []
    if tags:
        story.append(Paragraph(" · ".join(_esc(t) for t in tags), small))

    source = recipe.get("import_source_url")
    if source:
        story.append(
            Paragraph(
                f'Source: <a href="{_esc(source)}" color="grey">{_esc(source)}</a>',
                small,
            )
        )

    story.append(Spacer(1, 10))

    ingredients = recipe.get("ingredients") or []
    if ingredients:
        story.append(Paragraph("Ingredients", section))
        items = []
        for ing in ingredients:
            parts = [
                str(ing.get("quantity", "")).strip(),
                str(ing.get("measurement_type", "")).strip(),
                str(ing.get("name", "")).strip(),
            ]
            line = " ".join(p for p in parts if p)
            if line:
                items.append(ListItem(Paragraph(_esc(line), body), leftIndent=10))
        if items:
            story.append(ListFlowable(items, bulletType="bullet", start="•"))

    steps = recipe.get("instructions") or []
    if steps:
        story.append(Paragraph("Instructions", section))
        ordered = sorted(steps, key=lambda s: s.get("step_number", 0))
        items = [
            ListItem(Paragraph(_esc(s.get("text", "")), body), leftIndent=10)
            for s in ordered
            if str(s.get("text", "")).strip()
        ]
        if items:
            story.append(ListFlowable(items, bulletType="1"))

    doc.build(story)
    return buf.getvalue()
