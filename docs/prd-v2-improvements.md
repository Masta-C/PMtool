# PRD — V2 Improvements
**Status:** Defined  
**Date:** 2026-05-19  
**Author:** Chetan Patil  
**Source:** Phase 2 grill-me session (18 questions resolved)

---

## Overview

V2 is a focused improvement pass on the Phase 1 shop floor execution system. It tightens the nav, corrects failure attribution, improves the dashboard with richer analytics, and gives operators real-time status signalling. No new core workflows — refinement and operational clarity.

---

## 1. Global: Failure Attribution Change

**Current behaviour:** Failure is attributed to the station that *identified* the error (e.g. Functional Testing catches a defect → Functional Testing owns the failure).

**V2 behaviour:** Failure is attributed to the **station tagged for rework** — the station where the defect originated.

**Rules:**
- Every rework tag = 1 failure, regardless of whether it was corrected afterwards
- Corrected reworks still count permanently in all failure metrics
- This definition applies everywhere: Failure Rate Today card, Station vs Failure Rate chart, Operator vs Failure Rate chart, Reports

---

## 2. Navigation Restructure

**New nav order (5 items):**
1. Dashboard
2. Workstations
3. Team
4. Reports
5. Audit Log

**Removed from nav:**
- Queue (merged into Reports)
- Reports (old standalone — replaced by new tabbed Reports)
- Products
- Workforce (merged into Team)
- Settings
- Rework (standalone route `/rework` retired — lives inside Reports)

**Role change:** `super_admin` role eliminated, merged into `admin`. Roles: Admin, Supervisor, Operator, QA.

---

## 3. Dashboard

### 3.1 Metric Cards (Row 1) — unchanged layout, updated failure logic
- **Committed** — target for today
- **Completed Today** — meters that cleared the final station
- **Throughput / hr** — meters completed per hour
- **Failure Rate Today** — uses new rework-tagged attribution (format: `X% — N of M submissions`)

### 3.2 Charts (Row 2) — side by side
**Left — Meters In Progress by Station**
- Keep existing horizontal bar chart
- Station names prefixed: `[WS1] Station Name`, `[WS2] Station Name`, etc.

**Right — Station vs Failure Rate**
- Keep existing horizontal bar chart
- Station names prefixed: `[WS1]`, `[WS2]`, etc.
- Add **Day / Month** toggle (rolling windows relative to current date)
- Remove the duplicate table below the chart

### 3.3 Charts (Row 3) — side by side, below Row 2
**Left — Operator vs Failure Rate**
- New horizontal bar chart
- Y-axis: operator names
- X-axis: raw failed count (not %)
- All operators with submissions in the selected period, sorted descending
- **Day / Month** toggle

**Right — Throughput Line Graph**
- New line graph
- X-axis: dates
- Y-axis: meters completed per day (final station exits)
- Default period: Month view
- **Day / Month** toggle

### 3.4 Refresh Controls
- Top-right of Dashboard: `Last refreshed: N min ago` label + **Refresh** button
- Clicking Refresh re-fetches all dashboard data in one shot (all cards + all charts)
- Timer counts up from last fetch, updates every minute
- **No auto-refresh in V2** — Phase 3 consideration with minimum 5-min interval

---

## 4. Workstations

### 4.1 Station Card Labels
- Station names prefixed with `[WS1]`, `[WS2]`, etc. across all views

### 4.2 Dual Status Badges
- A station card can show both **Queue** and **Rework** badges simultaneously if both exist
- Clicking **Queue badge** → modal showing queued order details
- Clicking **Rework badge** → modal showing rework order details

**Modal contents (both):** Order #, Meters, Date queued/tagged, Operator name  
Read-only / informational. No navigation from modal.

### 4.3 Machine Status Accent (operator-driven)
Station card accent color reflects current machine/operator status:
- **Green** — machine running (uptime)
- **Yellow** — on break
- **Red** — breakdown / stoppage

**Rules:**
- Status set by operator from their UI — explicit selection
- Persists until operator manually changes it
- No auto-reset, no timeouts
- Supervisor can observe stuck Yellow/Red stations visually

### 4.4 Operator Dropdown
- Operator selection dropdown on station cards shows **operator names** (not IDs)

### 4.5 Date Range Selection (replaces Start Day tab)
- Start Day tab removed entirely
- When assigning an operator to a station, show quick-select: **Today / Month**
- Selection is a rolling window relative to the current date
- Resets at the start of each new day — operator must re-select each day
- Default = no selection until operator picks

---

## 5. Team (was: Users + Workforce)

- **Rename** `Users` → `Team` in nav
- **Remove** `Workforce` as a separate nav item — functionality merged into Team

### 5.1 Create User Form
| Field | Behaviour |
|---|---|
| Operator Name | Free text, single full name, required |
| Email | Required |
| Role | Dropdown: Admin / Supervisor / Operator / QA |
| Password | Auto-generated, displayed once on creation |
| Op ID | Auto-generated on save, displayed read-only — not editable |

### 5.2 Team Table
- **Workstation column** — real-time, pulled from workstation assignment data
  - Shows `[WS#] Station Name` if assigned
  - Shows `—` if unassigned
  - Read-only in Team tab (assignment happens in Workstations)

---

## 6. Reports (tabbed, replaces Queue + old Reports)

Single nav item `Reports` with 3 tabs:

### Tab 1 — Production
Filterable table of all production runs.

**Filters:** Station `[WS#]`, Date range, Operator, Result (pass/fail), Rework result  
**Actions:** CSV export  
**Includes** all data previously split across Queue and old Reports

### Tab 2 — Rework
Active rework items that have **not yet been re-submitted and passed**.

**Columns:** Order #, Tagged Station `[WS#]`, Operator, Date Tagged, Status (pending / in-correction)  
**Note:** Items here still count as failures in all metrics — resolution does not undo failure count.

### Tab 3 — QA
Existing QE reports content carried forward:
- Failure history
- Tamper Test reports

---

## 7. Audit Log

No changes. Full functionality carried forward as-is.

---

## 8. Phase 3 Considerations (out of scope for V2)

- Auto-refresh on Dashboard with configurable interval (minimum 5 min)
- Auto-updating data in Reports (deferred to control Firestore query costs)
- Clickable order numbers in Rework/Queue modals navigating to detail view

---

## Query Cost Notes

- Manual refresh + Day/Month toggles = operator-controlled read frequency
- Auto-refresh at 30s = ~1,000+ Firestore reads/hour on dashboard alone
- Manual refresh = ~50–80 reads/hour — 10-20x reduction
- Toggle switches (Day/Month) fire new queries on each change — expected and acceptable
