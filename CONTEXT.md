# PMtool — Domain Context

> Read this before writing domain-touching code or architecture suggestions.

## What PMtool is

A **shop floor execution system** for manufacturing energy meters. Operators receive work orders at their assigned workstations, process them through production stages, and pass them to the next stage or send them for rework. The system runs as a PWA on tablets and wall-mounted screens on the factory floor.

## Core domain concepts

**Meter** — the physical unit being manufactured. Every meter is individually tracked via a QR/barcode from incoming inspection through to packing. The meter's serial number is its identity.

**Lot** — a production batch (e.g. "manufacture 200 meters against order #PO-1234"). Multiple meters belong to a lot. Most operations are per-meter; sampling (e.g. Tamper Test) is per-lot.

**Stage** — one step in the production process. A meter passes through stages in sequence. Each stage has a set of parameters that must be checked. The 13 stages in order:

1. Incoming Inspection / Stores
2. SMD, Through Hole Soldering & Testing / EMS
3. PCBA Incoming / Store
4. Base Assembly
5. Functional Testing
6. Cover Assembly
7. Error Compensation
8. Tamper Test
9. HV-IR Test
10. Soaking Test
11. Final Testing
12. Sealing
13. Packing

**Parameter** — a specific check or test within a stage (e.g. "Relay & Shunt", "AOI Testing", "AC High Voltage Test"). Each parameter result is one of: `OK`, `NOT OK`, or `REMARK`.

**Work Order** — a unit of work assigned to an operator at a workstation. Tracks a meter through its current stage. Status flow:
```
pending → in_progress → submitted → qa_review → closed
                                  ↘ rework → reassigned → in_progress
```
`cancelled` is terminal from any state (super_admin only).

**Workstation** — a physical station on the shop floor where a specific stage is performed. Each workstation corresponds to one or more stages. There are 13 workstations (`ws_01` – `ws_13`).

**Rework** — when a stage result is FAILED (any parameter marked NOT OK), the meter is sent back for rework before proceeding.

## Business rules

- A stage is PASSED when all parameters are marked OK and the operator submits
- A stage is FAILED when any parameter is NOT OK — triggers rework flow
- REMARK is informational — does not block progression but is recorded
- Every meter must be individually scanned (QR/barcode) before a stage can be started
- Tamper Test requires one sample per lot (not every meter)
- Operators must be signed in and assigned to a workstation before performing stage activities

## Roles

| Role | Responsibilities |
|---|---|
| `operator` | Stage data entry — scans meter, records parameter results, submits stage |
| `supervisor` | Production management — monitors queue, manages operators and workstations |
| `quality_engineer` | Failure analysis, sample testing (Tamper Test lot sampling) |
| `admin` | MIS reporting, ERP linking, software maintenance |
| `super_admin` | Full access including cancellations and role assignment |

## Key invariants

- A meter can only be at one stage at a time
- Stage history is append-only — results are never edited after submission
- Audit log entries are never deleted
- Role is enforced at three layers: Firestore rules, middleware, UI
