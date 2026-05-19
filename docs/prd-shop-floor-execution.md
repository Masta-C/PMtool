# PRD — Shop Floor Execution System (Phase 1)

## Problem Statement

Meter manufacturing on the factory floor is tracked manually or through disconnected systems. Operators at each of 13 production stages have no unified interface to record inspection results, and supervisors have no real-time visibility into where each meter is in the process. When a meter fails a stage, there is no structured rework flow — meters get physically moved without a digital trail. Reporting on daily output, failure rates, and station throughput requires manual aggregation. On a shop floor where operators have limited time and often low digital literacy, any system that requires reading-heavy interfaces or complex workflows will simply not be used.

## Solution

A visual-first PWA that tracks every individual meter through 13 sequential production stages. Operators interact with large, colour-coded screens to record parameter results and submit or flag meters for rework. Supervisors manage daily setup and monitor production in real time via a station board. Admins upload the day's work via Excel and access reports with export. Every state change is audit-logged. The app is deployed live on Firebase Hosting and runs offline on factory floor tablets.

## User Stories

### Operator

1. As an operator, I want to see only the meters queued at my assigned station, so that I am not distracted by work at other stations.
2. As an operator, I want to be notified visually when a draft is already saved for a meter at my station, so that I can resume without losing progress.
3. As an operator, I want to scan a QR code or type a serial number to open a meter's stage form, so that I don't waste time searching.
4. As an operator, I want to enter a value and set OK / NOT OK / REMARK for each parameter using large colour-coded buttons, so that I can work fast without reading instructions.
5. As an operator, I want to save a draft mid-way through a stage, so that I can step away and return without losing my inputs.
6. As an operator, I want to submit a stage once all parameters are filled, so that the meter automatically moves to the next station's queue.
7. As an operator, I want the system to warn me with a popup and ask for a comment when I try to submit or save draft with any NOT OK parameters, so that failures are never silently passed.
8. As an operator, I want to flag a meter for rework and tag it to any previously completed station, so that the right station gets it back in their queue.
9. As an operator at the rework-receiving station, I want to see rework items in my queue with a visual indicator, so that I know to action them.
10. As an operator at the rework-receiving station, I want to explicitly accept a rework item before it activates, so that I acknowledge responsibility for it.
11. As an operator at Stage 1, I want to see the list of meters loaded for today from the Excel upload in a dropdown, so that I can start work without re-entering data.
12. As an operator at Stage 1, I want to create a new meter record if it is not in today's list, so that ad-hoc meters are not blocked.
13. As an operator at the Tamper Test stage, I want a radio button to indicate whether this meter will undergo Tamper Test, so that I only see the Tamper Test parameters when needed.

### Supervisor

14. As a supervisor, I want to see all 13 station cards on one screen colour-coded by queue status (red = empty, yellow = rework present, green = normal), so that I can spot bottlenecks instantly without reading tables.
15. As a supervisor, I want to tap a station card and see its current queue and assigned operator, so that I can quickly assess production status.
16. As a supervisor, I want to reassign a meter stuck in a queue to a different station, so that I can unblock production without manual intervention.
17. As a supervisor, I want to override a failed stage with a comment, so that I can handle borderline cases that don't warrant full rework.
18. As a supervisor, I want to see real-time metrics for the day (in-progress by station, failure rate, completed, throughput), so that I can make decisions on the floor.

### Admin

