# Titanium Study Tracker — Janvi's 15-Day JEE Sprint

> **Open Source & 100% Free** personal productivity and accountability web application designed for a student's intensive 15-day JEE Main sprint with complete mentor auditing, immutable daily reflection snapshots, date-wise PYQ tracking, and full data portability (Google Drive & JSON backups).

Licensed under the **MIT License**.

---

## Free & Open Source Architecture

You can run this application **100% free with $0 cloud expenses** using any of the following free-tier stacks:

1. **Database ($0 / month)**:
   - **Google Cloud SQL Developer Edition** (free tier included)
   - **Neon Serverless PostgreSQL** (free tier: 0.5 GB storage, instant branching)
   - **Supabase PostgreSQL** (free tier: 500 MB database, generous bandwidth)
   - **Local Docker PostgreSQL** (`docker run -p 5432:5432 -e POSTGRES_PASSWORD=... postgres:16`)
2. **Authentication ($0 / month)**:
   - **Firebase Authentication** (free tier: up to 50,000 monthly active users)
   - **Built-in Session Tokens**: The server supports HMAC-SHA256 authenticated trial sessions without needing third-party auth.
3. **Frontend & Server Hosting ($0 / month)**:
   - **Google Cloud Run / AI Studio** (free tier container runtime)
   - **Render / Railway / Vercel** (free web service deployment)

---

## Data Portability & Google Drive Integration

Your data is **never locked in**:
- **Full JSON Snapshot**: Download the entire PostgreSQL database in a single `.json` file (`janvi_sprint_full_backup.json`) including all 10 new chapters, 20 old short notes, 120+ tasks, daily reflections with all historical version snapshots, task audit trails, and mock tests.
- **Google Drive Storage**: One-click option to save backups directly to Google Drive or attach Google Drive folder/document links directly to chapter short-notes and daily reports.
- **CSV Exports**: Individual spreadsheets for tasks, date-wise PYQ sessions, daily reflections, and audit history.
- **Restore / Import**: Re-import your JSON backup anytime into another instance or local environment.

---

## Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/titanium-study/titanium-study-tracker.git
   cd titanium-study-tracker
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file based on `.env.example`:
   ```bash
   SQL_HOST="localhost" # or /cloudsql/... or Neon/Supabase pooler host
   SQL_DB_NAME="titanium_study"
   SQL_USER="postgres"
   SQL_PASSWORD="your-secure-password"
   SQL_ADMIN_USER="postgres"
   SQL_ADMIN_PASSWORD="your-secure-password"
   ```

4. **Initialize database schema**:
   ```bash
   npx drizzle-kit push
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

---

## Key Features

- **Two-User Role-Based Access Control**:
  - `Janvi (Student)`: Chapter checklists, date-wise PYQ logging, Hinglish night reports with optimistic concurrency control (`expectedVersion`), carry-forward task queue.
  - `Titanium Nikhil (Mentor)`: Overview metrics, 15-day planned vs actual grid, task rescheduler (preserving original dates in audit log), reflection comparison diff viewer, mentor feedback, mock test analysis, and CSV exports.
- **10 Core JEE Chapters & 5-Day Old Notes**:
  - 10 New Chapters (10 tasks each = 100 tasks).
  - 20 Old-Chapter Short Notes across Days 1–5 with individual completion checkboxes and notes/links.
- **9 November 2026 Diagnostic Mock Test**: Preloaded 300-mark mock with zero fabricated results.
- **Immutable Audit Trail**: Append-only PostgreSQL history for reflection edits, task status changes, and PYQ session corrections.
