#!/usr/bin/env python3
"""
PMtool Admin & Supervisor User Manual PDF Generator
Generates a professional PDF manual using reportlab platypus.
"""

from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, ListFlowable, ListItem
)
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus.flowables import Flowable

# ─── Brand Colours ────────────────────────────────────────────────────────────
NAVY       = HexColor('#1C2235')
INDIGO     = HexColor('#4361EE')
VIOLET     = HexColor('#8B5CF6')
GREEN      = HexColor('#22C55E')
AMBER      = HexColor('#F59E0B')
RED        = HexColor('#EF4444')
LIGHT_GREY = HexColor('#EEF0F7')
MID_GREY   = HexColor('#9DA8C3')
TEXT_DARK  = HexColor('#1A1F36')
AMBER_TINT = HexColor('#FFFBEB')

OUTPUT_PATH = '/Users/chetanpatil/Desktop/PMtool_Admin_Manual.pdf'

# ─── Page callback ────────────────────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    # Footer line
    canvas.setStrokeColor(MID_GREY)
    canvas.setLineWidth(0.5)
    canvas.line(2*cm, 1.4*cm, w - 2*cm, 1.4*cm)
    # Footer text left
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(MID_GREY)
    canvas.drawString(2*cm, 0.9*cm, 'PMtool Admin Manual — Confidential')
    # Footer text right (page number)
    canvas.drawRightString(w - 2*cm, 0.9*cm, f'Page {doc.page}')
    canvas.restoreState()


# ─── Style definitions ────────────────────────────────────────────────────────
def build_styles():
    base = getSampleStyleSheet()

    styles = {}

    styles['Title'] = ParagraphStyle(
        'Title',
        fontName='Helvetica-Bold',
        fontSize=24,
        textColor=NAVY,
        spaceAfter=12,
        leading=30,
    )

    styles['H1'] = ParagraphStyle(
        'H1',
        fontName='Helvetica-Bold',
        fontSize=16,
        textColor=INDIGO,
        spaceBefore=18,
        spaceAfter=8,
        leading=22,
    )

    styles['H2'] = ParagraphStyle(
        'H2',
        fontName='Helvetica-Bold',
        fontSize=13,
        textColor=NAVY,
        spaceBefore=12,
        spaceAfter=6,
        leading=18,
    )

    styles['Body'] = ParagraphStyle(
        'Body',
        fontName='Helvetica',
        fontSize=10,
        textColor=TEXT_DARK,
        leading=15,
        spaceAfter=8,
    )

    styles['TipText'] = ParagraphStyle(
        'TipText',
        fontName='Helvetica-Oblique',
        fontSize=9,
        textColor=INDIGO,
        leading=14,
        spaceAfter=0,
    )

    styles['WarnText'] = ParagraphStyle(
        'WarnText',
        fontName='Helvetica-Oblique',
        fontSize=9,
        textColor=HexColor('#92400E'),
        leading=14,
        spaceAfter=0,
    )

    styles['StepText'] = ParagraphStyle(
        'StepText',
        fontName='Helvetica',
        fontSize=10,
        textColor=TEXT_DARK,
        leading=15,
        spaceAfter=4,
        leftIndent=8,
    )

    styles['TOCItem'] = ParagraphStyle(
        'TOCItem',
        fontName='Helvetica',
        fontSize=10,
        textColor=TEXT_DARK,
        leading=18,
        spaceAfter=2,
        leftIndent=0,
    )

    styles['TOCSubItem'] = ParagraphStyle(
        'TOCSubItem',
        fontName='Helvetica',
        fontSize=10,
        textColor=TEXT_DARK,
        leading=18,
        spaceAfter=2,
        leftIndent=20,
    )

    styles['CoverTitle'] = ParagraphStyle(
        'CoverTitle',
        fontName='Helvetica-Bold',
        fontSize=32,
        textColor=white,
        leading=40,
        alignment=TA_CENTER,
    )

    styles['CoverSubtitle'] = ParagraphStyle(
        'CoverSubtitle',
        fontName='Helvetica',
        fontSize=18,
        textColor=white,
        leading=24,
        alignment=TA_CENTER,
    )

    styles['CoverVersion'] = ParagraphStyle(
        'CoverVersion',
        fontName='Helvetica',
        fontSize=11,
        textColor=MID_GREY,
        leading=16,
        alignment=TA_CENTER,
    )

    styles['BackCoverTitle'] = ParagraphStyle(
        'BackCoverTitle',
        fontName='Helvetica-Bold',
        fontSize=18,
        textColor=white,
        leading=24,
        alignment=TA_CENTER,
    )

    styles['SmallBody'] = ParagraphStyle(
        'SmallBody',
        fontName='Helvetica',
        fontSize=9,
        textColor=MID_GREY,
        leading=14,
        spaceAfter=6,
        alignment=TA_CENTER,
    )

    return styles


