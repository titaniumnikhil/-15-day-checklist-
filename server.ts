import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import {
  requireAuth,
  requireMentor,
  AuthRequest,
  createSeatSessionToken,
  verifySeatAccessCode,
} from './src/middleware/auth.ts';
import { ensureSprintSeeded } from './src/db/seed.ts';
import {
  getFullSprintState,
  updateTaskStatusAndNotes,
  rescheduleTaskByMentor,
  createCustomTaskByMentor,
  archiveOrRestoreTaskByMentor,
  updateChapterTargetsByMentor,
  logOrUpdatePyqSession,
  saveDailyReflectionWithOCC,
  saveMentorFeedback,
  updateMockTestRecord,
  ConcurrencyConflictError,
  ValidationError,
} from './src/db/service.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

  // Ensure sprint seed runs idempotently when API is accessed
  app.post('/api/auth/seat-login', async (req, res) => {
    try {
      await ensureSprintSeeded();
      const { role, accessCode, trialDirect } = req.body || {};
      if (role !== 'mentor' && role !== 'student') {
        return res.status(400).json({ error: 'Invalid role. Must be mentor or student.' });
      }

      // Verify either explicit access code or authorized two-user trial seat login
      if (!trialDirect && !verifySeatAccessCode(role, accessCode)) {
        return res.status(401).json({
          error: 'Invalid access code for selected seat.',
        });
      }

      const token = createSeatSessionToken(role);
      const profile = {
        uid: role === 'mentor' ? 'mentor-titanium-nikhil' : 'student-janvi',
        email: role === 'mentor' ? 'titaniumoxide26@gmail.com' : 'janvi.student@titanium.study',
        displayName: role === 'mentor' ? 'Titanium Nikhil' : 'Janvi',
        role,
        authMethod: 'seat_session',
      };

      return res.json({ token, profile });
    } catch (error: any) {
      console.error('Seat login failed:', error);
      return res.status(500).json({ error: error.message || 'Authentication failed.' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      await ensureSprintSeeded();
      return res.json({ profile: req.userProfile });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to verify user session.' });
    }
  });

  app.get('/api/sprint', requireAuth, async (req: AuthRequest, res) => {
    try {
      await ensureSprintSeeded();
      const referenceDate =
        typeof req.query.referenceDate === 'string' ? req.query.referenceDate : undefined;
      const state = await getFullSprintState(referenceDate);
      return res.json({
        ...state,
        currentUser: req.userProfile,
      });
    } catch (error: any) {
      console.error('Error in GET /api/sprint:', error);
      return res.status(500).json({
        error: error.message || 'Failed to load study sprint state.',
      });
    }
  });

  app.patch('/api/tasks/:id/status', requireAuth, async (req: AuthRequest, res) => {
    try {
      const taskId = Number(req.params.id);
      if (!Number.isInteger(taskId) || taskId <= 0) {
        return res.status(400).json({ error: 'Invalid task ID.' });
      }

      const updatedTask = await updateTaskStatusAndNotes(
        taskId,
        req.body || {},
        req.userProfile!
      );
      const state = await getFullSprintState();
      return res.json({
        updatedTask,
        state: { ...state, currentUser: req.userProfile },
      });
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      console.error('Error in PATCH /api/tasks/:id/status:', error);
      return res.status(500).json({ error: error.message || 'Failed to update task.' });
    }
  });

  app.post('/api/tasks', requireAuth, requireMentor, async (req: AuthRequest, res) => {
    try {
      const created = await createCustomTaskByMentor(req.body || {}, req.userProfile!);
      const state = await getFullSprintState();
      return res.status(201).json({
        createdTask: created,
        state: { ...state, currentUser: req.userProfile },
      });
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      console.error('Error in POST /api/tasks:', error);
      return res.status(500).json({ error: error.message || 'Failed to create task.' });
    }
  });

  app.patch(
    '/api/tasks/:id/reschedule',
    requireAuth,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const taskId = Number(req.params.id);
        const updated = await rescheduleTaskByMentor(
          taskId,
          req.body || {},
          req.userProfile!
        );
        const state = await getFullSprintState();
        return res.json({
          updatedTask: updated,
          state: { ...state, currentUser: req.userProfile },
        });
      } catch (error: any) {
        if (error instanceof ValidationError) {
          return res.status(400).json({ error: error.message });
        }
        console.error('Error in PATCH /api/tasks/:id/reschedule:', error);
        return res.status(500).json({ error: error.message || 'Failed to reschedule task.' });
      }
    }
  );

  app.patch(
    '/api/tasks/:id/archive',
    requireAuth,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const taskId = Number(req.params.id);
        const { archive, reason } = req.body || {};
        const updated = await archiveOrRestoreTaskByMentor(
          taskId,
          Boolean(archive),
          reason || '',
          req.userProfile!
        );
        const state = await getFullSprintState();
        return res.json({
          updatedTask: updated,
          state: { ...state, currentUser: req.userProfile },
        });
      } catch (error: any) {
        if (error instanceof ValidationError) {
          return res.status(400).json({ error: error.message });
        }
        console.error('Error in PATCH /api/tasks/:id/archive:', error);
        return res.status(500).json({ error: error.message || 'Failed to archive task.' });
      }
    }
  );

  app.patch(
    '/api/chapters/:id/targets',
    requireAuth,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const chapterId = Number(req.params.id);
        const updated = await updateChapterTargetsByMentor(
          chapterId,
          req.body || {},
          req.userProfile!
        );
        const state = await getFullSprintState();
        return res.json({
          updatedChapter: updated,
          state: { ...state, currentUser: req.userProfile },
        });
      } catch (error: any) {
        if (error instanceof ValidationError) {
          return res.status(400).json({ error: error.message });
        }
        console.error('Error in PATCH /api/chapters/:id/targets:', error);
        return res.status(500).json({ error: error.message || 'Failed to update chapter.' });
      }
    }
  );

  app.post('/api/pyq-sessions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const savedSession = await logOrUpdatePyqSession(req.body || {}, req.userProfile!);
      const state = await getFullSprintState();
      return res.json({
        savedSession,
        state: { ...state, currentUser: req.userProfile },
      });
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      console.error('Error in POST /api/pyq-sessions:', error);
      return res.status(500).json({ error: error.message || 'Failed to save PYQ session.' });
    }
  });

  app.put('/api/reflections', requireAuth, async (req: AuthRequest, res) => {
    try {
      const result = await saveDailyReflectionWithOCC(req.body || {}, req.userProfile!);
      const state = await getFullSprintState();
      return res.json({
        ...result,
        state: { ...state, currentUser: req.userProfile },
      });
    } catch (error: any) {
      if (error instanceof ConcurrencyConflictError) {
        return res.status(409).json({
          error: error.message,
          conflict: true,
          serverRecord: error.serverRecord,
        });
      }
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      console.error('Error in PUT /api/reflections:', error);
      return res.status(500).json({
        error: error.message || 'Failed to save daily reflection.',
      });
    }
  });

  // Explicitly forbid deleting or mutating historical versions or audit logs
  app.delete('/api/reflections/:id', requireAuth, (_req, res) => {
    return res.status(403).json({
      error: 'Forbidden: Daily reflections and historical versions are immutable and cannot be deleted.',
    });
  });

  app.delete('/api/audit/:id', requireAuth, (_req, res) => {
    return res.status(403).json({
      error: 'Forbidden: Audit records are append-only and cannot be deleted by any user.',
    });
  });

  app.post('/api/feedback', requireAuth, requireMentor, async (req: AuthRequest, res) => {
    try {
      const saved = await saveMentorFeedback(req.body || {}, req.userProfile!);
      const state = await getFullSprintState();
      return res.json({
        savedFeedback: saved,
        state: { ...state, currentUser: req.userProfile },
      });
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      console.error('Error in POST /api/feedback:', error);
      return res.status(500).json({ error: error.message || 'Failed to save mentor feedback.' });
    }
  });

  app.patch('/api/mock-tests/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const mockId = Number(req.params.id);
      const updated = await updateMockTestRecord(mockId, req.body || {}, req.userProfile!);
      const state = await getFullSprintState();
      return res.json({
        updatedMock: updated,
        state: { ...state, currentUser: req.userProfile },
      });
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      console.error('Error in PATCH /api/mock-tests/:id:', error);
      return res.status(500).json({ error: error.message || 'Failed to save mock test.' });
    }
  });

  app.get('/api/export/:type', requireAuth, async (req: AuthRequest, res) => {
    try {
      const exportType = req.params.type;
      const state = await getFullSprintState();

      if (exportType === 'tasks') {
        const headers = [
          'Task ID',
          'Subject',
          'Chapter Name',
          'Chapter Type',
          'Task Order',
          'Task Title',
          'Task Type',
          'Status',
          'Is Overdue',
          'Is Rescheduled',
          'Original Assigned Date',
          'Original Due Date',
          'Current Assigned Date',
          'Current Due Date',
          'Completed Date (IST)',
          'Completed Timestamp (UTC)',
          'Archived Timestamp',
          'Notes',
          'Resource Link',
        ];
        const rows = state.tasks.map((t) => [
          t.id,
          t.subject,
          t.chapterName,
          t.chapterType,
          t.taskOrder,
          t.title,
          t.taskType,
          t.status,
          t.isOverdue ? 'Yes' : 'No',
          t.isRescheduled ? 'Yes' : 'No',
          t.originalAssignedDate,
          t.originalDueDate,
          t.assignedDate,
          t.dueDate,
          t.completedDateIst || '',
          t.completedAt ? new Date(t.completedAt).toISOString() : '',
          t.archivedAt ? new Date(t.archivedAt).toISOString() : '',
          t.notes,
          t.resourceLink,
        ]);

        const csvContent = [
          headers.map(escapeCsvCell).join(','),
          ...rows.map((r) => r.map(escapeCsvCell).join(',')),
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="janvi_sprint_tasks_progress.csv"'
        );
        return res.send(csvContent);
      }

      if (exportType === 'pyq-sessions') {
        const chapterMap = new Map(state.newChapters.map((c) => [c.id, c]));
        const headers = [
          'Session ID',
          'Practice Date',
          'Subject',
          'Chapter Name',
          'Attempted',
          'Correct',
          'Incorrect',
          'Unclassified',
          'Notes',
          'Created At (UTC)',
        ];
        const rows = state.pyqSessions.map((s) => {
          const ch = chapterMap.get(s.chapterId);
          return [
            s.id,
            s.practiceDate,
            ch?.subject || '',
            ch?.chapterName || '',
            s.attemptedCount,
            s.correctCount,
            s.incorrectCount,
            s.unclassifiedCount,
            s.notes,
            new Date(s.createdAt).toISOString(),
          ];
        });

        const csvContent = [
          headers.map(escapeCsvCell).join(','),
          ...rows.map((r) => r.map(escapeCsvCell).join(',')),
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="janvi_sprint_pyq_sessions.csv"'
        );
        return res.send(csvContent);
      }

      if (exportType === 'reflections') {
        const headers = [
          'Reflection Date',
          'Status',
          'Current Version',
          'Total Edits',
          'Aaj kya kiya?',
          'Kal kya karna hai?',
          'Aaj ka regret kya raha?',
          'Aaj kya achieve kiya?',
          'Submitted At (UTC)',
          'Last Updated At (UTC)',
        ];
        const rows = state.reflections.map((r) => [
          r.reflectionDate,
          r.status,
          r.currentVersion,
          r.editCount,
          r.whatDidYouDo,
          r.tomorrowPlan,
          r.todayRegret,
          r.todayAchievement,
          r.submittedAt ? new Date(r.submittedAt).toISOString() : '',
          new Date(r.updatedAt).toISOString(),
        ]);

        const csvContent = [
          headers.map(escapeCsvCell).join(','),
          ...rows.map((r) => r.map(escapeCsvCell).join(',')),
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="janvi_daily_reflections.csv"'
        );
        return res.send(csvContent);
      }

      if (exportType === 'audit-history') {
        const headers = [
          'Audit Category',
          'Reference Date / ID',
          'Action / Change Type',
          'Version / Status',
          'Actor Name',
          'Actor Role',
          'Details / Snapshot',
          'Timestamp (UTC)',
        ];

        const reflectionRows: unknown[][] = [];
        for (const r of state.reflections) {
          for (const v of r.versions) {
            reflectionRows.push([
              'Reflection Version',
              v.reflectionDate,
              v.changeType,
              `v${v.versionNumber}`,
              v.editedByName,
              v.editedByRole,
              `Q1: ${v.whatDidYouDo} | Q2: ${v.tomorrowPlan} | Q3: ${v.todayRegret} | Q4: ${v.todayAchievement}`,
              new Date(v.editedAt).toISOString(),
            ]);
          }
        }

        const taskRows: unknown[][] = state.taskAuditEvents.map((a) => [
          'Task Audit',
          `Task #${a.taskId} (${a.eventDateIst})`,
          a.action,
          `${a.previousStatus || '—'} -> ${a.newStatus || '—'}`,
          a.changedByName,
          a.changedByRole,
          `Due: ${a.previousDueDate || '—'} -> ${a.newDueDate || '—'} | Reason: ${a.reason || '—'} | ${a.oldValue} -> ${a.newValue}`,
          new Date(a.changedAt).toISOString(),
        ]);

        const pyqRows: unknown[][] = state.pyqAuditEvents.map((p) => [
          'PYQ Audit',
          `Chapter #${p.chapterId}${p.sessionId ? ` / Session #${p.sessionId}` : ''}`,
          p.action,
          '—',
          p.changedByName,
          'user',
          `Reason: ${p.reason} | Old: ${p.oldValue} | New: ${p.newValue}`,
          new Date(p.changedAt).toISOString(),
        ]);

        const allAuditRows = [...reflectionRows, ...taskRows, ...pyqRows];
        const csvContent = [
          headers.map(escapeCsvCell).join(','),
          ...allAuditRows.map((r) => r.map(escapeCsvCell).join(',')),
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="janvi_sprint_immutable_audit_history.csv"'
        );
        return res.send(csvContent);
      }

      if (exportType === 'full-json' || exportType === 'json') {
        const fullBackupPayload = {
          exportMetadata: {
            appName: 'Titanium Study Tracker — Janvi\'s 15-Day JEE Sprint',
            license: 'MIT License (Open Source)',
            exportedAt: new Date().toISOString(),
            exportedBy: req.userProfile?.displayName || 'Authorized User',
            role: req.userProfile?.role || 'user',
            databaseEngine: 'Cloud SQL PostgreSQL',
            sprintSlug: 'janvi-jee-2027-sprint',
            period: '2026-10-25 to 2026-11-08',
            notes: 'Complete database snapshot suitable for Google Drive personal backup and offline archival.',
          },
          sprintState: state,
        };

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="janvi_sprint_full_backup_${new Date().toISOString().slice(0, 10)}.json"`
        );
        return res.send(JSON.stringify(fullBackupPayload, null, 2));
      }

      return res.status(400).json({ error: 'Unknown export type.' });
    } catch (error: any) {
      console.error('Export failed:', error);
      return res.status(500).json({ error: error.message || 'Failed to generate CSV export.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Titanium Study Tracker server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
