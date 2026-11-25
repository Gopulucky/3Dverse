"""The brand name contains an ampersand, which ReportLab's Paragraph parses as markup.

Passing it raw renders "buy&sell3d;" (stray semicolon) on every receipt, so the title must be
escaped before it reaches a Paragraph.
"""
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph

from app.core.invoice import INVOICE_TITLE


def test_invoice_title_renders_the_brand_name_exactly():
    paragraph = Paragraph(INVOICE_TITLE, getSampleStyleSheet()["Heading1"])
    paragraph.wrap(400, 100)
    assert paragraph.getPlainText() == "buy&sell3d Order Receipt"