# ─── Helper builders ──────────────────────────────────────────────────────────
def h1(text, styles):
    """Return H1 paragraph + indigo HR rule."""
    return [
        Paragraph(text, styles['H1']),
        HRFlowable(width='100%', thickness=2, color=INDIGO, spaceAfter=6),
    ]


def h2(text, styles):
    return [Paragraph(text, styles['H2'])]


def body(text, styles):
    return Paragraph(text, styles['Body'])


def tip(text, styles):
    content = Paragraph(f'<b>💡 Tip:</b> {text}', styles['TipText'])
    tbl = Table(
        [[content]],
        colWidths=['100%'],
    )
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_GREY),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LINEBEFOREPADDING', (0,0), (0,-1), 0),
        ('LINEBEFORE', (0,0), (0,-1), 4, INDIGO),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [LIGHT_GREY]),
    ]))
    return [tbl, Spacer(1, 8)]


def warn(text, styles):
    content = Paragraph(f'<b>⚠ Note:</b> {text}', styles['WarnText'])
    tbl = Table(
        [[content]],
        colWidths=['100%'],
    )
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), AMBER_TINT),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LINEBEFORE', (0,0), (0,-1), 4, AMBER),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [AMBER_TINT]),
    ]))
    return [tbl, Spacer(1, 8)]


def steps(items, styles):
    """Return a list of step paragraphs with bold [N] prefix."""
    result = []
    for i, item in enumerate(items, 1):
        result.append(
            Paragraph(f'<font color="#4361EE"><b>[{i}]</b></font>  {item}', styles['StepText'])
        )
    result.append(Spacer(1, 6))
    return result


def data_table(headers, rows, col_widths=None):
    """Build a styled data table with navy header and alternating rows."""
    header_cells = [
        Paragraph(f'<font color="white"><b>{h}</b></font>', ParagraphStyle(
            'TH', fontName='Helvetica-Bold', fontSize=10, textColor=white,
            leading=14, alignment=TA_LEFT,
        ))
        for h in headers
    ]
    data = [header_cells]
    body_style = ParagraphStyle(
        'TD', fontName='Helvetica', fontSize=10, textColor=TEXT_DARK,
        leading=14, alignment=TA_LEFT,
    )
    for row in rows:
        data.append([Paragraph(str(cell), body_style) for cell in row])

    tbl = Table(data, colWidths=col_widths, repeatRows=1)

    row_bg = []
    for i in range(1, len(data)):
        bg = white if i % 2 == 1 else LIGHT_GREY
        row_bg.append(('ROWBACKGROUNDS', (0, i), (-1, i), [bg]))

    tbl.setStyle(TableStyle([
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        # Padding
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, MID_GREY),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ] + row_bg))

    return [tbl, Spacer(1, 10)]