19. As an admin, I want a Start Day screen showing all 13 station cards, so that I can set up the day's production in one place.
20. As an admin, I want to tap a station card to assign an operator and review its queue, so that I don't need to navigate multiple screens to set up.
21. As an admin, I want to upload an Excel file with serial numbers and meter types to seed Station 1's queue for the day, so that I don't manually enter each meter.
22. As an admin, I want to add individual meters to Station 1's queue from the Start Day screen, so that late additions are handled without re-uploading.
23. As an admin, I want to click Start Day to activate production, so that operators cannot begin until setup is confirmed.
24. As an admin, I want to create a new operator account and have the system auto-generate the next logical operator ID and a unique password, so that onboarding is fast and consistent.
25. As an admin, I want a one-click copy button next to the generated password, so that I can share credentials with the operator instantly.
26. As an admin, I want a dashboard showing 6 key metrics: meters in progress by station, today's failure rate, completed today, station vs failure rate, throughput per hour, and committed vs completed, so that I have a full picture of daily production.
27. As an admin, I want to export reports based on date, station, meter type, or failure parameters, so that I can share production data with stakeholders.
28. As an admin, I want to query and view the full audit log for any meter, so that I can trace every action taken on it.
29. As an admin, I want meters that were in-progress or queued at end of day to automatically roll over to the next day, so that no work is lost between calendar days.
30. As an admin, I want rolled-over meters counted in the committed vs completed metric, so that daily performance is accurately reflected.

### Quality Engineer

31. As a quality engineer, I want to view failure history filtered by stage, parameter, meter type, and date range, so that I can identify recurring defect patterns.
32. As a quality engineer, I want to see all Tamper Test sample results, so that I can track compliance per production batch.
33. As a quality engineer, I want read-only access to all stage results and audit logs, so that I can investigate without risking any data changes.

---

## Implementation Decisions

### Modules

**1. Meter Registry**
- Excel parser: accepts two-column file (serial number, meter type), bulk-creates meter records in Firestore with status `queued` at Station 1
- Manual entry: operator/admin can type or scan serial number; if found in today's list, opens it; if not, creates ad-hoc
- QR scan: standard text input auto-focused — physical USB/Bluetooth scanner fires serial number as keystrokes; no special integration needed

**2. Stage Execution Engine**
- Each meter has a `currentStageId` and `stageHistory[]` (subcollection, not array — unbounded history)
- Parameter data model: `{ parameterId, name, value: string, result: 'OK' | 'NOT OK' | 'REMARK' }`
- All parameters must be filled before Save Draft / Submit / Flag for Rework are enabled
- Save Draft: writes `{ draftResults, savedAt }` to meter document — does not change routing
- Submit: validates all filled, checks for NOT OK → if present, popup requires override comment before proceeding; on confirm, writes stage result, advances meter to next station queue
- Flag for Rework: if NOT OK present, shows prior completed stations as visual cards; operator taps target station; meter moves to that station's rework queue with status `rework`
- Tamper Test stage: radio button (will perform / will not perform) renders or hides parameter inputs

**3. Queue Manager**
- Per-station queue is a Firestore query: meters where `currentStageId == stationId AND status IN ['queued', 'rework']`
- On stage submit + pass → `currentStageId` advances to next station, `status` resets to `queued` — auto-appears in next station's query
- Rework tagging → `currentStageId` set to target station, `status` = `rework`
- Rollover: no scheduled job needed — meters remain in Firestore with their current state; next day's Start Day screen reads live queue

**4. Draft Notification**
- On operator opening a station's queue: query for any meter at that station with a non-null `draftResults` field
- If found, show prominent banner: "You have a draft in progress for meter [serial]"

**5. Admin Start Day Screen**
- 13 station cards rendered in production order
- Each card: station name, assigned operator (editable), queue count, colour accent (red/yellow/green)
- Card colour logic: red = `queueCount == 0`, yellow = any meter in queue with `status == 'rework'`, green = otherwise
- Station 1 card: additional "Add meter" and "Upload Excel" actions
- Start Day button: sets a `dayStarted: true` flag on a daily session document — operators cannot submit stages until this is set

**6. User Management**
- Operator ID auto-generation: query highest existing operator number, increment (e.g. `OP-001` → `OP-002`)
- Password auto-generation: 12-character random alphanumeric
- Copy button: `navigator.clipboard.writeText(password)`
- User creation goes through existing `createUser` Cloud Function — role assigned as `operator`

