# Titanium Study Tracker — Janvi's 15-Day JEE Sprint

A private, two-user accountability and preparation management web application built for **Janvi** (Student) and **Titanium Nikhil** (Mentor) to execute, audit, and analyze a high-focus 15-day JEE Main preparation sprint (25 October – 8 November 2026, plus the 9 November Diagnostic Mock Test).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> This revised plan incorporates all confirmed Phase 1 choices plus the 10 mandatory architectural corrections:

- **Confirmed Decision 1 — Persistence & Authentication**: **Cloud SQL (PostgreSQL) with Drizzle ORM + Firebase Authentication**. Strict server-enforced Role-Based Access Control (`mentor` for Titanium Nikhil, `student` for Janvi) with priority placed on core MVP reliability: authenticated access, real database persistence, atomic reflection versioning, and mentor auditability with zero mock data.
- **Confirmed Decision 2 — Visual Posture & Reliable UX**: **Crisp Light Mode Default with Dark Mode Toggle**. Includes server-confirmed save states (`Unsaved changes`, `Saving...`, `Saved`, `Submitted`, `Edited after submission`, `Save failed — Retry`), unsaved-change navigation guards (`beforeunload` and day-switch prompts), and zero premature optimistic success banners.
- **Confirmed Decision 3 — Sprint Date & Dual Progress Tracking**: **Automatic `Asia/Kolkata` (IST) Date Detection + Quick Day 1–15 Switcher**. Preserves the fixed 25 October – 8 November 2026 baseline schedule while tracking **Planned-Day Progress** (based on scheduled due dates) separately from **Actual Activity Performed on Date** (tasks completed on that date, PYQ sessions practiced on that date, and reflections saved on that date).

---

## 1. Overview & Core Concept

- **What It Does**: Replaces static spreadsheets with a relational, audit-backed study tracker tailored to Janvi's exact 15-day JEE Main 2027 schedule. It tracks 10 new syllabus chapters (with 10 granular tasks each), 5 days of parallel old-chapter short notes (20 individual revision chapters), date-wise PYQ practice sessions aggregated per chapter, a 4-question Hinglish night reflection system with optimistic concurrency control and immutable version snapshots, mentor feedback, and the 9 November 300-mark Diagnostic Mock Test.
- **Target Audience / Persona**:
  1. **Janvi (`student`)**: Needs a calm, fast (15–20 min nightly workflow), mobile- and desktop-friendly interface to check off completed lectures/revisions, log daily PYQ practice sessions, write honest daily Hinglish reflections with conflict-safe draft/submit saving, and read mentor guidance.
  2. **Titanium Nikhil (`mentor`)**: Needs complete visibility into planned vs. actual daily execution, chapter bottlenecks, carry-forward overdue tasks, task & PYQ audit logs, and a before/after diff viewer for every edited reflection—plus tools to reschedule targets without overwriting original plan dates, add/archive custom tasks, override PYQ locks with audit reasons, and export CSV backups.
- **Key Value**: Absolute data integrity and zero-fabrication accountability—every percentage is derived dynamically from non-archived canonical task records, chapter PYQ totals are computed from date-wise `pyq_sessions`, concurrent edits are protected via version numbers, and every reflection edit, schedule change, or task transition is permanently preserved in an append-only audit trail.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Authenticated Two-User Entry**:
   - Users sign in via Firebase Authentication. The backend verifies the Firebase ID token and maps the user to their locked profile (`mentor` for Titanium Nikhil, `student` for Janvi; unlinked/unauthorized accounts are rejected server-side).