# ─── Document assembly ────────────────────────────────────────────────────────
def build_document():
    styles = build_styles()
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        leftMargin=2*cm,
        rightMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2.5*cm,
        title='PMtool Admin & Supervisor User Manual',
        author='PMtool System',
        subject='Admin Manual v1.0',
    )

    page_width = A4[0] - 4*cm  # usable width

    story = []

    # ── COVER PAGE ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 2*cm))

    cover_data = [
        [Paragraph('PMtool', styles['CoverTitle'])],
        [Paragraph('Admin &amp; Supervisor User Manual', styles['CoverSubtitle'])],
        [Paragraph('Version 1.0 — May 2026', styles['CoverVersion'])],
    ]
    cover_table = Table(cover_data, colWidths=[page_width])
    cover_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NAVY),
        ('LEFTPADDING', (0, 0), (-1, -1), 24),
        ('RIGHTPADDING', (0, 0), (-1, -1), 24),
        ('TOPPADDING', (0, 0), (0, 0), 32),
        ('TOPPADDING', (0, 1), (0, 1), 10),
        ('TOPPADDING', (0, 2), (0, 2), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -2), 4),
        ('BOTTOMPADDING', (0, -1), (-1, -1), 32),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(cover_table)

    story.append(Spacer(1, 1.5*cm))
    story.append(body(
        'This manual covers all administrative tasks in PMtool including user management, '
        'workstation monitoring, password resets, report generation, and audit log review.',
        styles,
    ))
    story.append(body('<b>Audience:</b> Admin and Supervisor roles', styles))
    story.append(body('<b>Login URL:</b> pmtool-3f8db.web.app/admin/login', styles))

    story.append(PageBreak())

    # ── TABLE OF CONTENTS ─────────────────────────────────────────────────────
    story += h1('Table of Contents', styles)
    story.append(Spacer(1, 6))

    toc_items = [
        ('1. Getting Started — Logging In', False),
        ('2. Dashboard Overview', False),
        ('3. Managing Your Team', False),
        ('3.1  Adding a New User', True),
        ('3.2  Editing a User', True),
        ('3.3  Resetting a Password', True),
        ('3.4  Deleting a User', True),
        ('4. Workstation Monitoring', False),
        ('5. Reports', False),
        ('5.1  Production Report', True),
        ('5.2  Failure History Report', True),
        ('5.3  Tamper Test Report', True),
        ('6. Audit Log', False),
        ('7. Signing Out', False),
    ]
    for text, is_sub in toc_items:
        style_key = 'TOCSubItem' if is_sub else 'TOCItem'
        story.append(Paragraph(text, styles[style_key]))

    story.append(PageBreak())

    # ── SECTION 1 — Getting Started ───────────────────────────────────────────
    story += h1('1. Getting Started — Logging In', styles)
    story.append(body(
        'Admin and Supervisor accounts use a dedicated login page separate from the operator '
        'login. This page supports the "Forgot Password" email reset flow for accounts with '
        'real email addresses.',
        styles,
    ))

    story += steps([
        'Open your browser and navigate to: <b>pmtool-3f8db.web.app/admin/login</b>',
        'Enter your registered email address',
        'Enter your password and click <b>Sign In</b>',
        'You will be taken to the Dashboard',
    ], styles)

    story += tip(
        'Always use an Incognito / Private window if you were previously logged in as an '
        'operator on the same browser. This avoids stale session cookies.',
        styles,
    )

    story += warn(
        'If you see a blank screen after login, open a new Incognito window and try again.',
        styles,
    )

    story += h2('Forgot Your Password?', styles)
    story += steps([
        'Click <b>"Forgot password?"</b> on the login page',
        'Enter your email address',
        'Check your inbox for a reset link from Firebase '
        '(<i>noreply@pmtool-3f8db.firebaseapp.com</i>)',
        'Click the link and set a new password',
        'Return to the login page and sign in',
    ], styles)

    # ── SECTION 2 — Dashboard ─────────────────────────────────────────────────
    story += h1('2. Dashboard Overview', styles)
    story.append(body(
        'The Dashboard is the first screen you see after login. It gives you a real-time '
        'snapshot of production activity.',
        styles,
    ))

    story += data_table(
        ['Widget', 'What it shows'],
        [
            ['Total In Progress', 'Meters currently being processed across all stages'],
            ['Completed Today', 'Meters that reached stage 13 (Packing) today'],
            ['Rework Queue', 'Meters currently flagged for rework'],
            ['Avg Cycle Time', 'Average time per meter across all stages'],
            ['Meters by Stage', 'Bar chart — how many meters are at each workstation right now'],
            ['Recent Activity', 'Last 10 stage submissions across the floor'],
        ],
        col_widths=[page_width * 0.32, page_width * 0.68],
    )

    story += tip(
        'The Dashboard updates in real time — you do not need to refresh the page.',
        styles,
    )

    # ── SECTION 3 — Managing Your Team ───────────────────────────────────────
    story += h1('3. Managing Your Team', styles)
    story.append(body(
        'The Team page (sidebar → Team) shows all users in the system. Admins can add, edit, '
        'reset passwords, and delete users. Supervisors can reset passwords only.',
        styles,
    ))

    story += h2('3.1 Adding a New User', styles)
    story += steps([
        'Go to <b>Team</b> in the sidebar',
        'Click <b>Add User</b> (top right)',
        'Fill in: Full Name, Email, Role, Temporary Password',
        'Click <b>Create User</b>',
        'The user appears in the table immediately',
        'Share the temporary password securely with the new user',
    ], styles)

    story += tip(
        'Use a strong temporary password (e.g. <b>Pmtool@2026</b>). The operator should '
        'change it after first login — though the system does not currently force a password change.',
        styles,
    )

    story += data_table(
        ['Role', 'Description'],
        [
            ['Admin', 'Full user management + all reports'],
            ['Supervisor', 'Floor monitoring + password resets + reports'],
            ['Operator', 'Processes their assigned workstation queue'],
            ['QA', 'Read-only access to all data and reports'],
        ],
        col_widths=[page_width * 0.28, page_width * 0.72],
    )

    story += h2('3.2 Editing a User', styles)
    story += steps([
        'Find the user in the Team table',
        'Click <b>Edit</b> (blue pill button)',
        'Update name, email, role, or workstation assignment',
        'Click <b>Save</b>',
    ], styles)

    story += warn(
        "Changing a user's role takes effect immediately on their next page load. If they are "
        'currently logged in, they will see the new role-appropriate screens after refreshing.',
        styles,
    )

    story += h2('3.3 Resetting a Password', styles)
    story += steps([
        'Find the user in the Team table',
        'Click <b>Reset Password</b> (amber pill button)',
        "Read the confirmation dialog — it shows the user's name and warns the action is audit-logged",
        'Click <b>Reset</b>',
        'A new temporary password is generated and displayed once — copy it immediately',
        'Share it securely with the operator (in person or via secure message)',
    ], styles)

    story += warn(
        'The temporary password is shown only once and is not stored anywhere in the system. '
        'If you miss it, run Reset Password again to generate a new one.',
        styles,
    )

    story += tip(
        'This action is automatically written to the Audit Log with your name, the target user, '
        'and the timestamp.',
        styles,
    )

    story += h2('3.4 Deleting a User', styles)
    story += steps([
        'Find the user in the Team table',
        'Click <b>Delete</b> (red pill button)',
        "A confirmation dialog shows the user's name and email",
        'Type or confirm, then click <b>Yes, Delete Permanently</b>',
        'The user is removed from Firebase Auth and Firestore immediately',
    ], styles)

    story += warn(
        'Deletion is permanent and cannot be undone. The action is recorded in the Audit Log. '
        'You cannot delete your own account.',
        styles,
    )

    # ── SECTION 4 — Workstation Monitoring ───────────────────────────────────
    story += h1('4. Workstation Monitoring', styles)
    story.append(body(
        'The Workstations page shows all 13 stations in a card grid. Each card shows the '
        'station name, assigned operator, machine status, and current queue depth.',
        styles,
    ))

    story += data_table(
        ['Colour', 'Meaning', 'Set by'],
        [
            ['Green', 'Running normally', 'Operator'],
            ['Yellow', 'Attention needed', 'Operator'],
            ['Red', 'Machine down', 'Operator'],
            ['No colour', 'No status set', '—'],
        ],
        col_widths=[page_width * 0.25, page_width * 0.45, page_width * 0.30],
    )

    story.append(body(
        'As an Admin or Supervisor, the Workstations page is read-only. You can see queue '
        'counts and operator assignments but cannot submit quality results. Operator assignment '
        'is managed from the Team page (Edit user → set workstation).',
        styles,
    ))

    story += tip(
        'Click on a queue count badge to see the list of meters waiting at that station.',
        styles,
    )

    # ── SECTION 5 — Reports ───────────────────────────────────────────────────
    story += h1('5. Reports', styles)
    story.append(body(
        'The Reports page has three tabs. All reports support date range filtering and CSV export.',
        styles,
    ))

    story += h2('5.1 Production Report', styles)
    story.append(body(
        'Shows all meters that completed the full 13-stage pipeline. Use this for daily/weekly '
        'throughput tracking.',
        styles,
    ))
    story.append(body(
        '<b>Filters available:</b> Station, Date range (From / To), Quick presets (Today, '
        'Last 7 days, Last 30 days, This month)',
        styles,
    ))
    story.append(body(
        '<b>Columns:</b> Serial Number, Meter Type, Completed At, Total Stages, Rework Count',
        styles,
    ))

    story += h2('5.2 Failure History Report', styles)
    story.append(body(
        'Shows all stage submissions where the result was REWORK. Use this to identify which '
        'stages fail most often and which operators need support.',
        styles,
    ))
    story.append(body('<b>Filters:</b> Stage, Operator, Date range', styles))
    story.append(body(
        '<b>Columns:</b> Serial Number, Stage, Operator, Failed Parameters, Comment, Submitted At',
        styles,
    ))

    story += h2('5.3 Tamper Test Report', styles)
    story.append(body(
        'Dedicated view for the Tamper Test stage (WS8). Each row shows the result of all '
        '5 tamper parameters for a meter.',
        styles,
    ))
    story.append(body(
        '<b>Columns:</b> Serial Number, Magnetic Tamper, Neutral Tamper, Cover Open Tamper, '
        'Reverse Connection, Earth Tamper, Result, Date',
        styles,
    ))

    story += tip(
        'Export the Tamper Test report for compliance documentation. The data is immutable — '
        'once submitted it cannot be altered.',
        styles,
    )

    # ── SECTION 6 — Audit Log ─────────────────────────────────────────────────
    story += h1('6. Audit Log', styles)
    story.append(body(
        'The Audit Log records every significant admin action in the system. It is write-once '
        '— entries cannot be edited or deleted by anyone, including admins.',
        styles,
    ))

    story += data_table(
        ['Event', 'When it fires'],
        [
            ['USER_CREATED', 'A new user is added'],
            ['USER_UPDATED', "A user's details are changed"],
            ['USER_DELETED', 'A user is permanently deleted'],
            ['PASSWORD_RESET', "A user's password is reset by an admin"],
            ['WORKSTATION_CREATED', 'A new workstation is added'],
            ['WORKSTATION_DELETED', 'A workstation is removed'],
        ],
        col_widths=[page_width * 0.38, page_width * 0.62],
    )

    story.append(body(
        '<b>Filters:</b> Action type, Actor (who did it), Date range (From / To)',
        styles,
    ))

    story += warn(
        'The Audit Log cannot be cleared or filtered out of existence. Even deleted users remain '
        'in the log under their original UID and name.',
        styles,
    )

    # ── SECTION 7 — Signing Out ───────────────────────────────────────────────
    story += h1('7. Signing Out', styles)
    story += steps([
        'Click your name or the <b>Sign Out</b> option at the bottom of the sidebar',
        'You are signed out of both the app and Firebase',
        'You are redirected back to <b>/admin/login</b>',
    ], styles)

    story += warn(
        'Always sign out before leaving your workstation, especially on a shared computer. '
        'PMtool sessions last 5 days — an unattended browser will remain logged in.',
        styles,
    )

    # ── BACK COVER ────────────────────────────────────────────────────────────
    story.append(PageBreak())

    back_data = [
        [Paragraph('PMtool — Admin &amp; Supervisor Manual', styles['BackCoverTitle'])],
    ]
    back_table = Table(back_data, colWidths=[page_width])
    back_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), INDIGO),
        ('LEFTPADDING', (0, 0), (-1, -1), 24),
        ('RIGHTPADDING', (0, 0), (-1, -1), 24),
        ('TOPPADDING', (0, 0), (-1, -1), 28),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 28),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(back_table)

    story.append(Spacer(1, 1.5*cm))
    story.append(Paragraph(
        'For technical support or account issues, contact your PMtool system administrator.',
        styles['SmallBody'],
    ))
    story.append(Paragraph(
        'This document is confidential and intended for internal use only.',
        styles['SmallBody'],
    ))
    story.append(Paragraph(
        'Version 1.0 — May 2026 — pmtool-3f8db.web.app',
        styles['SmallBody'],
    ))

    # ── BUILD ─────────────────────────────────────────────────────────────────
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f'PDF saved to: {OUTPUT_PATH}')


if __name__ == '__main__':
    build_document()
