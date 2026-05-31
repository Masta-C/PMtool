"""
PMtool Operator Quick Reference Card
Single-page A4 PDF — print & laminate
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

# ── Brand colours ────────────────────────────────────────────────────────────
NAVY    = HexColor("#1C2235")
INDIGO  = HexColor("#4361EE")
GREEN   = HexColor("#22C55E")
AMBER   = HexColor("#F59E0B")
RED     = HexColor("#EF4444")
BG      = HexColor("#EEF0F7")
WHITE   = colors.white
DARK    = HexColor("#1C2235")
MID     = HexColor("#6B7280")

# ── Page geometry ─────────────────────────────────────────────────────────────
W, H = A4          # 595 x 842 pt
MARGIN = 22        # pt
GUTTER = 10        # pt between columns

HEADER_H = 62
FOOTER_H = 46
CONTENT_TOP    = H - HEADER_H - 14
CONTENT_BOTTOM = FOOTER_H + 14
CONTENT_H = CONTENT_TOP - CONTENT_BOTTOM

LEFT_W  = (W - 2 * MARGIN - GUTTER) * 0.60
RIGHT_W = (W - 2 * MARGIN - GUTTER) * 0.40

LEFT_X  = MARGIN
RIGHT_X = MARGIN + LEFT_W + GUTTER

OUTPUT = "/Users/chetanpatil/Desktop/PMtool_Operator_QuickRef.pdf"


def hex_to_rgb_01(h):
    c = HexColor(h)
    return c.red, c.green, c.blue


def draw_rounded_rect(c, x, y, w, h, r, fill_color, stroke_color=None):
    """Draw a filled rounded rectangle."""
    c.setFillColor(fill_color)
    if stroke_color:
        c.setStrokeColor(stroke_color)
        c.setLineWidth(0.5)
    else:
        c.setStrokeColor(fill_color)
        c.setLineWidth(0)
    c.roundRect(x, y, w, h, r, fill=1, stroke=1 if stroke_color else 0)


def draw_pill(cv, text, x, y, font_size=8.5):
    """Draw an indigo pill badge with white text."""
    cv.setFont("Helvetica", font_size)
    tw = cv.stringWidth(text, "Helvetica", font_size)
    pad_x, pad_y = 9, 4
    pw = tw + 2 * pad_x
    ph = font_size + 2 * pad_y
    draw_rounded_rect(cv, x, y - ph + pad_y, pw, ph, ph / 2, INDIGO)
    cv.setFillColor(WHITE)
    cv.drawString(x + pad_x, y - ph + pad_y + pad_y - 1, text)
    return pw


def generate():
    cv = canvas.Canvas(OUTPUT, pagesize=A4)
    cv.setTitle("PMtool Operator Quick Reference")
    cv.setAuthor("PMtool Production Management Platform")

    # ── Background ────────────────────────────────────────────────────────────
    cv.setFillColor(BG)
    cv.rect(0, 0, W, H, fill=1, stroke=0)

    # ── Header bar ───────────────────────────────────────────────────────────
    cv.setFillColor(NAVY)
    cv.rect(0, H - HEADER_H, W, HEADER_H, fill=1, stroke=0)

    # Logo text
    cv.setFillColor(WHITE)
    cv.setFont("Helvetica-Bold", 28)
    cv.drawString(MARGIN, H - HEADER_H + 20, "PMtool")

    # Indigo accent bar under logo text
    cv.setFillColor(INDIGO)
    cv.rect(MARGIN, H - HEADER_H + 17, 4, 28, fill=1, stroke=0)

    # Subtitle
    cv.setFillColor(HexColor("#A5B4FC"))   # soft indigo
    cv.setFont("Helvetica", 10)
    cv.drawString(MARGIN + 90, H - HEADER_H + 32, "Operator Quick Reference")

    # Login URL pill
    pill_text = "pmtool-3f8db.web.app/login"
    draw_pill(cv, pill_text, W - MARGIN - 200, H - HEADER_H + 38, font_size=8)

    # Label above pill
    cv.setFillColor(HexColor("#A5B4FC"))
    cv.setFont("Helvetica", 7.5)
    cv.drawString(W - MARGIN - 200, H - HEADER_H + 44, "Login URL")

    # ── Footer bar ────────────────────────────────────────────────────────────
    cv.setFillColor(INDIGO)
    cv.rect(0, 0, W, FOOTER_H, fill=1, stroke=0)

    cv.setFillColor(WHITE)
    cv.setFont("Helvetica-Bold", 10)
    main_msg = "When in doubt — ask your Supervisor.  Never guess."
    cv.drawCentredString(W / 2, FOOTER_H - 18, main_msg)

    cv.setFillColor(HexColor("#A5B4FC"))
    cv.setFont("Helvetica", 7.5)
    cv.drawCentredString(W / 2, FOOTER_H - 32,
                         "PMtool Production Management Platform — Confidential")

    # ── Section labels helper ─────────────────────────────────────────────────
    def section_label(text, x, y, width):
        cv.setFillColor(NAVY)
        cv.setFont("Helvetica-Bold", 8)
        cv.drawString(x, y, text.upper())
        cv.setStrokeColor(INDIGO)
        cv.setLineWidth(1.5)
        tw = cv.stringWidth(text.upper(), "Helvetica-Bold", 8)
        cv.line(x + tw + 6, y + 3, x + width, y + 3)

    # ════════════════════════════════════════════════════════════════════════
    # LEFT COLUMN — 5-Step Workflow
    # ════════════════════════════════════════════════════════════════════════
    col_top = CONTENT_TOP

    section_label("Your 5-Step Workflow", LEFT_X, col_top - 4, LEFT_W)

    steps = [
        (1, GREEN,  "Log In",
         "Go to the login URL above → enter your email & password."),
        (2, INDIGO, "Find Your Meter",
         "Pick your assigned meter from the queue at your station."),
        (3, AMBER,  "Fill the Checklist",
         "Mark each parameter Pass or Fail — be honest, every field matters."),
        (4, INDIGO, "Add a Reading",
         "Where a numeric value is required, type it in before continuing."),
        (5, GREEN,  "Submit",
         "Pass → meter moves forward automatically.\n"
         "Fail → choose the rework stage and add a comment explaining why."),
    ]

    BOX_H_BASE = 44
    BOX_H_LAST = 54    # step 5 needs extra height for two-line detail
    BOX_R = 6
    BOX_GAP = 8
    NUM_R = 12

    y_cursor = col_top - 22

    for i, (num, color, title, detail) in enumerate(steps):
        bh = BOX_H_LAST if i == 4 else BOX_H_BASE
        by = y_cursor - bh

        # Card background
        draw_rounded_rect(cv, LEFT_X, by, LEFT_W, bh, BOX_R,
                          fill_color=WHITE, stroke_color=HexColor("#D1D5DB"))

        # Colour left accent stripe
        cv.setFillColor(color)
        cv.roundRect(LEFT_X, by, 6, bh, BOX_R, fill=1, stroke=0)
        # cover right half of accent radius so it's a flat right edge
        cv.rect(LEFT_X + 3, by, 3, bh, fill=1, stroke=0)

        # Number circle
        cx_num = LEFT_X + 6 + NUM_R + 6
        cy_num = by + bh / 2
        cv.setFillColor(color)
        cv.circle(cx_num, cy_num, NUM_R, fill=1, stroke=0)
        cv.setFillColor(WHITE)
        cv.setFont("Helvetica-Bold", 13)
        num_str = str(num)
        nw = cv.stringWidth(num_str, "Helvetica-Bold", 13)
        cv.drawString(cx_num - nw / 2, cy_num - 5, num_str)

        # Title
        tx = cx_num + NUM_R + 9
        cv.setFillColor(DARK)
        cv.setFont("Helvetica-Bold", 10.5)
        cv.drawString(tx, by + bh - 17, title)

        # Detail text (handle \n)
        cv.setFillColor(MID)
        cv.setFont("Helvetica", 8.5)
        lines = detail.split("\n")
        line_y = by + bh - 30
        for line in lines:
            cv.drawString(tx, line_y, line)
            line_y -= 12

        y_cursor = by - BOX_GAP

    # ════════════════════════════════════════════════════════════════════════
    # RIGHT COLUMN — Status Colours + Troubleshooting
    # ════════════════════════════════════════════════════════════════════════
    col_top_r = CONTENT_TOP

    # ── Status Colours ────────────────────────────────────────────────────
    section_label("Status Colours", RIGHT_X, col_top_r - 4, RIGHT_W)

    status_items = [
        (GREEN, "Machine running"),
        (AMBER, "Attention needed"),
        (RED,   "Machine down"),
    ]

    STATUS_CARD_H = 72
    draw_rounded_rect(cv, RIGHT_X, col_top_r - 22 - STATUS_CARD_H,
                      RIGHT_W, STATUS_CARD_H, 6, WHITE,
                      stroke_color=HexColor("#D1D5DB"))

    sq = 14
    sq_x = RIGHT_X + 14
    sq_y_start = col_top_r - 22 - STATUS_CARD_H + STATUS_CARD_H - 22

    for dot_color, label in status_items:
        cv.setFillColor(dot_color)
        cv.roundRect(sq_x, sq_y_start, sq, sq, 3, fill=1, stroke=0)
        cv.setFillColor(DARK)
        cv.setFont("Helvetica-Bold", 9)
        cv.drawString(sq_x + sq + 9, sq_y_start + 2, label)
        sq_y_start -= 20

    # ── If Something Goes Wrong ───────────────────────────────────────────
    trouble_top = col_top_r - 22 - STATUS_CARD_H - 16

    section_label("If Something Goes Wrong", RIGHT_X, trouble_top, RIGHT_W)

    issues = [
        ("Can't log in",          "Contact your Supervisor"),
        ("Meter not in queue",     "Ask Supervisor to check"),
        ("Submitted wrong result", "Tell Supervisor immediately"),
        ("System not loading",     "Refresh — then tell Supervisor"),
    ]

    ISSUE_H = 38
    ISSUE_GAP = 7
    iy = trouble_top - 18

    for problem, action in issues:
        draw_rounded_rect(cv, RIGHT_X, iy - ISSUE_H, RIGHT_W, ISSUE_H, 5,
                          WHITE, stroke_color=HexColor("#D1D5DB"))

        # Red left accent
        cv.setFillColor(RED)
        cv.roundRect(RIGHT_X, iy - ISSUE_H, 5, ISSUE_H, 4, fill=1, stroke=0)
        cv.rect(RIGHT_X + 2, iy - ISSUE_H, 3, ISSUE_H, fill=1, stroke=0)

        # Problem label
        cv.setFillColor(RED)
        cv.setFont("Helvetica-Bold", 8)
        cv.drawString(RIGHT_X + 12, iy - 13, problem)

        # Action arrow + text
        cv.setFillColor(DARK)
        cv.setFont("Helvetica", 8)
        cv.drawString(RIGHT_X + 12, iy - 26, u"→ " + action)

        iy -= ISSUE_H + ISSUE_GAP

    # ── Thin divider between columns ──────────────────────────────────────
    cv.setStrokeColor(HexColor("#D1D5DB"))
    cv.setLineWidth(0.75)
    cv.line(RIGHT_X - GUTTER / 2, CONTENT_BOTTOM + 4,
            RIGHT_X - GUTTER / 2, CONTENT_TOP - 4)

    # ── "Printed on" watermark at very bottom of content area ────────────
    cv.setFillColor(MID)
    cv.setFont("Helvetica", 6.5)
    cv.drawRightString(W - MARGIN, CONTENT_BOTTOM - 8,
                       "v1.0 — PMtool Platform")

    cv.save()
    print(f"PDF saved → {OUTPUT}")


if __name__ == "__main__":
    generate()