2. **Janvi's Daily Study & Night Report Flow (Student Experience)**:
   - **Header & Sprint Pulse**: Greets Janvi in IST (*"Good Evening, Janvi — Your JEE 15-Day Sprint"*), shows current IST date, sprint status label (*Before sprint*, *Day X of 15*, or *Sprint completed*), and 4 primary KPI cards (*Overall Sprint Progress %*, *Completed / Eligible Assigned Tasks*, *Chapters Fully Completed / 10*, *Pending & Overdue Tasks*) plus secondary metrics (*Total PYQs Attempted*, *Old Short Notes Completed / 20*, *Reflections Submitted / 15*).
   - **10 Assigned Chapter Targets**: Grouped into **Physics** (3), **Chemistry** (4), and **Mathematics** (3). Each chapter card shows original & current assigned dates, task completion %, one-shot status, aggregated PYQ progress bar & accuracy %, short-notes status, revision status, completed/pending counts, and opens a detailed 10-task checklist + date-wise PYQ session logger.
   - **5-Day Old-Chapter Short Notes (Days 1–5)**: Displays each of the 20 revision chapters individually (e.g., Day 1 shows separate checkboxes, status selectors: `Not Started` / `In Progress` / `Completed`, optional formula/concept notes, and resource links for *Kinematics*, *Newton's Laws of Motion*, and *Work, Energy and Power*—completing 1 shows `1 / 3 (33.3%)`, never a bulk checkbox).
   - **Today, Carry-Forward & Actual Activity Workspace**:
     - Separates *Today's Scheduled Assignments*, *Carry-Forward Pending/Overdue Work* (from earlier due dates without duplicating records), and *Actual Activity Logged on This Date* (tasks completed on this date regardless of original due date, plus PYQ sessions logged on this date).
     - One-tap checkboxes update the backend and recalculate all progress bars after server confirmation, with one-click Undo/reopen logged to `task_audit_events`.
   - **Hinglish Daily Reflection (with Optimistic Concurrency & Unsaved-Change Guards)**:
     - Four dedicated textareas (*"Aaj kya kiya?"*, *"Kal kya karna hai?"*, *"Aaj ka regret kya raha?"*, *"Aaj kya achieve kiya?"*) with explicit *Save Draft* and *Submit Daily Report* buttons.
     - Displays clear server-confirmed states: `Unsaved changes`, `Saving...`, `Draft Saved`, `Submitted`, `Edited after submission`, `Version conflict detected`, or `Save failed` (preserving local text with a one-click Retry button).
     - Warns the user if they attempt to switch days, navigate away, or close the tab while unsaved reflection text exists.
3. **Titanium Nikhil's Review & Administration Flow (Mentor Experience)**:
   - **Mentor Overview & Dual Progress Analytics**: Full sprint KPI strip, subject-wise progress bars, 15-Day Grid comparing **Planned-Day Completion %** vs. **Actual Work Performed on Day**, Chapter Progress comparison chart, and latest student activity feed.
   - **Task Monitor & Versioned Rescheduler**: Inspect all sprint tasks, filter by primary completion status (`Not Started`, `In Progress`, `Completed`) or derived flags (`Overdue`, `Rescheduled`, `Archived`), create custom tasks, soft-archive tasks (`archived_at`), or reschedule due dates (preserving `original_assigned_date` and `original_due_date` on the record and logging the rescheduling event in `task_audit_events`).
   - **Immutable Reflection History & Diff Viewer**: Inspect any day's reflection in **Timeline View** (showing every saved version with its explicit badge: `Draft Saved`, `Submitted`, or `Edited After Submission`) or **Comparison View** (word-level diff highlighting additions and deletions with exact `Asia/Kolkata` timestamps and editor identity).
   - **Mentor Feedback & Mock Test Analysis**: Post or update feedback on any daily report (preserving feedback edit history) and record/analyze the **9 November 2026 — JEE Main Diagnostic Mock (300 Marks)**.
   - **Authorized CSV Exports**: Server-generated CSV downloads for *Task Progress (with original vs. revised dates & completion timestamps)*, *Date-wise PYQ Sessions*, *Daily Reflections*, and *Full Audit History*.

### Visual Identity & Theme

- **Aesthetic Direction**: Precision Academic Productivity—clean, authoritative, and calm. Follows strict SaaS dashboard discipline: single-elevation cards with `1px solid` hairline borders, unboxed metadata with typographic separators (`·`), and zero visual bloat.
- **Color Palette & Mood**:
  - **Light Mode (Default)**: Crisp Alabaster canvas (`#F8FAFC`), pure white surfaces (`#FFFFFF`), deep navy ink (`#0F172A`), muted slate secondary text (`#475569`), hairline borders (`#E2E8F0`).
  - **Dark Mode (Toggleable)**: Deep obsidian slate canvas (`#090D16`), elevated slate surfaces (`#111827`), crisp off-white text (`#F8FAFC`), subtle borders (`#1E293B`).
  - **Subject & Semantic Accents**:
    - Primary Action / Sprint Accent: Cobalt Blue (`#2563EB`)
    - Physics Accent: Indigo (`#4F46E5`)
    - Chemistry Accent: Emerald Teal (`#0D9488`)
    - Mathematics Accent: Violet (`#7C3AED`)
    - Semantic States (always paired with explicit text labels + icons): Completed (`#16A34A`), In Progress / Rescheduled (`#D97706`), Overdue / Conflict (`#DC2626`).
- **Typography & Hierarchy**:
  - **Display & Headings**: `Plus Jakarta Sans` (SemiBold/Bold, tight tracking, `text-wrap: balance`).
  - **Body & Hinglish Reflections**: `DM Sans` (Regular/Medium, comfortable `1.6` line-height).
  - **Metrics, Dates, Percentages & Diff Timestamps**: `JetBrains Mono` with `font-variant-numeric: tabular-nums` so all percentages (`30.0%`, `70.0%`), PYQ counters (`18 / 30`), and IST timestamps align vertically.

---

## 3. Key Product Decisions & Trade-Offs (Incorporating All 10 Corrections)

- **Decision 1 — Primary Task Status Model + Derived Overdue & Audited Rescheduling**:
  - *Chosen Approach*: Each task stores a primary completion status strictly in `('not_started', 'in_progress', 'completed')`.
    - **Overdue** is never a mutually exclusive status that overwrites `'not_started'` or `'in_progress'`; it is derived dynamically whenever `status !== 'completed'`, `archived_at IS NULL`, and `currentISTDate > due_date`.
    - **Rescheduled** is tracked via original baseline columns (`original_assigned_date`, `original_due_date`) compared against active scheduling columns (`assigned_date`, `due_date`), `reschedule_count`, and immutable entries in `task_audit_events`. Thus, a rescheduled task clearly shows both its current completion state (e.g., `In Progress`) and its scheduling badge (`Rescheduled from 27 Oct → 29 Oct`).
- **Decision 2 — Planned-Day Progress vs. Actual-Date Activity Integrity**:
  - *Chosen Approach*: Every task tracks `original_assigned_date`, `original_due_date`, current `assigned_date`, current `due_date`, and `completed_at` (UTC timestamp converted to `Asia/Kolkata` date).
    - **Planned-Day Progress**: Measures completion of non-archived tasks scheduled to be due on Day $D$: `completedTasksDueOn(D) / totalActiveTasksDueOn(D) × 100` (displaying `N/A — No tasks due` if the denominator is 0).
    - **Actual Activity on Day $D$**: Aggregates all tasks whose `completed_at` date in `Asia/Kolkata` equals Day $D$, task transitions recorded in `task_audit_events` on Day $D$, `pyq_sessions` practiced on Day $D$, and reflection versions saved on Day $D$. If Janvi completes a task on 27 Oct and reopens it on 29 Oct, current progress shows it as pending while the audit timeline preserves both the 27 Oct completion and 29 Oct reopening.
- **Decision 3 — Optimistic Concurrency Control (OCC) & Immutable Reflection Snapshots**:
  - *Chosen Approach*: `daily_reflections` stores `current_version` (integer starting at `0` before first save, incrementing by `1` on each meaningful change).
    - Every `PUT /api/reflections/:date` request must supply `expectedVersion`. Inside a PostgreSQL transaction (`SELECT ... FOR UPDATE`), if `daily_reflections.current_version !== expectedVersion`, the server rejects the write with HTTP `409 Conflict` and returns the latest server snapshot so the client can alert the user without overwriting concurrent edits.
    - When accepted and any of the 4 Hinglish fields or submission status changed, `current_version` increments and a new immutable row is inserted into `reflection_versions` with `change_type` set to `'draft_saved'`, `'submitted'`, or `'edited_after_submission'`.
- **Decision 4 — Date-Wise PYQ Sessions (`pyq_sessions`) & Audited Corrections**:
  - *Chosen Approach*: Instead of a single mutable counter that loses daily practice history, PYQ progress is backed by a `pyq_sessions` table (`chapter_id`, `student_id`, `practice_date`, `attempted_count`, `correct_count`, `incorrect_count`, `unclassified_count`, `notes`, `created_at`, `updated_at`) and a `pyq_session_audit_events` table.
    - Chapter-level totals (`attempted`, `correct`, `incorrect`, `unclassified`) are computed dynamically by summing non-archived `pyq_sessions` for that chapter.
    - Validation enforces `attempted >= 0`, `correct >= 0`, `incorrect >= 0`, `unclassified >= 0`, and `correct + incorrect + unclassified === attempted`.
    - Chapter PYQ Progress % = `min(100, totalAttempted / chapter.targetPyqCount × 100)`; Accuracy % = `totalCorrect / (totalCorrect + totalIncorrect) × 100` (or `"Not available"` if `totalCorrect + totalIncorrect === 0`).
    - Completing Task #6 (*"Complete assigned PYQ target"*) requires `totalAttempted >= chapter.targetPyqCount` unless Mentor Nikhil records an audited override reason.
- **Decision 5 — Canonical Denominators & Soft Archival**:
  - *Chosen Approach*: Only active tasks (`archived_at IS NULL`) are included in current chapter, daily, and overall sprint completion denominators. When Mentor Nikhil deletes/archives a task, `archived_at` is set to the current timestamp and a `task_archived` event is logged in `task_audit_events`—preserving full history while immediately updating active progress percentages. Carry-forward tasks reference their single canonical `study_tasks` row and are never duplicated.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        CLIENT WORKSPACE (React 19 + Tailwind)                    │
│                                                                                  │
│  ┌─────────────────────────┐  ┌───────────────────────────────────────────────┐  │
│  │   Auth & Role Guard     │  │         Top Bar & Day 1–15 Navigator          │  │
│  │ (Firebase Auth + Token) │  │ (IST Clock, Day Switcher, Unsaved Guard)      │  │
│  └────────────┬────────────┘  └───────────────────────┬───────────────────────┘  │
│               │                                       │                          │
│               ▼                                       ▼                          │
│  ┌────────────────────────────────────┐  ┌────────────────────────────────────┐  │
│  │      JANVI (STUDENT) VIEWS         │  │   TITANIUM NIKHIL (MENTOR) VIEWS   │  │
│  ├────────────────────────────────────┤  ├────────────────────────────────────┤  │
│  │ • Student Dashboard & KPIs         │  │ • Mentor Overview (Planned/Actual) │  │
│  │ • 15-Day Plan (Planned vs Actual)  │  │ • Janvi's 15-Day Plan & Rescheduler│  │
│  │ • Today's Tasks + Carry-Forward    │  │ • Task Monitor & Custom Task CRUD  │  │
│  │ • 10 Chapters & 10-Task Checklists │  │ • Chapter & PYQ Session Inspector  │  │
│  │ • 5-Day Old Short Notes (20 items) │  │ • Daily Reports & Feedback Panel   │  │
│  │ • Date-wise PYQ Session Logger     │  │ • Edit History (Timeline + Diff)   │  │
│  │ • Hinglish Reflection (OCC Safe)   │  │ • Pending / Overdue Queue          │  │
│  │ • Reflection History & Feedback    │  │ • 9 Nov Mock Test & CSV Exports    │  │
│  └─────────────────┬──────────────────┘  └─────────────────┬──────────────────┘  │
└────────────────────┼───────────────────────────────────────┼─────────────────────┘
                     │ Bearer <Firebase ID Token> (HTTPS)    │
                     ▼                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                 EXPRESS BACKEND API & RBAC MIDDLEWARE (server.ts)                │
│                                                                                  │
│  • Firebase Admin Token Verification (`verifyIdToken`)                           │
│  • Strict Two-User Profile Binding & Role Enforcement (`mentor` vs `student`)    │
│  • Transactional Write Controllers with OCC (`409 Conflict` on stale version)    │
│  • Dynamic Progress Engine (Planned-Day vs Actual-Date, Active-Only Denominator) │
│  • Idempotent Sprint Seeder (10 Chapters × 10 Tasks, 20 Old Notes, 1 Mock Test)  │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ Drizzle ORM (Node-Postgres Pool)
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        CLOUD SQL POSTGRESQL DATABASE                             │
│                                                                                  │
│  ├─ profiles (uid, email, display_name, role: 'mentor' | 'student')              │
│  ├─ mentor_student_links (mentor_id, student_id)                                 │
│  ├─ study_sprints (fixed original_start/end: 2026-10-25..11-08, active dates)    │
│  ├─ chapters (10 new + 20 old notes, original & current target dates, pyq_target)│
│  ├─ study_tasks (status: not_started|in_progress|completed, original/current due)│
│  ├─ pyq_sessions (date-wise practice entries: attempted, correct, incorrect...)  │
│  ├─ pyq_session_audit_events (APPEND-ONLY log of PYQ session creations/edits)    │
│  ├─ daily_reflections (1 per date, current_version for OCC, status, timestamps)  │
│  ├─ reflection_versions (APPEND-ONLY snapshots: draft_saved|submitted|edited...) │
│  ├─ task_audit_events (APPEND-ONLY status, schedule, & override audit log)       │
│  ├─ mentor_feedback (+ mentor_feedback_versions for comment edit history)        │
│  └─ mock_tests (9 Nov 2026 JEE Main Diagnostic Mock, 300 max marks)              │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Normalized Database Schema Details

1. **`study_sprints`**:
   - Preserves `original_start_date` (`2026-10-25`) and `original_end_date` (`2026-11-08`) alongside active `start_date` and `end_date`, `timezone` (`Asia/Kolkata`), and `mock_target_date` (`2026-11-09`).
2. **`chapters`**:
   - Stores `chapter_type` (`'new_chapter'` for the 10 core chapters, `'old_short_notes'` for the 20 revision chapters), `subject` (`Physics`, `Chemistry`, `Mathematics`), `original_target_start_date`, `original_target_end_date`, `target_start_date`, `target_end_date`, `target_pyq_count` (default `30` for new chapters), and `status` (`not_started`, `in_progress`, `completed`).
3. **`study_tasks`**:
   - Stores `status` (`'not_started' | 'in_progress' | 'completed'`), `original_assigned_date`, `original_due_date`, `assigned_date`, `due_date`, `is_rescheduled` (boolean), `completed_at` (nullable timestamptz), `archived_at` (nullable timestamptz), `notes`, `resource_link` (for old-chapter short notes), and `estimated_minutes`.
4. **`pyq_sessions` & `pyq_session_audit_events`**:
   - `pyq_sessions` records each practice batch by `practice_date` (`YYYY-MM-DD`), `attempted_count`, `correct_count`, `incorrect_count`, `unclassified_count`, and `practice_notes`.
   - Any update to an existing `pyq_sessions` row or chapter `target_pyq_count` writes an immutable record to `pyq_session_audit_events` with old and new values, editor ID, and timestamp.
5. **`daily_reflections` & `reflection_versions`**:
   - Unique constraint on `(sprint_id, student_id, reflection_date)`.
   - `daily_reflections` tracks `current_version` (int), `status` (`'draft' | 'submitted' | 'edited_after_submission'`), `submitted_at`, and `updated_at`.
   - `reflection_versions` has a unique constraint on `(reflection_id, version_number)` and stores full text snapshots of `what_did_you_do`, `tomorrow_plan`, `today_regret`, `today_achievement`, `change_type` (`'draft_saved' | 'submitted' | 'edited_after_submission'`), `edited_by`, and `edited_at`.

### Interactive Component & State Mapping

- **Task Status & Reschedule Handler**:
  - Student can update `status` (`not_started` / `in_progress` / `completed`) and optional task/short-note text & resource links.
  - Mentor can additionally create custom tasks, reschedule `assigned_date` / `due_date` (which preserves `original_assigned_date` / `original_due_date`, sets `is_rescheduled = true`, and logs a `task_rescheduled` audit event), soft-archive tasks (`archived_at`), or override the Task #6 PYQ target gate with a required explanation.
- **Reflection Save / Submit with Optimistic Concurrency**:
  - Client sends `{ reflectionDate, whatDidYouDo, tomorrowPlan, todayRegret, todayAchievement, mode: 'draft' | 'submit', expectedVersion }`.
  - Server verifies `expectedVersion === current_version`. On mismatch, returns HTTP `409` with the server's latest version so the UI presents a non-destructive conflict resolution banner. On match, commits the update and new `reflection_versions` row atomically, then returns the confirmed version number and IST timestamp.