**7. Audit Log**
- Collection: `auditLog/{logId}`
- Written on every state-changing action: stage submit, rework tag, rework accept, draft save, supervisor override, user creation, operator assignment
- Fields: `action`, `actorUid`, `actorRole`, `targetMeterId`, `stageId`, `timestamp`, `before`, `after`
- Append-only — Firestore rules deny update and delete on this collection for all roles

**8. Admin Dashboard & Export**
- 6 metrics computed via Firestore queries filtered by `createdAt >= today 00:00`
- Throughput per hour: `(completedCount / hoursElapsedSinceFirstMeterEnteredStation1)`
- Committed count: snapshot of queue size recorded at Start Day
- Export: client-side CSV generation from Firestore query results — no backend function needed for Phase 1

**9. Supervisor Power Actions**
- Reassign: updates `currentStageId` on meter document — logged to audit log
- Override failed stage: writes override record to stage history with `overriddenBy`, `comment`, `timestamp` — advances meter

### Data Model

```
meters/{meterId}
  serialNumber: string
  meterType: string
  status: 'queued' | 'in_progress' | 'rework' | 'done'
  currentStageId: string        // e.g. 'stage_01'
  assignedOperatorId: string | null
  draftResults: ParameterDraft | null
  createdAt: timestamp
  completedAt: timestamp | null

meters/{meterId}/stageHistory/{stageId}
  stageId: string
  stageName: string
  operatorId: string
  parameters: Parameter[]       // { parameterId, name, value, result }
  overallResult: 'PASSED' | 'FAILED' | 'OVERRIDDEN'
  overrideComment: string | null
  overriddenBy: string | null
  startedAt: timestamp
  submittedAt: timestamp

auditLog/{logId}
  action: string
  actorUid: string
  actorRole: string
  targetMeterId: string | null
  stageId: string | null
  before: object | null
  after: object | null
  timestamp: timestamp

dailySessions/{date}
  date: string                  // YYYY-MM-DD
  dayStarted: boolean
  committedCount: number
  stationAssignments: { [stationId]: operatorId }
```

### Routing

Stages advance in fixed sequence: `stage_01` → `stage_02` → ... → `stage_13` → `done`. Stage order is defined as a constant array — not stored in Firestore. Rework can target any stage with index less than current.

---

## Testing Decisions

**What makes a good test:** Test external behaviour — given this input state in Firestore, does the right output state result? Do not test implementation details like internal function calls or component internals.

**Modules to test:**

| Module | What to test |
|---|---|
| Stage Execution Engine | Submit with all OK advances stage; submit with NOT OK without comment is blocked; flag for rework sets correct station and status |
| Queue Manager | Pass at stage N causes meter to appear in stage N+1 query; rework tag causes meter to appear in target station rework queue |
| Audit Log | Every state-changing action produces an audit entry with correct fields |
| User Management | Auto-ID increments correctly; duplicate serial numbers are rejected on Excel upload |
| Rollover | Meter in `queued` status at end of day appears in next day's Start Day queue without any action |

**Prior art:** Existing tests in `src/lib/auth/roleGuard.ts` and `src/lib/constants.ts` demonstrate the unit test pattern. Integration tests for Firestore should use `@firebase/rules-unit-testing` against the emulator.

---

## Out of Scope (Phase 2)

- Push notifications via Firebase Cloud Messaging
- Shift management and per-shift metrics
- ERP integration and completion certificate export
- Meter-model-specific stage variations (different parameter sets per product type)
- Advanced MIS reporting (trend charts, date range comparisons)
- Calendar day reset / shift boundary logic

---

## Further Notes

- The app must work offline on factory floor tablets — Firestore offline persistence is already enabled in `client.ts`
- All operator-facing screens must be visual-first: large tap targets, colour-coded buttons, minimal text. Admin and Supervisor screens may be more information-dense
- The live production app must be deployed on Firebase Hosting by end of Phase 1 — not just a local demo
- The existing `workstations` collection (`ws_01`–`ws_13`) maps 1:1 to the 13 stages
- Audit log entries must be enforced at the Firestore rules level — no client can update or delete them regardless of role
