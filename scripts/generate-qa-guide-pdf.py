"""
PMtool QA Testing Guide Generator
Run: python3 scripts/generate-qa-guide-pdf.py
Output: ~/Desktop/PMtool_QA_Testing_Guide.pdf
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.colors import HexColor, Color, white, black
import os

# ── Colours ────────────────────────────────────────────────────────────────────
NAVY    = HexColor('#1C2235')
INDIGO  = HexColor('#4361EE')
VIOLET  = HexColor('#8B5CF6')
GREEN   = HexColor('#22C55E')
AMBER   = HexColor('#F59E0B')
RED     = HexColor('#EF4444')
LGREY   = HexColor('#EEF0F7')
MGREY   = HexColor('#9DA8C3')
DARK    = HexColor('#1A1F36')
WHITE   = colors.white
GREEN_BG  = HexColor('#F0FDF4')
GREEN_BD  = HexColor('#16A34A')
RED_BG    = HexColor('#FFF1F2')
RED_BD    = HexColor('#DC2626')
AMBER_BG  = HexColor('#FFFBEB')
BLUE_BG   = HexColor('#EFF6FF')
BLUE_BD   = HexColor('#3B82F6')

W, H = A4
OUTPUT = os.path.expanduser('~/Desktop/PMtool_QA_Testing_Guide.pdf')

# ── Page template ──────────────────────────────────────────────────────────────
def make_page(canvas, doc):
    canvas.saveState()
    # Top bar
    canvas.setFillColor(NAVY)
    canvas.rect(0, H - 22, W, 22, fill=1, stroke=0)
    canvas.setFillColor(INDIGO)
    canvas.rect(0, H - 22, 60, 22, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont('Helvetica-Bold', 8)
    canvas.drawString(6, H - 15, 'PMtool')
    canvas.setFont('Helvetica', 7)
    canvas.drawString(66, H - 15, 'QA Testing Guide — Confidential')
    canvas.setFont('Helvetica', 7)
    canvas.drawRightString(W - 10, H - 15, f'Page {doc.page}')
    # Bottom bar
    canvas.setFillColor(LGREY)
    canvas.rect(0, 0, W, 16, fill=1, stroke=0)
    canvas.setFillColor(MGREY)
    canvas.setFont('Helvetica', 6.5)
    canvas.drawString(10, 5, 'PMtool Production Management Platform  ·  For QA use only  ·  Do not distribute')
    canvas.drawRightString(W - 10, 5, 'pmtool-3f8db.web.app')
    canvas.restoreState()

doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=1.8*cm, rightMargin=1.8*cm,
    topMargin=1.8*cm, bottomMargin=1.4*cm,
    onFirstPage=make_page, onLaterPages=make_page
)

# ── Styles ─────────────────────────────────────────────────────────────────────
ss = getSampleStyleSheet()

def S(name, **kw):
    return ParagraphStyle(name, **kw)

sTitle   = S('sTitle',   fontSize=26, textColor=WHITE,  fontName='Helvetica-Bold', alignment=TA_CENTER, spaceAfter=6)
sH1      = S('sH1',      fontSize=15, textColor=NAVY,   fontName='Helvetica-Bold', spaceBefore=14, spaceAfter=4)
sH2      = S('sH2',      fontSize=12, textColor=INDIGO, fontName='Helvetica-Bold', spaceBefore=10, spaceAfter=3)
sH3      = S('sH3',      fontSize=10, textColor=DARK,   fontName='Helvetica-Bold', spaceBefore=7,  spaceAfter=2)
sBody    = S('sBody',    fontSize=9,  textColor=DARK,   fontName='Helvetica',      leading=14,    spaceAfter=5)
sTip     = S('sTip',     fontSize=8.5,textColor=INDIGO, fontName='Helvetica-Oblique', leading=13, spaceAfter=0)
sWarn    = S('sWarn',    fontSize=8.5,textColor=HexColor('#92400E'), fontName='Helvetica-Oblique', leading=13, spaceAfter=0)
sFail    = S('sFail',    fontSize=8.5,textColor=RED_BD, fontName='Helvetica-Oblique', leading=13, spaceAfter=0)
sCode    = S('sCode',    fontSize=8,  textColor=DARK,   fontName='Courier',        leading=12,    spaceAfter=0)
sSmall   = S('sSmall',   fontSize=7.5,textColor=MGREY,  fontName='Helvetica',      leading=11,    spaceAfter=3)
sTH      = S('sTH',      fontSize=8.5,textColor=WHITE,  fontName='Helvetica-Bold', alignment=TA_LEFT)
sTD      = S('sTD',      fontSize=8.5,textColor=DARK,   fontName='Helvetica',      leading=12)
sTD_g    = S('sTD_g',    fontSize=8.5,textColor=GREEN_BD, fontName='Helvetica-Bold', leading=12)
sTD_r    = S('sTD_r',    fontSize=8.5,textColor=RED_BD,   fontName='Helvetica-Bold', leading=12)
sTD_a    = S('sTD_a',    fontSize=8.5,textColor=HexColor('#92400E'), fontName='Helvetica-Bold', leading=12)
sStep    = S('sStep',    fontSize=9,  textColor=DARK,   fontName='Helvetica',      leading=14,    spaceAfter=3, leftIndent=16)
sBullet  = S('sBullet',  fontSize=9,  textColor=DARK,   fontName='Helvetica',      leading=14,    spaceAfter=2, leftIndent=12)
sPass    = S('sPass',    fontSize=8.5,textColor=GREEN_BD, fontName='Helvetica-Bold')
sFAIL    = S('sFAIL',    fontSize=8.5,textColor=RED_BD,   fontName='Helvetica-Bold')

def hr():
    return HRFlowable(width='100%', thickness=0.5, color=HexColor('#E4E7F0'), spaceAfter=6, spaceBefore=2)

def h1(text):
    return [Paragraph(text, sH1), hr()]

def h2(text):
    return [Paragraph(text, sH2)]

def h3(text):
    return [Paragraph(text, sH3)]

def body(text):
    return Paragraph(text, sBody)

def step(n, text):
    return Paragraph(f'<b>[{n}]</b>  {text}', sStep)

def bullet(text):
    return Paragraph(f'•  {text}', sBullet)

def tip(text):
    t = Table([[Paragraph(f'💡  <b>Tip:</b>  {text}', sTip)]],
              colWidths=[W - 3.6*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BLUE_BG),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LINEAFTER', (0,0), (0,-1), 3, BLUE_BD),  # left border hack via right of col-1
        ('LINEBEFORE', (0,0), (0,-1), 3, BLUE_BD),
    ]))
    return t

def warn(text):
    t = Table([[Paragraph(f'⚠  <b>Note:</b>  {text}', sWarn)]],
              colWidths=[W - 3.6*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), AMBER_BG),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LINEBEFORE', (0,0), (0,-1), 3, AMBER),
    ]))
    return t

def fail_note(text):
    t = Table([[Paragraph(f'✗  <b>Expected failure:</b>  {text}', sFail)]],
              colWidths=[W - 3.6*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), RED_BG),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LINEBEFORE', (0,0), (0,-1), 3, RED),
    ]))
    return t

def table(headers, rows, col_widths=None, row_colors=None):
    data = [[Paragraph(h, sTH) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), sTD) if not isinstance(c, Paragraph) else c for c in row])
    cw = col_widths or [( W - 3.6*cm) / len(headers)] * len(headers)
    t = Table(data, colWidths=cw, repeatRows=1)
    style = [
        ('BACKGROUND', (0,0), (-1,0), NAVY),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LGREY]),
        ('GRID', (0,0), (-1,-1), 0.3, HexColor('#D1D5E8')),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('FONTSIZE', (0,0), (-1,-1), 8.5),
    ]
    if row_colors:
        for row_idx, col_idx, color in row_colors:
            style.append(('TEXTCOLOR', (col_idx, row_idx+1), (col_idx, row_idx+1), color))
            style.append(('FONTNAME',  (col_idx, row_idx+1), (col_idx, row_idx+1), 'Helvetica-Bold'))
    t.setStyle(TableStyle(style))
    return t

def tc_table(tc_id, title, preconditions, steps_list, expected, tc_type='positive'):
    """Test case block."""
    color = GREEN_BD if tc_type == 'positive' else RED_BD
    bg    = GREEN_BG if tc_type == 'positive' else RED_BG
    label = '✓ POSITIVE' if tc_type == 'positive' else '✗ NEGATIVE'
    full_w = W - 3.6*cm
    pre_text = '; '.join(preconditions)
    steps_text = '<br/>'.join([f'{i+1}. {s}' for i, s in enumerate(steps_list)])
    # Single-column layout: header row + 3 body rows
    data = [
        [Paragraph(f'<b>{tc_id}</b>  —  {title}  <font color="white" size="7">({label})</font>',
                   S('tch', fontSize=9, textColor=WHITE, fontName='Helvetica-Bold'))],
        [Paragraph(f'<b>Pre-conditions:</b>  {pre_text}',
                   S('tcp', fontSize=8, textColor=MGREY, fontName='Helvetica', leading=12))],
        [Paragraph(f'<b>Steps:</b><br/>{steps_text}',
                   S('tcv', fontSize=8, textColor=DARK, fontName='Helvetica', leading=13))],
        [Paragraph(f'<b>Expected:</b>  {expected}',
                   S('tcv2', fontSize=8, textColor=color, fontName='Helvetica-Bold', leading=13))],
    ]
    t = Table(data, colWidths=[full_w])
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,0),  color),
        ('BACKGROUND',    (0,1), (-1,1),  LGREY),
        ('BACKGROUND',    (0,2), (-1,2),  bg),
        ('BACKGROUND',    (0,3), (-1,3),  bg),
        ('GRID',          (0,0), (-1,-1), 0.3, HexColor('#D1D5E8')),
        ('LEFTPADDING',   (0,0), (-1,-1), 8),
        ('RIGHTPADDING',  (0,0), (-1,-1), 8),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('VALIGN',        (0,0), (-1,-1), 'TOP'),
    ]))
    return [t, Spacer(1, 6)]

# ══════════════════════════════════════════════════════════════════════════════
# BUILD DOCUMENT
# ══════════════════════════════════════════════════════════════════════════════
story = []
SP = lambda n=6: Spacer(1, n)

# ── COVER ──────────────────────────────────────────────────────────────────────
cover = Table(
    [[Paragraph('PMtool', sTitle)],
     [Paragraph('QA Testing Guide', S('cs', fontSize=16, textColor=MGREY, fontName='Helvetica', alignment=TA_CENTER))],
     [Paragraph('Comprehensive test plan — UI, functional, edge cases, positive & negative scenarios',
                S('cs2', fontSize=10, textColor=MGREY, fontName='Helvetica-Oblique', alignment=TA_CENTER, spaceAfter=8))],
     [Paragraph('Version 1.0  ·  May 2026  ·  For QA Engineer use only',
                S('cs3', fontSize=8, textColor=MGREY, fontName='Helvetica', alignment=TA_CENTER))]],
    colWidths=[W - 3.6*cm]
)
cover.setStyle(TableStyle([
    ('BACKGROUND',   (0,0), (-1,-1), NAVY),
    ('LEFTPADDING',  (0,0), (-1,-1), 20),
    ('RIGHTPADDING', (0,0), (-1,-1), 20),
    ('TOPPADDING',   (0,0), (0,0), 28),
    ('TOPPADDING',   (0,1), (-1,-1), 8),
    ('BOTTOMPADDING',(0,-1), (-1,-1), 28),
]))
story += [cover, SP(16)]

# Scope summary
scope_data = [
    ['Roles covered', 'Admin · Supervisor · Operator · QA'],
    ['Environments', 'Production: pmtool-3f8db.web.app  |  Local: localhost:3000'],
    ['Total sections', '10 sections · 60+ test cases'],
    ['Coverage', 'Login, RBAC, Operator flow, Admin tasks, Reports, Audit log, Edge cases, UI'],
]
st = Table([[Paragraph(k, S('sk', fontSize=8.5, textColor=MGREY, fontName='Helvetica-Bold')),
             Paragraph(v, S('sv', fontSize=8.5, textColor=DARK,  fontName='Helvetica'))]
            for k,v in scope_data], colWidths=[4*cm, W-7.6*cm])
st.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), LGREY),
    ('GRID', (0,0), (-1,-1), 0.3, HexColor('#D1D5E8')),
    ('LEFTPADDING', (0,0), (-1,-1), 8), ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
]))
story += [st, SP(8), PageBreak()]

# ── SECTION 1: TEST ACCOUNTS ───────────────────────────────────────────────────
story += h1('1. Test Accounts & Login URLs')
story += [body('Use the following accounts for testing. Passwords are set by the Admin — confirm with Chetan Patil before starting.'), SP(6)]

story += h2('1.1 Production Environment')
story += [body('URL: <b>https://pmtool-3f8db.web.app</b>'), SP(4)]
story.append(table(
    ['Role', 'Display Name', 'Email', 'Password', 'Login URL'],
    [
        [Paragraph('Admin', S('r', fontSize=8.5, textColor=INDIGO, fontName='Helvetica-Bold')),
         'Chetan Patil', 'chetan2321@gmail.com', '[your password]', '/admin/login'],
        [Paragraph('Supervisor', S('r', fontSize=8.5, textColor=VIOLET, fontName='Helvetica-Bold')),
         'Sneha Reddy', '[ask admin]', '[ask admin]', '/admin/login'],
        [Paragraph('Operator', S('r', fontSize=8.5, textColor=GREEN_BD, fontName='Helvetica-Bold')),
         'Amit Kumar', 'amit.kumar@pmtool.demo', '[ask admin]', '/login'],
        [Paragraph('Operator', S('r', fontSize=8.5, textColor=GREEN_BD, fontName='Helvetica-Bold')),
         'Satish Nikam', 'satish.nikam@pmtool.demo', '[ask admin]', '/login'],
        [Paragraph('Operator', S('r', fontSize=8.5, textColor=GREEN_BD, fontName='Helvetica-Bold')),
         'Test User', 'test@abc.com', '[ask admin]', '/login'],
        [Paragraph('QA', S('r', fontSize=8.5, textColor=HexColor('#92400E'), fontName='Helvetica-Bold')),
         'QA User', '[ask admin]', '[ask admin]', '/login'],
    ],
    col_widths=[2.2*cm, 3*cm, 5*cm, 2.8*cm, 2.8*cm]
))
story += [SP(8), warn('Always use Incognito / Private window when switching between roles. Stale session cookies will redirect you to a blank dashboard.'), SP(8)]

story += h2('1.2 Local Dev Environment (Emulator)')
story += [body('URL: <b>http://localhost:3000</b>  — requires emulators running. Run <font face="Courier">/pmtool-dev-ready</font> in Claude Code to start.'), SP(4)]
story.append(table(
    ['Role', 'Email', 'Password', 'Login URL'],
    [
        [Paragraph('Admin', S('r', fontSize=8.5, textColor=INDIGO, fontName='Helvetica-Bold')),
         'admin@pmtool.dev', 'Test1234!', '/admin/login'],
        [Paragraph('Supervisor', S('r', fontSize=8.5, textColor=VIOLET, fontName='Helvetica-Bold')),
         'supervisor@pmtool.dev', 'Test1234!', '/admin/login'],
        [Paragraph('Operator', S('r', fontSize=8.5, textColor=GREEN_BD, fontName='Helvetica-Bold')),
         'operator@pmtool.dev', 'Test1234!', '/login'],
        [Paragraph('QA', S('r', fontSize=8.5, textColor=HexColor('#92400E'), fontName='Helvetica-Bold')),
         'qa@pmtool.dev', 'Test1234!', '/login'],
    ],
    col_widths=[2.5*cm, 5.5*cm, 2.5*cm, 3*cm]
))
story += [SP(8), tip('Run all negative/edge case tests on the local emulator so you don\'t corrupt production data.'), SP(8), PageBreak()]

# ── SECTION 2: LOGIN TESTS ─────────────────────────────────────────────────────
story += h1('2. Login & Authentication Tests')
story += [body('Test login for all 4 roles. Each role has a different login page. Verify redirect after login is correct for each role.'), SP(6)]

story += h2('2.1 Positive Login Scenarios')
for item in [
    ('TC-L01', 'Admin login via /admin/login', ['Browser open, no session cookie'], ['Go to /admin/login', 'Enter admin email + password', 'Click Sign In'], 'Redirected to /dashboard. Sidebar shows: Dashboard, Workstations, Team, Reports, Audit Log.'),
    ('TC-L02', 'Supervisor login via /admin/login', ['Browser open, no session cookie'], ['Go to /admin/login', 'Enter supervisor email + password', 'Click Sign In'], 'Redirected to /dashboard. Sidebar shows same as admin.'),
    ('TC-L03', 'Operator login via /login', ['Browser open, no session cookie'], ['Go to /login', 'Enter operator email + password', 'Click Sign In'], 'Redirected to /operator. Sees their assigned workstation queue. No admin nav items visible.'),
    ('TC-L04', 'QA login via /login', ['Browser open, no session cookie'], ['Go to /login', 'Enter QA email + password', 'Click Sign In'], 'Redirected to /dashboard. Reports and read-only views accessible. No edit actions visible.'),
    ('TC-L05', 'Already-logged-in admin visits /login', ['Admin is logged in'], ['Navigate to /login directly'], 'Immediately redirected to /dashboard. Login form not shown.'),
    ('TC-L06', 'Already-logged-in operator visits /admin/login', ['Operator is logged in'], ['Navigate to /admin/login directly'], 'Immediately redirected to /operator (their home). Login form not shown.'),
    ('TC-L07', 'Browser remembers password', ['Chrome browser', 'First-time login on this browser'], ['Enter credentials and submit'], 'Browser prompts "Save password?" — accept and verify autofill works on next visit.'),
]:
    story += tc_table(*item)

story += [SP(6)]
story += h2('2.2 Negative Login Scenarios')
for item in [
    ('TC-L08', 'Wrong password', ['Go to /admin/login'], ['Enter correct email', 'Enter wrong password', 'Click Sign In'], 'Red error message shown: "Invalid email or password." No redirect.', 'negative'),
    ('TC-L09', 'Non-existent email', ['Go to /login'], ['Enter email that does not exist', 'Enter any password', 'Click Sign In'], '"Invalid email or password." shown. No account created.', 'negative'),
    ('TC-L10', 'Empty email field', ['Go to /login'], ['Leave email blank', 'Enter password', 'Click Sign In'], 'Form validation prevents submission. Email field highlighted.', 'negative'),
    ('TC-L11', 'Empty password field', ['Go to /login'], ['Enter email', 'Leave password blank', 'Click Sign In'], 'Form validation prevents submission.', 'negative'),
    ('TC-L12', 'Operator tries /admin/login', ['Operator account exists'], ['Go to /admin/login', 'Enter operator credentials'], 'Login succeeds (same Firebase Auth) but operator is redirected to /operator, not /dashboard. Role routing works correctly.', 'negative'),
    ('TC-L13', 'Direct URL to protected page while logged out', ['No session cookie'], ['Navigate directly to /dashboard', 'Navigate directly to /team', 'Navigate directly to /reports'], 'Each URL redirects to /login. No page content visible to unauthenticated user.', 'negative'),
    ('TC-L14', 'Operator navigates to /team', ['Logged in as Operator'], ['Type /team in address bar', 'Press Enter'], 'Redirected away — operator cannot access /team. Sent back to /operator.', 'negative'),
]:
    story += tc_table(*item)
story += [SP(8), PageBreak()]

# ── SECTION 3: OPERATOR FLOW ───────────────────────────────────────────────────
story += h1('3. Operator Workflow Tests')
story += [body('The Operator sees only their assigned workstation. Their primary job: view queued meters, fill the checklist, submit. Test the full happy path and all failure branches.'), SP(6)]

story += h2('3.1 Queue & Navigation')
for item in [
    ('TC-O01', 'Operator sees only their assigned station', ['Operator assigned to WS1'], ['Log in as operator', 'View the screen'], 'Operator page shows their station name (e.g. "WS1 — Incoming Inspection"). Queue shows meters at stage_01 only.'),
    ('TC-O02', 'Queue updates in real time', ['Two browser windows open — one admin, one operator'], ['Admin adds a new meter at operator\'s stage (via Firestore console or seed script)', 'Watch operator screen'], 'New meter appears in operator queue within 2 seconds without any page refresh.'),
    ('TC-O03', 'Empty queue shows friendly state', ['Operator assigned to a station with no meters'], ['Log in as operator'], '"Queue is clear" empty state shown with a checkmark icon. No error, no blank space.'),
    ('TC-O04', 'Machine status display', ['Operator at WS5'], ['Log in as operator', 'Note the machine status badge'], 'Machine status (Green/Yellow/Red) shown correctly. Matches what was set.'),
]:
    story += tc_table(*item)

story += [SP(6)]
story += h2('3.2 Submitting a Pass Result')
for item in [
    ('TC-O05', 'Submit all-pass checklist', ['Operator logged in', 'At least 1 meter in queue'], ['Click on a meter from the queue', 'Set all parameters to Pass', 'Enter numeric values where required', 'Click Submit'], 'Success state shown. Meter disappears from queue. Meter advances to next stage in Firestore.'),
    ('TC-O06', 'Meter moves to next stage after pass', ['TC-O05 completed'], ['Check Firestore or workstation page for the meter'], 'Meter currentStageId incremented to next stage. It now appears in the queue of the next workstation.'),
    ('TC-O07', 'Submit with comment (optional)', ['Meter open for submission'], ['Fill all parameters as Pass', 'Add a comment in the comment box', 'Submit'], 'Submission succeeds. Comment saved in stageHistory entry. Visible in stage history view.'),
]:
    story += tc_table(*item)

story += [SP(6)]
story += h2('3.3 Submitting a Rework (Fail) Result')
for item in [
    ('TC-O08', 'Mark one parameter as Fail → rework', ['Meter open'], ['Set at least one parameter to Fail', 'Remaining as Pass', 'Click Submit'], 'Rework options appear: "Send back to which stage?" dropdown. Submit button changes to "Submit Rework".'),
    ('TC-O09', 'Complete rework submission with comment', ['TC-O08 in progress'], ['Choose rework target stage', 'Add a mandatory comment explaining the failure', 'Click Submit Rework'], 'Meter disappears from current queue. reworkCount incremented by 1. Meter re-appears at the target stage queue.'),
    ('TC-O10', 'Rework without comment blocked', ['Rework flow triggered'], ['Choose rework stage', 'Leave comment blank', 'Attempt to submit'], 'Submission blocked. Comment field highlighted as required.', 'negative'),
    ('TC-O11', 'Multiple parameters fail', ['Meter open'], ['Set 3 of 5 parameters to Fail', 'Submit'], 'failedCount=3 recorded in stageHistory. overallResult=REWORK. All failed parameter names saved in lastFailedParams.'),
]:
    story += tc_table(*item)

story += [SP(6)]
story += h2('3.4 Edge Cases — Operator')
for item in [
    ('TC-O12', 'Submit with no numeric value entered', ['Parameter requires a numeric reading'], ['Toggle parameter to Pass', 'Leave numeric field empty', 'Attempt submit'], 'Blocked — numeric field required before submission.', 'negative'),
    ('TC-O13', 'Page refresh mid-form', ['Operator has partially filled checklist'], ['Fill 3 of 5 parameters', 'Refresh the page (F5)'], 'Draft is preserved (localStorage or Firestore draft). Operator can continue from where they left off.'),
    ('TC-O14', 'Two operators, same station', ['Two operator accounts assigned to same WS'], ['Log both in simultaneously', 'Both open the same meter'], 'Both can see the meter. First to submit wins. Second to submit should see the meter is already gone from their queue.'),
    ('TC-O15', 'Operator at WS1 — stage_01 is first stage', ['Operator at WS1'], ['Submit pass for a meter'], 'No "previous stage" shown. Rework target defaults to stage_01 itself. No crash.'),
    ('TC-O16', 'Operator at WS13 — last stage pass', ['Meter at final stage', 'Operator at WS13'], ['Submit all-pass for a meter at stage_13'], 'Meter status changes to "done". completedAt timestamp set. Meter no longer appears in any queue.'),
]:
    story += tc_table(*item)
story += [SP(8), PageBreak()]

# ── SECTION 4: ADMIN FLOW ──────────────────────────────────────────────────────
story += h1('4. Admin & Supervisor Tests')
story += [body('Admins have full user management. Supervisors can reset passwords. Both can view all reports and monitor workstations.'), SP(6)]

story += h2('4.1 User Management — Admin')
for item in [
    ('TC-A01', 'Create a new operator', ['Logged in as Admin', 'Team page open'], ['Click Add User', 'Fill: Name=QA Test Op, Email=qatest@pmtool.demo, Role=Operator, Password=Test1234!', 'Click Create User'], 'User appears in Team table immediately. Firebase Auth user created. Firestore /users doc created.'),
    ('TC-A02', 'New user can log in immediately', ['TC-A01 completed'], ['Open incognito window', 'Go to /login', 'Log in with qatest@pmtool.demo / Test1234!'], 'Login succeeds. Operator lands on /operator with empty queue (no station assigned yet).'),
    ('TC-A03', 'Edit user — change role', ['Admin on Team page', 'Operator user exists'], ['Click Edit on an operator', 'Change role to QA', 'Save'], 'Role updated in table. User\'s next login reflects QA permissions. Custom claim updated.'),
    ('TC-A04', 'Edit user — assign workstation', ['Admin on Team page'], ['Click Edit on an operator', 'Select a workstation from dropdown', 'Save'], 'Workstation shown in WORKSTATION column. Operator now sees that station\'s queue on next login.'),
    ('TC-A05', 'Reset password', ['Admin on Team page'], ['Click Reset Password on any user', 'Confirm dialog', 'Click Reset'], 'New temporary password displayed once. Audit log entry PASSWORD_RESET created. User can log in with new password.'),
    ('TC-A06', 'Delete user', ['Admin on Team page', 'Non-admin user exists'], ['Click Delete on a user', 'Confirm with "Yes, Delete Permanently"'], 'User removed from table. Firebase Auth account deleted. Firestore /users doc deleted. Audit log USER_DELETED entry created.'),
]:
    story += tc_table(*item)

story += [SP(6)]
story += h2('4.2 Negative — Admin Restrictions')
for item in [
    ('TC-A07', 'Admin cannot delete themselves', ['Logged in as Admin', 'Team page'], ['Locate own row in Team table'], 'Delete button is absent from own row. Cannot self-delete.', 'negative'),
    ('TC-A08', 'Create user with duplicate email', ['Admin on Team page'], ['Click Add User', 'Enter email that already exists in system', 'Submit'], 'Error shown: email already in use. No duplicate created.', 'negative'),
    ('TC-A09', 'Create user with weak password', ['Admin on Add User form'], ['Enter password shorter than 6 characters', 'Submit'], 'Validation error shown. User not created.', 'negative'),
    ('TC-A10', 'Supervisor cannot create users', ['Logged in as Supervisor', 'Team page'], ['Look for Add User button'], 'Add User button is not visible. Supervisor sees the table but no create option.', 'negative'),
    ('TC-A11', 'Supervisor can reset password', ['Logged in as Supervisor', 'Team page'], ['Click Reset Password on any operator', 'Confirm'], 'Reset succeeds. New password shown. Audit log entry created.'),
    ('TC-A12', 'Supervisor cannot delete users', ['Logged in as Supervisor', 'Team page'], ['Look for Delete button'], 'Delete button not visible for Supervisor role.', 'negative'),
]:
    story += tc_table(*item)
story += [SP(8), PageBreak()]

# ── SECTION 5: WORKSTATION MONITORING ─────────────────────────────────────────
story += h1('5. Workstation Monitoring Tests')
story += [body('The Workstations page shows all 13 stations in a card grid. Admin/Supervisor see it as read-only. Operators see their own station only.'), SP(6)]

for item in [
    ('TC-W01', 'Admin sees all 13 workstation cards', ['Logged in as Admin'], ['Navigate to Workstations'], '13 cards shown, one per stage (WS1–WS13). Each shows station name, WS number eyebrow, queue count.'),
    ('TC-W02', 'Machine status colour on card', ['At least one station has status set'], ['View Workstations page'], 'Card left border matches status: green=running, yellow=attention, red=down. Card background has subtle matching tint.'),
    ('TC-W03', 'Queue count badge is accurate', ['Known number of meters at a stage'], ['Compare card queue badge to Firestore meter count'], 'Badge number matches actual meters in queued/rework status at that stage.'),
    ('TC-W04', 'Click queue badge — see meter list', ['Admin viewing Workstations'], ['Click on a queue count badge'], 'Drawer or modal opens showing list of meter serial numbers at that station.'),
    ('TC-W05', 'Conflict warning on double-assign', ['Admin editing operator assignment'], ['Assign an operator who is already assigned to another station'], 'Amber warning banner appears: "Already assigned to WS[X]". Admin must acknowledge before saving.'),
    ('TC-W06', 'Admin/Supervisor view is read-only', ['Logged in as Admin or Supervisor'], ['Open Workstations page', 'Try to submit a quality check'], 'No Submit button visible. Machine status shown as text, not an editable control (or grayed out).'),
    ('TC-W07', 'Operator sees only their station', ['Logged in as Operator assigned to WS3'], ['Navigate to any page'], 'Operator page shows only WS3 queue. Cannot navigate to /workstations (redirected to /operator).', 'negative'),
]:
    story += tc_table(*item)
story += [SP(8), PageBreak()]

# ── SECTION 6: REPORTS TESTS ───────────────────────────────────────────────────
story += h1('6. Reports Tests')
story += [body('Three report tabs: Production, Failure History, Tamper Test. All filterable. All export to CSV. Use the seeded demo data (SNE-2026-00101 to SNE-2026-00312) for predictable test results.'), SP(4)]
story += [tip('Demo serial numbers: SNE-2026-00101→00110 (completed clean), SNE-2026-00201→00205 (rework history), SNE-2026-00301→00312 (in progress).'), SP(6)]

story += h2('6.1 Production Report')
for item in [
    ('TC-R01', 'Production report shows completed meters', ['Logged in as Admin', 'Demo data seeded'], ['Go to Reports → Production tab', 'Set date range: last 7 days'], 'At least 12 rows shown (SNE-2026-00101 to 00110 + 00204 + 00205). Each row has serial number, meter type, completed date, rework count.'),
    ('TC-R02', 'Filter by date range', ['Production report open'], ['Set From date to yesterday', 'Set To date to today', 'Apply'], 'Only meters completed in that range appear. Count changes accordingly.'),
    ('TC-R03', 'Quick preset — Today', ['Production report open'], ['Click "Today" preset'], 'Date range auto-fills to today. Table filters to today\'s completions only.'),
    ('TC-R04', 'Export to CSV', ['Production report with data'], ['Click Export CSV'], 'CSV file downloaded. Open in Excel — columns match table headers. All visible rows present.'),
    ('TC-R05', 'No results shows empty state', ['Production report open'], ['Set date range to a future date (no completions possible)'], 'Empty state shown — no crash, no spinner stuck. Message like "No records found for the selected filters."'),
]:
    story += tc_table(*item)

story += [SP(6)]
story += h2('6.2 Failure History Report')
for item in [
    ('TC-R06', 'Failure history shows rework entries', ['Demo data seeded'], ['Go to Reports → Failure History tab'], 'Rows for SNE-2026-00201 (Functional Testing failure), SNE-2026-00202 (Error Compensation), SNE-2026-00203 (Tamper Test) visible.'),
    ('TC-R07', 'Filter by stage', ['Failure History tab open'], ['Select "Functional Testing" from stage filter', 'Apply'], 'Only rows where stageId=stage_05 shown. Other stage failures hidden.'),
    ('TC-R08', 'Failed parameters shown per row', ['Failure History tab with data'], ['Expand or view a failure row'], 'Failed parameter names listed (e.g. "Display Check, Accuracy Test"). Comment from operator visible.'),
    ('TC-R09', 'Meter with rework-then-pass appears once', ['SNE-2026-00204 in demo data (rework then completed)'], ['View Failure History'], 'SNE-2026-00204 appears in Failure History (the failed attempt). It also appears in Production Report (the completed record). Both are correct.'),
]:
    story += tc_table(*item)

story += [SP(6)]
story += h2('6.3 Tamper Test Report')
for item in [
    ('TC-R10', 'Tamper test report shows WS8 results', ['Demo data seeded'], ['Go to Reports → Tamper Test tab'], 'Rows for meters that passed through WS8 shown. SNE-2026-00203 shows FAIL (in rework), SNE-2026-00205 shows PASS (after rework).'),
    ('TC-R11', 'Per-parameter columns visible', ['Tamper Test tab open'], ['View table columns'], 'Five columns: Magnetic Tamper, Neutral Tamper, Cover Open Tamper, Reverse Connection, Earth Tamper. Each shows Pass/Fail per row.'),
    ('TC-R12', 'QA role can access all reports', ['Logged in as QA'], ['Navigate to Reports', 'Open all three tabs'], 'All three tabs accessible. Data visible. No edit or submit controls shown.'),
    ('TC-R13', 'Operator cannot access reports', ['Logged in as Operator'], ['Navigate to /reports directly'], 'Redirected away. Reports not accessible to operator role.', 'negative'),
]:
    story += tc_table(*item)
story += [SP(8), PageBreak()]

# ── SECTION 7: AUDIT LOG ───────────────────────────────────────────────────────
story += h1('7. Audit Log Tests')
story += [body('The Audit Log is write-once. Every admin action is captured automatically. QA should verify entries appear, are accurate, and cannot be tampered with.'), SP(6)]

for item in [
    ('TC-AU01', 'User creation logged', ['Admin just created a new user (TC-A01)'], ['Go to Audit Log'], 'Entry with action=USER_CREATED, actorUid=admin\'s UID, target user details in "after" field. Timestamp accurate.'),
    ('TC-AU02', 'Password reset logged', ['Admin just reset a password (TC-A05)'], ['Go to Audit Log'], 'Entry with action=PASSWORD_RESET shown. Actor is the admin. Target user name and email in after field.'),
    ('TC-AU03', 'User deletion logged', ['Admin just deleted a user (TC-A06)'], ['Go to Audit Log'], 'Entry with action=USER_DELETED. Before field contains the deleted user\'s name, email, role.'),
    ('TC-AU04', 'Filter by action type', ['Audit Log page with multiple entry types'], ['Select "Password Reset" from action filter'], 'Only PASSWORD_RESET entries shown.'),
    ('TC-AU05', 'Filter by date range', ['Audit Log open'], ['Set From/To date range'], 'Only entries within that date range shown.'),
    ('TC-AU06', 'Clear filters resets table', ['Filters applied'], ['Click Clear'], 'All filters reset. Full log shown.'),
    ('TC-AU07', 'Audit log cannot be deleted via UI', ['Logged in as Admin', 'Audit Log page'], ['Try to find a delete button on audit entries'], 'No delete button exists on any audit log entry.', 'negative'),
]:
    story += tc_table(*item)
story += [SP(8), PageBreak()]

# ── SECTION 8: UI TESTS ────────────────────────────────────────────────────────
story += h1('8. UI & Visual Tests')
story += [body('Verify visual consistency, responsiveness, and accessibility across all screens.'), SP(6)]

story += h2('8.1 Layout & Navigation')
story.append(table(
    ['Test', 'Check', 'Pass Condition'],
    [
        ['Sidebar renders correctly', 'All nav items visible for admin', 'Dashboard, Workstations, Team, Reports, Audit Log all shown with icons'],
        ['Active nav item highlighted', 'Click each nav item', 'Active item has distinct background. Others not highlighted'],
        ['Sidebar collapses on small screens', 'Resize browser to 768px width', 'Sidebar collapses or hides. Content area expands'],
        ['User name shown in sidebar', 'Log in as any role', 'Display name shown at bottom of sidebar. Role badge visible'],
        ['Sign out button works', 'Click Sign Out', 'Session cleared. Admin→/admin/login, Operator→/login'],
        ['Logo/brand visible', 'Any page', 'PMtool brand visible in sidebar top'],
        ['Page title in browser tab', 'Navigate between pages', 'Browser tab title reflects current page'],
    ],
    col_widths=[4*cm, 5.5*cm, 7*cm]
))

story += [SP(8)]
story += h2('8.2 Workstation Cards — Visual')
story.append(table(
    ['Element', 'Expected Behaviour'],
    [
        ['WS number eyebrow', 'Small uppercase label e.g. "WS1" above the station name'],
        ['Station name', 'Larger, bold. No [WSx] bracket prefix in the name'],
        ['Left border colour', 'Green=running, Yellow=attention, Red=down, Grey=no status'],
        ['Card background tint', 'Subtle matching tint (4% opacity) matching border colour'],
        ['Queue badge', 'Shows count. Clickable. Opens meter list'],
        ['Rework badge', 'Amber pill shows rework count if > 0'],
        ['No queue state', '"No Queue" grey pill when count is 0'],
        ['Operator dropdown (Admin)', 'Shows current operator. Read-only for admin/supervisor'],
    ],
    col_widths=[5*cm, 11.4*cm]
))

story += [SP(8)]
story += h2('8.3 Forms & Validation')
story.append(table(
    ['Form', 'Field', 'Validation to test'],
    [
        ['Login', 'Email', 'Required, must be valid email format'],
        ['Login', 'Password', 'Required, browser autocomplete works'],
        ['Add User', 'Email', 'Required, valid format, unique in system'],
        ['Add User', 'Password', 'Min 6 characters'],
        ['Add User', 'Role', 'Required dropdown — cannot submit without selection'],
        ['QC Checklist', 'Numeric value', 'Required when parameter is toggled to Pass'],
        ['QC Checklist', 'Comment on rework', 'Required when overallResult is REWORK'],
        ['Reset Password dialog', 'Confirmation', 'Requires explicit click — no accidental submit'],
        ['Delete User dialog', 'Confirmation', '"Yes, Delete Permanently" button — distinct red colour'],
    ],
    col_widths=[3*cm, 3.5*cm, 9.9*cm]
))

story += [SP(8)]
story += h2('8.4 Responsive / Cross-Browser')
story.append(table(
    ['Browser / Device', 'Test', 'Expected'],
    [
        ['Chrome (desktop)', 'Full flow — login to submit', 'All features work'],
        ['Safari (desktop)', 'Full flow — login to submit', 'All features work. Backdrop-filter blur renders'],
        ['Chrome (mobile)', 'Login + view queue', 'Layout adapts. No horizontal scroll'],
        ['Safari (iPhone)', 'Login + view queue', 'Touch targets adequate. No layout breaks'],
        ['Firefox (desktop)', 'Login + basic navigation', 'Core flow works. Blur may not render (acceptable)'],
        ['Incognito mode', 'Full login flow', 'Works without cached data interference'],
    ],
    col_widths=[4.5*cm, 5.5*cm, 6.4*cm]
))
story += [SP(8), PageBreak()]

# ── SECTION 9: EDGE CASES ──────────────────────────────────────────────────────
story += h1('9. Edge Cases & Boundary Tests')
story += [body('These tests probe boundary conditions, concurrent actions, and unexpected user behaviours.'), SP(6)]

story += h2('9.1 Session & Auth Edge Cases')
for item in [
    ('TC-E01', 'Session expires after 5 days', ['User logged in', 'Wait 5 days OR manually expire cookie'], ['After expiry, navigate to any dashboard page'], 'Redirected to login. No stale data shown.'),
    ('TC-E02', 'Open duplicate tab — same session', ['Admin logged in on Tab 1'], ['Open Tab 2, navigate to /dashboard'], 'Tab 2 shows dashboard normally. Same session shared. No double login required.'),
    ('TC-E03', 'Log out on one tab — what happens on other', ['Admin logged in on Tab 1 and Tab 2'], ['Sign out on Tab 1', 'Switch to Tab 2, click any nav item'], 'Tab 2 detects session ended and redirects to login on next navigation. No error page.'),
    ('TC-E04', 'Back button after logout', ['User just signed out'], ['Press browser back button'], 'Stays on login page or redirects back to login. Protected page not accessible.', 'negative'),
    ('TC-E05', 'Role changed while user is logged in', ['Admin changes operator\'s role to QA while operator is in a session'], ['Operator navigates to a new page'], 'On next page navigation, new role permissions apply. Old role access removed.'),
]:
    story += tc_table(*item)

story += [SP(6)]
story += h2('9.2 Data Edge Cases')
for item in [
    ('TC-E06', 'Meter at last stage (WS13) rework target', ['Meter at stage_13'], ['Trigger a failure at stage_13', 'Check rework target options'], 'Rework target includes stage_13 itself and all prior stages. No crash. No "stage_14" appears.'),
    ('TC-E07', 'Meter with reworkCount > 1', ['Same meter failed and reworked twice'], ['View meter in Workstation queue', 'Check stage history'], 'reworkCount=2 displayed. Stage history shows both failure attempts with attemptNumber=1 and 2.'),
    ('TC-E08', 'Serial number with special characters', ['New meter creation'], ['Enter serial number with spaces or hyphens: "SN 2026/001"'], 'Meter created successfully. Special characters stored and displayed correctly.'),
    ('TC-E09', 'Very long operator name', ['User with 50-char display name'], ['Assign to workstation', 'View workstation card'], 'Name truncates gracefully in UI. No layout overflow or broken card.'),
    ('TC-E10', 'Large queue (50+ meters at one station)', ['50 meters seeded at stage_01'], ['Operator logs in', 'Admin views workstation card'], 'Queue count badge shows correct number. Operator queue scrolls. No performance crash.'),
    ('TC-E11', 'Concurrent submit — same meter', ['Two operators, same station, same meter open'], ['Both click Submit simultaneously'], 'First submission succeeds. Second should either fail gracefully or find the meter already moved.'),
]:
    story += tc_table(*item)
story += [SP(8), PageBreak()]

# ── SECTION 10: TEST CHECKLIST ─────────────────────────────────────────────────
story += h1('10. Pre-Release Sign-Off Checklist')
story += [body('Run through this checklist before declaring a build release-ready. Each item must be checked on the production environment in a clean Incognito window.'), SP(8)]

checklist_items = [
    ('Authentication', [
        'Admin can log in via /admin/login',
        'Supervisor can log in via /admin/login',
        'Operator can log in via /login',
        'QA can log in via /login',
        'Wrong password shows error (no crash)',
        'Unauthenticated /dashboard redirects to /login',
        'Unauthenticated /team redirects to /login',
    ]),
    ('Operator Flow', [
        'Operator sees their assigned station queue',
        'Operator can open a meter and fill the checklist',
        'All-pass submit moves meter to next stage',
        'Fail submit shows rework stage picker',
        'Rework without comment is blocked',
        'Meter reworkCount increments correctly',
        'Empty queue shows friendly empty state',
    ]),
    ('Admin Tasks', [
        'Admin can create a new user',
        'New user can log in immediately',
        'Admin can reset a password — new password works',
        'Password reset creates audit log entry',
        'Admin can delete a user — audit log entry created',
        'Admin cannot delete themselves',
        'Supervisor cannot create/delete users',
        'Supervisor can reset passwords',
    ]),
    ('Workstations', [
        'All 13 station cards visible to admin',
        'Card border colour matches machine status',
        'Queue badge count is accurate',
        'WS number eyebrow label shown correctly',
        'Station name has no [WSx] bracket prefix',
        'Conflict warning shown on double-assign',
    ]),
    ('Reports', [
        'Production report shows completed meters',
        'Date filter works correctly',
        'Quick preset (Today, 7d, 30d) auto-fills date',
        'Failure history shows rework entries with failed params',
        'Tamper test shows per-parameter pass/fail',
        'CSV export downloads and opens correctly',
        'Clear filters resets to full data',
        'QA role can access all reports',
        'Operator cannot access reports',
    ]),
    ('Audit Log', [
        'USER_CREATED entry exists after creating user',
        'PASSWORD_RESET entry exists after reset',
        'USER_DELETED entry exists after deletion',
        'Filter by action type works',
        'Filter by date range works',
        'No delete/edit button on any audit entry',
    ]),
    ('UI & Visual', [
        'Glassmorphism cards render (not plain white)',
        'Gradient background visible on all pages',
        'Sidebar nav items have icons',
        'Active nav item highlighted',
        'Sign out redirects to correct login page per role',
        'Mobile layout does not break on 390px width',
        'No console errors on any page',
        'No blank white screens on any route',
    ]),
]

for section, items in checklist_items:
    data = [[Paragraph(f'☐  {item}', sBody)] for item in items]
    ct = Table(
        [[Paragraph(section, S('csh', fontSize=10, textColor=WHITE, fontName='Helvetica-Bold'))]]
        + data,
        colWidths=[W - 3.6*cm]
    )
    ct.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,0),  INDIGO),
        ('BACKGROUND',   (0,1), (-1,-1), LGREY),
        ('ROWBACKGROUNDS',(0,1),(-1,-1), [WHITE, LGREY]),
        ('GRID',         (0,0), (-1,-1), 0.3, HexColor('#D1D5E8')),
        ('LEFTPADDING',  (0,0), (-1,-1), 10),
        ('TOPPADDING',   (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0), (-1,-1), 5),
    ]))
    story += [ct, SP(8)]

story += [SP(12)]

# Sign-off table
signoff = Table(
    [[Paragraph('QA Sign-Off', S('so', fontSize=11, textColor=WHITE, fontName='Helvetica-Bold'))],
     [Table([
         [Paragraph('Tested by:', sTD), Paragraph('_' * 40, sTD)],
         [Paragraph('Date:', sTD), Paragraph('_' * 40, sTD)],
         [Paragraph('Build / Version:', sTD), Paragraph('_' * 40, sTD)],
         [Paragraph('Overall result:', sTD), Paragraph('☐  Pass     ☐  Pass with issues     ☐  Fail', sTD)],
         [Paragraph('Notes:', sTD), Paragraph('_' * 40, sTD)],
     ], colWidths=[3.5*cm, W - 7.1*cm])]],
    colWidths=[W - 3.6*cm]
)
signoff.setStyle(TableStyle([
    ('BACKGROUND',   (0,0), (-1,0), NAVY),
    ('BACKGROUND',   (0,1), (-1,1), LGREY),
    ('LEFTPADDING',  (0,0), (-1,-1), 10),
    ('TOPPADDING',   (0,0), (-1,-1), 8),
    ('BOTTOMPADDING',(0,0), (-1,-1), 8),
    ('GRID',         (0,0), (-1,-1), 0.3, HexColor('#D1D5E8')),
]))
story.append(signoff)

# ── BUILD ──────────────────────────────────────────────────────────────────────
doc.build(story)
print(f'\n✅  QA Guide saved to:\n   {OUTPUT}')
print(f'\n   Sections: 10')
print(f'   Test cases: 60+')
print(f'   Includes: login tests, operator flow, admin flow, workstation, reports, audit log, UI, edge cases, sign-off checklist')
