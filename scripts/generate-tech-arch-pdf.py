#!/usr/bin/env python3
"""Generate PMtool Technical Architecture Document PDF."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, Flowable
)
from reportlab.platypus.flowables import KeepTogether
from reportlab.pdfgen import canvas
import os

OUTPUT_PATH = "/Users/chetanpatil/Desktop/PMtool_Technical_Architecture.pdf"

# ---------------------------------------------------------------------------
# Brand Colors
# ---------------------------------------------------------------------------
NAVY        = colors.Color(0.11,  0.133, 0.208)
INDIGO      = colors.Color(0.263, 0.38,  0.933)
VIOLET      = colors.Color(0.545, 0.361, 0.965)
GREEN       = colors.Color(0.133, 0.773, 0.369)
AMBER       = colors.Color(0.961, 0.62,  0.043)
RED         = colors.Color(0.937, 0.267, 0.267)
LIGHT_GREY  = colors.Color(0.933, 0.941, 0.969)
TEXT_DARK   = colors.Color(0.102, 0.122, 0.212)
WHITE       = colors.white
BLACK       = colors.black

# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------
base_styles = getSampleStyleSheet()

def make_styles():
    s = {}

    s['h1'] = ParagraphStyle(
        'H1',
        fontName='Helvetica-Bold',
        fontSize=16,
        textColor=NAVY,
        spaceAfter=8,
        spaceBefore=18,
        leading=20,
    )
    s['h2'] = ParagraphStyle(
        'H2',
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=INDIGO,
        spaceAfter=6,
        spaceBefore=12,
        leading=16,
    )
    s['body'] = ParagraphStyle(
        'Body',
        fontName='Helvetica',
        fontSize=10,
        textColor=TEXT_DARK,
        spaceAfter=6,
        leading=15,
        alignment=TA_JUSTIFY,
    )
    s['body_left'] = ParagraphStyle(
        'BodyLeft',
        fontName='Helvetica',
        fontSize=10,
        textColor=TEXT_DARK,
        spaceAfter=4,
        leading=15,
        alignment=TA_LEFT,
    )
    s['numbered'] = ParagraphStyle(
        'Numbered',
        fontName='Helvetica',
        fontSize=10,
        textColor=TEXT_DARK,
        spaceAfter=4,
        spaceBefore=2,
        leading=15,
        leftIndent=18,
        alignment=TA_LEFT,
    )
    s['bold_label'] = ParagraphStyle(
        'BoldLabel',
        fontName='Helvetica-Bold',
        fontSize=10,
        textColor=TEXT_DARK,
        spaceAfter=2,
        spaceBefore=6,
        leading=15,
    )
    s['code'] = ParagraphStyle(
        'Code',
        fontName='Courier',
        fontSize=9,
        textColor=TEXT_DARK,
        spaceAfter=2,
        leading=13,
        leftIndent=10,
        rightIndent=10,
    )
    s['table_header'] = ParagraphStyle(
        'TableHeader',
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=WHITE,
        alignment=TA_LEFT,
        leading=13,
    )
    s['table_cell'] = ParagraphStyle(
        'TableCell',
        fontName='Helvetica',
        fontSize=9,
        textColor=TEXT_DARK,
        alignment=TA_LEFT,
        leading=13,
    )
    s['table_cell_mono'] = ParagraphStyle(
        'TableCellMono',
        fontName='Courier',
        fontSize=8,
        textColor=TEXT_DARK,
        alignment=TA_LEFT,
        leading=12,
    )
    return s

STYLES = make_styles()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def h1(text):
    return Paragraph(text, STYLES['h1'])

def h2(text):
    return Paragraph(text, STYLES['h2'])

def body(text):
    return Paragraph(text, STYLES['body'])

def body_left(text):
    return Paragraph(text, STYLES['body_left'])

def sp(h=6):
    return Spacer(1, h)

def hr():
    return HRFlowable(width="100%", thickness=1, color=INDIGO, spaceAfter=6, spaceBefore=6)

def numbered_list(items):
    result = []
    for i, item in enumerate(items, 1):
        result.append(Paragraph(f"{i}.&nbsp;&nbsp;{item}", STYLES['numbered']))
    return result

def code_block(text):
    lines = text.strip('\n').split('\n')
    paras = [Paragraph(line.replace(' ', '&nbsp;').replace('<', '&lt;').replace('>', '&gt;'), STYLES['code'])
             for line in lines]
    inner = Table(
        [[col] for col in paras],
        colWidths=['100%'],
        style=TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), LIGHT_GREY),
            ('LEFTPADDING',  (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING',   (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING',(0, 0), (-1, -1), 6),
            ('ROWBACKGROUNDS', (0, 0), (-1, -1), [LIGHT_GREY]),
        ])
    )
    return inner

def make_table(headers, rows, col_widths=None, mono_cols=None):
    """Create a styled table with indigo header row."""
    mono_cols = mono_cols or []
    header_row = [Paragraph(h, STYLES['table_header']) for h in headers]
    data = [header_row]
    for row in rows:
        data_row = []
        for ci, cell in enumerate(row):
            style = STYLES['table_cell_mono'] if ci in mono_cols else STYLES['table_cell']
            data_row.append(Paragraph(cell, style))
        data.append(data_row)

    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        # Header
        ('BACKGROUND',    (0, 0), (-1, 0), INDIGO),
        ('TEXTCOLOR',     (0, 0), (-1, 0), WHITE),
        ('FONTNAME',      (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE',      (0, 0), (-1, 0), 9),
        # Body rows
        ('FONTNAME',      (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE',      (0, 1), (-1, -1), 9),
        ('TEXTCOLOR',     (0, 1), (-1, -1), TEXT_DARK),
        ('ROWBACKGROUNDS',(0, 1), (-1, -1), [WHITE, LIGHT_GREY]),
        # Grid
        ('GRID',          (0, 0), (-1, -1), 0.5, colors.Color(0.8, 0.82, 0.87)),
        # Padding
        ('LEFTPADDING',   (0, 0), (-1, -1), 8),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 8),
        ('TOPPADDING',    (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
    ]))
    return t

# ---------------------------------------------------------------------------
# Cover Page
# ---------------------------------------------------------------------------

class NavyHeaderBanner(Flowable):
    """Full-width navy banner for cover page."""
    def __init__(self, width, height=4*cm):
        super().__init__()
        self.banner_width = width
        self.banner_height = height

    def wrap(self, availWidth, availHeight):
        return (self.banner_width, self.banner_height + 60)

    def draw(self):
        c = self.canv
        # Navy rectangle
        c.setFillColor(NAVY)
        c.rect(0, 20, self.banner_width, self.banner_height, fill=1, stroke=0)

        # "PMtool" 36pt bold white
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 36)
        c.drawString(0, self.banner_height - 10, 'PMtool')

        # Subtitle 18pt white
        c.setFont('Helvetica-Bold', 18)
        c.drawString(0, self.banner_height - 46, 'Technical Architecture Document')


def build_cover(page_width, margin):
    content_width = page_width - 2 * margin
    story = []

    story.append(NavyHeaderBanner(content_width))
    story.append(sp(10))

    story.append(Paragraph(
        'Production Management Platform&nbsp;&nbsp;—&nbsp;&nbsp;v1.0&nbsp;&nbsp;—&nbsp;&nbsp;May 2026',
        ParagraphStyle('CoverSub', fontName='Helvetica', fontSize=12,
                       textColor=TEXT_DARK, spaceAfter=6, leading=18)
    ))
    story.append(Paragraph(
        'Confidential — For technical evaluation only',
        ParagraphStyle('CoverConf', fontName='Helvetica-Oblique', fontSize=10,
                       textColor=colors.Color(0.4, 0.4, 0.5), spaceAfter=12, leading=14)
    ))
    story.append(hr())
    story.append(PageBreak())
    return story

# ---------------------------------------------------------------------------
# Page Footer
# ---------------------------------------------------------------------------

FOOTER_TEXT = "PMtool Technical Architecture — Confidential — pmtool-3f8db — May 2026"

def add_footer(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFont('Helvetica', 8)
    canvas_obj.setFillColor(colors.Color(0.5, 0.5, 0.55))
    canvas_obj.drawString(doc.leftMargin, 1.2 * cm, FOOTER_TEXT)
    canvas_obj.drawRightString(
        doc.pagesize[0] - doc.rightMargin, 1.2 * cm,
        f"Page {canvas_obj.getPageNumber()}"
    )
    canvas_obj.restoreState()

# ---------------------------------------------------------------------------
# Section builders
# ---------------------------------------------------------------------------

def section_overview(cw):
    story = []
    story.append(h1("1. System Overview"))
    story.append(body(
        "PMtool is a cloud-native production management platform built for energy meter "
        "manufacturing. It digitises the 13-stage quality control pipeline, enforces "
        "role-based access, and provides real-time visibility from a single web interface."
    ))
    story.append(sp(8))

    headers = ["Layer", "Technology", "Version"]
    rows = [
        ["Frontend",            "Next.js (App Router)",                  "14"],
        ["Language",            "TypeScript",                            "5"],
        ["Auth",                "Firebase Authentication",               "v9"],
        ["Database",            "Cloud Firestore",                       "v9"],
        ["Backend Functions",   "Firebase Cloud Functions v2",           "Node 20"],
        ["Hosting",             "Firebase Hosting + Cloud Run",          "—"],
        ["Styling",             "Tailwind CSS",                          "3"],
        ["Edge Middleware",     "Next.js Edge Runtime",                  "—"],
    ]
    col_widths = [cw * 0.25, cw * 0.50, cw * 0.25]
    story.append(make_table(headers, rows, col_widths))
    story.append(sp(4))
    return story


def section_architecture(cw):
    story = []
    story.append(h1("2. Architecture Overview"))
    story.append(h2("Request Flow"))
    story += numbered_list([
        "User opens browser → Firebase Hosting CDN serves static Next.js assets.",
        "Login: Firebase Auth client SDK calls Auth emulator/production → returns ID token with custom role claim.",
        "Session cookie: POST /api/auth/session → server-side route stores role as plain string in HttpOnly cookie <font name='Courier'>pmtool-session</font>.",
        "Subsequent requests: Next.js Edge Middleware reads <font name='Courier'>pmtool-session</font> cookie, checks role, redirects unauthenticated/unauthorised requests before any page renders.",
        "Data: Firestore real-time listeners (<font name='Courier'>onSnapshot</font>) stream live updates to the browser — no polling.",
        "Admin operations (create user, reset password, delete user): callable Cloud Functions with Firebase Auth token verification server-side.",
    ])
    story.append(sp(10))

    story.append(h2("Data Model"))
    headers = ["Collection", "Document", "Key Fields"]
    rows = [
        ["/users/{uid}",                       "One per user",              "uid, email, displayName, role, workstationIds"],
        ["/meters/{meterId}",                  "One per meter",             "serialNumber, meterType, status, currentStageId, reworkCount"],
        ["/meters/{id}/stageHistory/{entryId}","One per stage submission",  "stageId, operatorId, parameters[], overallResult, submittedAt"],
        ["/workstations/{wsId}",               "One per workstation",       "wsId, name, processOrder, isActive"],
        ["/auditLog/{entryId}",                "One per admin action",      "action, actorUid, actorRole, before, after, timestamp"],
    ]
    col_widths = [cw * 0.32, cw * 0.22, cw * 0.46]
    story.append(make_table(headers, rows, col_widths, mono_cols=[0]))
    story.append(sp(4))
    return story


def section_security(cw):
    story = []
    story.append(h1("3. Security Design"))

    story.append(h2("Authentication"))
    story.append(body(
        "Firebase Authentication handles credential verification. On successful login, the "
        "client calls POST /api/auth/session with the Firebase ID token. The server-side "
        "route decodes the token using Firebase Admin SDK, extracts the role custom claim, "
        "and sets an HttpOnly cookie named <font name='Courier'>pmtool-session</font> containing the plain role string."
    ))
    story.append(sp(4))

    story.append(h2("Authorisation — Three Layers"))
    story += numbered_list([
        "<b>Edge Middleware (Next.js)</b> — Reads <font name='Courier'>pmtool-session</font> cookie at CDN edge. "
        "Unauthenticated requests are redirected to /login before any server-side code runs. "
        "Role-specific paths (e.g. /team, /reports) reject insufficient roles immediately.",
        "<b>Cloud Functions</b> — Every callable function verifies <font name='Courier'>request.auth</font> (Firebase token) "
        "server-side. The callerRole is extracted from the token claim — not from client-supplied data. "
        "A client cannot elevate its own role.",
        "<b>Firestore Security Rules</b> — Database-level enforcement. The auditLog collection is "
        "write-once / delete-never at the rules layer: "
        "<font name='Courier'>allow create: if isAuth(); allow update, delete: if false;</font>. "
        "stageHistory entries can only be written by operators or above (not QA).",
    ])
    story.append(sp(6))

    story.append(h2("Cookie Design"))
    story.append(code_block(
        "Cookie name:  pmtool-session\n"
        "Value:        plain role string ('admin', 'supervisor', 'operator', 'qa')\n"
        "Flags:        HttpOnly, Secure, SameSite=Lax, Path=/\n"
        "Max-Age:      5 days\n"
        "Why plain string: Next.js ResponseCookies.set() percent-encodes JSON values.\n"
        "               Middleware reading a percent-encoded JSON string causes JSON.parse\n"
        "               to throw silently. Plain role string is never encoded."
    ))
    story.append(sp(4))
    return story


def section_realtime(cw):
    story = []
    story.append(h1("4. Real-Time Data Sync"))
    story.append(body(
        "PMtool uses Firestore's onSnapshot listeners for live updates. The operator queue, "
        "workstation status, and dashboard metrics all update without any page refresh. "
        "Firestore's IndexedDB persistence layer (enableIndexedDbPersistence) ensures the "
        "queue survives short network interruptions mid-shift."
    ))
    story.append(sp(6))

    story.append(h2("Key Listener Patterns"))
    headers = ["Screen", "Collection Listened", "Filter"]
    rows = [
        ["Operator queue",    "/meters",                      "currentStageId == assigned stage, status in [queued, rework]"],
        ["Workstation cards", "/meters",                      "collectionGroup, per stageId"],
        ["Stage history",     "/meters/{id}/stageHistory",   "collectionGroup, ordered by submittedAt"],
        ["Audit log",         "/auditLog",                   "ordered by timestamp desc"],
    ]
    col_widths = [cw * 0.22, cw * 0.30, cw * 0.48]
    story.append(make_table(headers, rows, col_widths))
    story.append(sp(4))
    return story


def section_functions(cw):
    story = []
    story.append(h1("5. Cloud Functions (v2)"))
    story.append(body(
        "All functions deployed to asia-south1 region as Firebase Gen 2 callable functions "
        "(onCall). Client calls via Firebase SDK httpsCallable — CORS is handled by the SDK automatically."
    ))
    story.append(sp(6))

    headers = ["Function", "Caller Roles", "What it does"]
    rows = [
        ["createUser",          "admin",                "Creates Firebase Auth user + Firestore /users doc + sets role custom claim"],
        ["setUserRole",         "admin",                "Updates custom claim + Firestore role field"],
        ["deleteUser",          "admin, supervisor",    "Deletes Auth user + Firestore doc"],
        ["resetUserPassword",   "admin, supervisor",    "Calls admin.auth().updateUser() with new password — bypasses email requirement"],
        ["deleteWorkstation",   "admin",                "Deletes workstation doc; rejects if only 1 remains"],
        ["healthCheck",         "any",                  "Returns project ID + status for monitoring"],
    ]
    col_widths = [cw * 0.25, cw * 0.22, cw * 0.53]
    story.append(make_table(headers, rows, col_widths, mono_cols=[0]))
    story.append(sp(4))
    return story


def section_hosting(cw):
    story = []
    story.append(h1("6. Hosting & Infrastructure"))

    story.append(h2("Firebase Hosting + Cloud Run"))
    story.append(body(
        "Next.js is deployed via Firebase webframeworks which automatically provisions a "
        "Cloud Run service for server-side rendering. Static assets are served from Firebase "
        "Hosting CDN. The CDN only forwards the <font name='Courier'>__session</font> cookie to Cloud Run by default — "
        "<font name='Courier'>pmtool-session</font> is an additional cookie passed via rewrite rules."
    ))
    story.append(sp(4))

    story.append(h2("Deployment Pipeline"))
    story += numbered_list([
        "Developer pushes to main branch.",
        "GitHub Actions runs: <font name='Courier'>npm run build</font> → <font name='Courier'>firebase deploy --only hosting,functions,firestore</font>.",
        "Firebase webframeworks builds the Next.js app and pushes a new Cloud Run revision.",
        "Cloud Run performs a zero-downtime rollout.",
        "Firestore rules and indexes are deployed atomically with the code.",
    ])
    story.append(sp(6))

    story.append(h2("Environment Variables"))
    story.append(code_block(
        "NEXT_PUBLIC_FIREBASE_API_KEY              — Firebase client config\n"
        "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN          — Firebase client config\n"
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID           — Firebase client config\n"
        "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET       — Firebase client config\n"
        "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID\n"
        "NEXT_PUBLIC_FIREBASE_APP_ID\n"
        "NEXT_PUBLIC_USE_EMULATOR                  — 'true' for local dev only"
    ))
    story.append(sp(4))
    return story


def section_differentiators(cw):
    story = []
    story.append(h1("7. Technical Differentiators"))

    items = [
        (
            "Role enforcement at three independent layers — UI, Edge, Database.",
            "An attacker who bypasses the UI still hits the Edge Middleware. One who bypasses "
            "the Edge still hits Firestore rules. One who calls a Cloud Function directly still "
            "has their token verified server-side."
        ),
        (
            "Real-time without WebSockets.",
            "Firestore's onSnapshot uses a long-lived gRPC stream under the hood. Zero polling, "
            "zero stale data, zero infrastructure to manage for the real-time layer."
        ),
        (
            "Immutable audit log by design.",
            "The auditLog collection has <font name='Courier'>allow update, delete: if false</font> in Firestore rules. "
            "This is enforced at the database layer — not the application layer. No admin, no "
            "developer, no code change can delete an audit entry without changing the deployed "
            "security rules (which is itself an auditable event in GCP)."
        ),
        (
            "Session cookie avoids encoding bugs.",
            "Storing a plain role string (not JSON) in the cookie sidesteps a known Next.js "
            "ResponseCookies encoding bug where JSON values containing {, \", : get percent-encoded, "
            "causing silent parse failures in Edge Middleware."
        ),
        (
            "Zero-downtime deploy via Cloud Run revisions.",
            "Firebase webframeworks creates a new Cloud Run revision on every deploy. Traffic shifts "
            "only after the new revision passes health checks. No users are affected during deployment."
        ),
        (
            "Sequential stage enforcement in the data model.",
            "A meter's currentStageId can only advance to the next stage via a Cloud Function or "
            "operator submission. The data model makes it impossible to skip a stage — not as a UI "
            "rule, but as a write-time constraint."
        ),
        (
            "Offline-tolerant queue.",
            "Firestore's IndexedDB persistence means an operator's queue is available even during "
            "a brief network drop. Submissions queue locally and sync when connectivity resumes."
        ),
    ]

    for i, (title, explanation) in enumerate(items, 1):
        story.append(Paragraph(f"{i}.&nbsp;&nbsp;<b>{title}</b>", STYLES['numbered']))
        story.append(Paragraph(explanation, ParagraphStyle(
            f'DiffBody{i}',
            fontName='Helvetica',
            fontSize=10,
            textColor=TEXT_DARK,
            leading=15,
            leftIndent=30,
            spaceAfter=8,
            alignment=TA_JUSTIFY,
        )))

    return story

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def build_pdf():
    margin = 2 * cm
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=margin,
        bottomMargin=2.5 * cm,   # extra room for footer
        title="PMtool Technical Architecture",
        author="PMtool Engineering",
        subject="Technical Architecture Document",
    )

    page_width, _ = A4
    content_width = page_width - 2 * margin

    story = []

    # Cover
    story += build_cover(page_width, margin)

    # Section 1
    story += section_overview(content_width)
    story.append(PageBreak())

    # Section 2
    story += section_architecture(content_width)
    story.append(PageBreak())

    # Section 3
    story += section_security(content_width)
    story.append(PageBreak())

    # Section 4
    story += section_realtime(content_width)

    # Section 5
    story += section_functions(content_width)
    story.append(PageBreak())

    # Section 6
    story += section_hosting(content_width)
    story.append(PageBreak())

    # Section 7
    story += section_differentiators(content_width)

    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    print(f"PDF saved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_pdf()
