import { db } from './index.ts';
import {
  studySprints,
  chapters,
  studyTasks,
  pyqSessions,
  pyqSessionAuditEvents,
  dailyReflections,
  reflectionVersions,
  taskAuditEvents,
  mentorFeedback,
  mentorFeedbackVersions,
  mockTests,
} from './schema.ts';
import { SPRINT_SLUG, CANONICAL_STUDENT_UID } from './seed.ts';
import { SPRINT_DATES, getCurrentDateIst, roundOneDecimal } from '../utils/ist.ts';
import { eq, asc, desc } from 'drizzle-orm';
import { AuthenticatedProfile } from '../middleware/auth.ts';

export class ConcurrencyConflictError extends Error {
  public serverRecord: any;
  constructor(message: string, serverRecord: any) {
    super(message);
    this.name = 'ConcurrencyConflictError';
    this.serverRecord = serverRecord;
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export async function getFullSprintState(referenceDateIst?: string) {
  try {
    const todayIst = referenceDateIst || getCurrentDateIst();

    const [sprint] = await db
      .select()
      .from(studySprints)
      .where(eq(studySprints.slug, SPRINT_SLUG));

    if (!sprint) {
      throw new Error('Study sprint record not found.');
    }

    const allChapters = await db
      .select()
      .from(chapters)
      .where(eq(chapters.sprintId, sprint.id))
      .orderBy(asc(chapters.chapterOrder));

    const allTasks = await db
      .select()
      .from(studyTasks)
      .where(eq(studyTasks.sprintId, sprint.id))
      .orderBy(asc(studyTasks.taskOrder), asc(studyTasks.id));

    const allPyqSessions = await db
      .select()
      .from(pyqSessions)
      .where(eq(pyqSessions.sprintId, sprint.id))
      .orderBy(desc(pyqSessions.practiceDate), desc(pyqSessions.id));

    const allPyqAudits = await db
      .select()
      .from(pyqSessionAuditEvents)
      .orderBy(desc(pyqSessionAuditEvents.changedAt));

    const allReflections = await db
      .select()
      .from(dailyReflections)
      .where(eq(dailyReflections.sprintId, sprint.id))
      .orderBy(asc(dailyReflections.reflectionDate));

    const allReflectionVersions = await db
      .select()
      .from(reflectionVersions)
      .orderBy(desc(reflectionVersions.versionNumber));

    const allTaskAudits = await db
      .select()
      .from(taskAuditEvents)
      .orderBy(desc(taskAuditEvents.changedAt));

    const allFeedback = await db
      .select()
      .from(mentorFeedback)
      .where(eq(mentorFeedback.sprintId, sprint.id))
      .orderBy(desc(mentorFeedback.updatedAt));

    const allFeedbackVersions = await db
      .select()
      .from(mentorFeedbackVersions)
      .orderBy(desc(mentorFeedbackVersions.versionNumber));

    const allMockTests = await db
      .select()
      .from(mockTests)
      .where(eq(mockTests.sprintId, sprint.id))
      .orderBy(asc(mockTests.testDate));

    // Active (non-archived) tasks for canonical denominators
    const activeTasks = allTasks.filter((t) => t.archivedAt === null);

    // Enrich tasks with derived overdue flag & chapter metadata
    const chapterMap = new Map(allChapters.map((c) => [c.id, c]));

    const enrichedTasks = allTasks.map((t) => {
      const ch = chapterMap.get(t.chapterId);
      const isArchived = t.archivedAt !== null;
      const isOverdue =
        !isArchived && t.status !== 'completed' && t.dueDate < todayIst;
      return {
        ...t,
        subject: ch?.subject || 'Physics',
        chapterName: ch?.chapterName || '',
        chapterType: ch?.chapterType || 'new_chapter',
        isArchived,
        isOverdue,
      };
    });

    const activeEnrichedTasks = enrichedTasks.filter((t) => !t.isArchived);

    // Enrich the 10 new chapters
    const newChapters = allChapters
      .filter((c) => c.chapterType === 'new_chapter')
      .map((ch) => {
        const chTasks = activeEnrichedTasks.filter((t) => t.chapterId === ch.id);
        const completedCount = chTasks.filter((t) => t.status === 'completed').length;
        const inProgressCount = chTasks.filter((t) => t.status === 'in_progress').length;
        const pendingCount = chTasks.length - completedCount;
        const overdueCount = chTasks.filter((t) => t.isOverdue).length;
        const completionPercentage =
          chTasks.length > 0
            ? roundOneDecimal((completedCount / chTasks.length) * 100)
            : 0;

        // Specific sub-statuses from standard tasks
        const lectureTasks = chTasks.filter((t) => t.taskType === 'Lecture');
        const oneShotStatus =
          lectureTasks.length > 0 && lectureTasks.every((t) => t.status === 'completed')
            ? 'Completed'
            : lectureTasks.some((t) => t.status !== 'not_started')
            ? 'In Progress'
            : 'Not Started';

        const shortNoteTasks = chTasks.filter((t) => t.taskType === 'Short notes');
        const shortNotesStatus =
          shortNoteTasks.length > 0 && shortNoteTasks.every((t) => t.status === 'completed')
            ? 'Completed'
            : shortNoteTasks.some((t) => t.status !== 'not_started')
            ? 'In Progress'
            : 'Not Started';

        const revisionTasks = chTasks.filter((t) => t.taskType === 'Revision');
        const revisionStatus =
          revisionTasks.length > 0 && revisionTasks.every((t) => t.status === 'completed')
            ? 'Completed'
            : revisionTasks.some((t) => t.status !== 'not_started')
            ? 'In Progress'
            : 'Not Started';

        // Aggregate date-wise PYQ sessions for this chapter
        const chSessions = allPyqSessions.filter((s) => s.chapterId === ch.id);
        const attemptedPyqs = chSessions.reduce((acc, s) => acc + s.attemptedCount, 0);
        const correctPyqs = chSessions.reduce((acc, s) => acc + s.correctCount, 0);
        const incorrectPyqs = chSessions.reduce((acc, s) => acc + s.incorrectCount, 0);
        const unclassifiedPyqs = chSessions.reduce((acc, s) => acc + s.unclassifiedCount, 0);
        const lastPracticeDate = chSessions.length > 0 ? chSessions[0].practiceDate : null;

        const pyqProgressPercentage =
          ch.targetPyqCount > 0
            ? Math.min(100, roundOneDecimal((attemptedPyqs / ch.targetPyqCount) * 100))
            : 0;

        const classifiedTotal = correctPyqs + incorrectPyqs;
        const pyqAccuracyPercentage =
          classifiedTotal > 0
            ? roundOneDecimal((correctPyqs / classifiedTotal) * 100)
            : null;

        let derivedChapterStatus: 'not_started' | 'in_progress' | 'completed' = 'not_started';
        if (chTasks.length > 0 && completedCount === chTasks.length) {
          derivedChapterStatus = 'completed';
        } else if (completedCount > 0 || inProgressCount > 0 || attemptedPyqs > 0) {
          derivedChapterStatus = 'in_progress';
        }

        return {
          ...ch,
          status: derivedChapterStatus,
          totalTasks: chTasks.length,
          completedTasks: completedCount,
          inProgressTasks: inProgressCount,
          pendingTasks: pendingCount,
          overdueTasks: overdueCount,
          completionPercentage,
          oneShotStatus,
          shortNotesStatus,
          revisionStatus,
          pyqSummary: {
            targetCount: ch.targetPyqCount,
            attemptedCount: attemptedPyqs,
            correctCount: correctPyqs,
            incorrectCount: incorrectPyqs,
            unclassifiedCount: unclassifiedPyqs,
            progressPercentage: pyqProgressPercentage,
            accuracyPercentage: pyqAccuracyPercentage,
            lastPracticeDate,
            sessions: chSessions,
          },
          tasks: chTasks,
        };
      });

    // Enrich the 20 old-chapter short notes (Days 1-5)
    const oldShortNotes = allChapters
      .filter((c) => c.chapterType === 'old_short_notes')
      .map((ch) => {
        const task = activeEnrichedTasks.find((t) => t.chapterId === ch.id);
        return {
          ...ch,
          task: task || null,
          status: task?.status || ch.status,
          completedAt: task?.completedAt || null,
          completedDateIst: task?.completedDateIst || null,
          notes: task?.notes || '',
          resourceLink: task?.resourceLink || '',
          dueDate: task?.dueDate || ch.targetEndDate,
          originalDueDate: task?.originalDueDate || ch.originalTargetEndDate,
          isOverdue: task?.isOverdue || false,
          isRescheduled: task?.isRescheduled || false,
        };
      });

    // Reflections enriched with versions and mentor feedback
    const reflectionsWithHistory = allReflections.map((ref) => {
      const versions = allReflectionVersions
        .filter((v) => v.reflectionId === ref.id)
        .sort((a, b) => b.versionNumber - a.versionNumber);
      const feedbackList = allFeedback
        .filter((f) => f.reflectionDate === ref.reflectionDate)
        .map((f) => ({
          ...f,
          versions: allFeedbackVersions.filter((fv) => fv.feedbackId === f.id),
        }));
      return {
        ...ref,
        versions,
        editCount: Math.max(0, versions.length - 1),
        feedback: feedbackList,
      };
    });

    // Build 15-Day Breakdown (Planned-Day Progress vs Actual-Date Activity)
    const daysSummary = SPRINT_DATES.map((dayInfo) => {
      // Planned tasks due on this date (counted once on due_date)
      const plannedTasksDue = activeEnrichedTasks.filter((t) => t.dueDate === dayInfo.date);
      const plannedCompletedCount = plannedTasksDue.filter((t) => t.status === 'completed').length;
      const plannedPendingCount = plannedTasksDue.length - plannedCompletedCount;
      const plannedCompletionPercentage =
        plannedTasksDue.length > 0
          ? roundOneDecimal((plannedCompletedCount / plannedTasksDue.length) * 100)
          : null;

      // Multi-day active tasks spanning this date (assignedDate <= date < dueDate)
      const activeSpanTasks = activeEnrichedTasks.filter(
        (t) => t.assignedDate <= dayInfo.date && t.dueDate > dayInfo.date
      );

      // Carry-forward tasks (due before this date and still not completed)
      const carryForwardTasks = activeEnrichedTasks.filter(
        (t) => t.dueDate < dayInfo.date && t.status !== 'completed'
      );

      // Old-chapter short notes scheduled for this date
      const dayOldNotes = oldShortNotes.filter((n) => n.dueDate === dayInfo.date);
      const dayOldNotesCompleted = dayOldNotes.filter((n) => n.status === 'completed').length;
      const dayOldNotesPercentage =
        dayOldNotes.length > 0
          ? roundOneDecimal((dayOldNotesCompleted / dayOldNotes.length) * 100)
          : null;

      // Actual activity performed on this calendar date (Requirement #1)
      const tasksCompletedOnDate = activeEnrichedTasks.filter(
        (t) => t.completedDateIst === dayInfo.date
      );
      const auditEventsOnDate = allTaskAudits.filter(
        (a) => a.eventDateIst === dayInfo.date
      );
      const pyqSessionsOnDate = allPyqSessions.filter(
        (s) => s.practiceDate === dayInfo.date
      );
      const pyqsAttemptedOnDate = pyqSessionsOnDate.reduce(
        (acc, s) => acc + s.attemptedCount,
        0
      );

      const reflection =
        reflectionsWithHistory.find((r) => r.reflectionDate === dayInfo.date) || null;
      const dayFeedback = allFeedback.filter((f) => f.reflectionDate === dayInfo.date);

      return {
        ...dayInfo,
        // Planned-Day metrics
        assignedCount: plannedTasksDue.length,
        completedCount: plannedCompletedCount,
        pendingCount: plannedPendingCount,
        completionPercentage: plannedCompletionPercentage,
        plannedTasksDue,
        activeSpanTasks,
        carryForwardCount: carryForwardTasks.length,
        // Old-notes sub-metrics for Days 1-5
        oldNotesTotal: dayOldNotes.length,
        oldNotesCompleted: dayOldNotesCompleted,
        oldNotesPercentage: dayOldNotesPercentage,
        oldNotes: dayOldNotes,
        // Actual-Date activity metrics
        actualActivity: {
          tasksCompletedCount: tasksCompletedOnDate.length,
          tasksCompleted: tasksCompletedOnDate,
          auditEventsCount: auditEventsOnDate.length,
          pyqSessionsCount: pyqSessionsOnDate.length,
          pyqsAttemptedCount: pyqsAttemptedOnDate,
          hasReflectionActivity: reflection !== null,
        },
        reflectionStatus: reflection ? reflection.status : 'none',
        reflection,
        feedback: dayFeedback,
      };
    });

    // Overall Sprint Metrics
    const totalEligibleTasks = activeEnrichedTasks.length;
    const completedEligibleTasks = activeEnrichedTasks.filter(
      (t) => t.status === 'completed'
    ).length;
    const inProgressEligibleTasks = activeEnrichedTasks.filter(
      (t) => t.status === 'in_progress'
    ).length;
    const pendingEligibleTasks = totalEligibleTasks - completedEligibleTasks;
    const overdueEligibleTasks = activeEnrichedTasks.filter((t) => t.isOverdue).length;
    const rescheduledEligibleTasks = activeEnrichedTasks.filter(
      (t) => t.isRescheduled
    ).length;

    const overallProgressPercentage =
      totalEligibleTasks > 0
        ? roundOneDecimal((completedEligibleTasks / totalEligibleTasks) * 100)
        : 0;

    // Separate new-chapter vs old-short-notes progress
    const newChapterTasks = activeEnrichedTasks.filter(
      (t) => t.chapterType === 'new_chapter'
    );
    const completedNewChapterTasks = newChapterTasks.filter(
      (t) => t.status === 'completed'
    ).length;
    const newChaptersTaskPercentage =
      newChapterTasks.length > 0
        ? roundOneDecimal((completedNewChapterTasks / newChapterTasks.length) * 100)
        : 0;

    const oldNotesTasks = activeEnrichedTasks.filter(
      (t) => t.chapterType === 'old_short_notes'
    );
    const completedOldNotesTasks = oldNotesTasks.filter(
      (t) => t.status === 'completed'
    ).length;
    const oldNotesTaskPercentage =
      oldNotesTasks.length > 0
        ? roundOneDecimal((completedOldNotesTasks / oldNotesTasks.length) * 100)
        : 0;

    const fullyCompletedNewChaptersCount = newChapters.filter(
      (c) => c.status === 'completed'
    ).length;

    // Subject progress breakdown
    const subjects: ('Physics' | 'Chemistry' | 'Mathematics')[] = [
      'Physics',
      'Chemistry',
      'Mathematics',
    ];
    const subjectProgress = subjects.map((subj) => {
      const subjTasks = activeEnrichedTasks.filter((t) => t.subject === subj);
      const subjCompleted = subjTasks.filter((t) => t.status === 'completed').length;
      const subjNewChapters = newChapters.filter((c) => c.subject === subj);
      const subjCompletedChapters = subjNewChapters.filter(
        (c) => c.status === 'completed'
      ).length;
      return {
        subject: subj,
        totalTasks: subjTasks.length,
        completedTasks: subjCompleted,
        pendingTasks: subjTasks.length - subjCompleted,
        percentage:
          subjTasks.length > 0
            ? roundOneDecimal((subjCompleted / subjTasks.length) * 100)
            : 0,
        totalNewChapters: subjNewChapters.length,
        completedNewChapters: subjCompletedChapters,
      };
    });

    // Global PYQ summary across all 10 new chapters
    const totalPyqTarget = newChapters.reduce((acc, c) => acc + c.targetPyqCount, 0);
    const totalPyqAttempted = allPyqSessions.reduce((acc, s) => acc + s.attemptedCount, 0);
    const totalPyqCorrect = allPyqSessions.reduce((acc, s) => acc + s.correctCount, 0);
    const totalPyqIncorrect = allPyqSessions.reduce((acc, s) => acc + s.incorrectCount, 0);
    const totalPyqUnclassified = allPyqSessions.reduce(
      (acc, s) => acc + s.unclassifiedCount,
      0
    );
    const totalPyqClassified = totalPyqCorrect + totalPyqIncorrect;
    const overallPyqAccuracy =
      totalPyqClassified > 0
        ? roundOneDecimal((totalPyqCorrect / totalPyqClassified) * 100)
        : null;

    const submittedReflectionsCount = reflectionsWithHistory.filter(
      (r) => r.status === 'submitted' || r.status === 'edited_after_submission'
    ).length;
    const draftReflectionsCount = reflectionsWithHistory.filter(
      (r) => r.status === 'draft_saved'
    ).length;

    return {
      serverTimestampUtc: new Date().toISOString(),
      currentDateIst: todayIst,
      sprint,
      metrics: {
        overallProgressPercentage,
        totalEligibleTasks,
        completedEligibleTasks,
        inProgressEligibleTasks,
        pendingEligibleTasks,
        overdueEligibleTasks,
        rescheduledEligibleTasks,
        newChaptersCount: newChapters.length,
        fullyCompletedNewChaptersCount,
        newChapterTasksTotal: newChapterTasks.length,
        newChapterTasksCompleted: completedNewChapterTasks,
        newChaptersTaskPercentage,
        oldNotesTotal: oldNotesTasks.length,
        oldNotesCompleted: completedOldNotesTasks,
        oldNotesTaskPercentage,
        submittedReflectionsCount,
        draftReflectionsCount,
        totalReflectionsDays: 15,
        pyqSummary: {
          totalTarget: totalPyqTarget,
          totalAttempted: totalPyqAttempted,
          totalCorrect: totalPyqCorrect,
          totalIncorrect: totalPyqIncorrect,
          totalUnclassified: totalPyqUnclassified,
          overallAccuracyPercentage: overallPyqAccuracy,
          sessionsCount: allPyqSessions.length,
        },
      },
      subjectProgress,
      newChapters,
      oldShortNotes,
      daysSummary,
      tasks: enrichedTasks,
      pyqSessions: allPyqSessions,
      pyqAuditEvents: allPyqAudits,
      reflections: reflectionsWithHistory,
      taskAuditEvents: allTaskAudits,
      mentorFeedback: allFeedback.map((f) => ({
        ...f,
        versions: allFeedbackVersions.filter((fv) => fv.feedbackId === f.id),
      })),
      mockTests: allMockTests,
    };
  } catch (error) {
    console.error('Database query failed in getFullSprintState:', error);
    throw new Error('Failed to load study sprint data from database.', { cause: error });
  }
}

export async function updateTaskStatusAndNotes(
  taskId: number,
  payload: {
    status?: 'not_started' | 'in_progress' | 'completed';
    notes?: string;
    resourceLink?: string;
    overrideReason?: string;
  },
  actor: AuthenticatedProfile
) {
  try {
    return await db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(studyTasks)
        .where(eq(studyTasks.id, taskId));

      if (!task) {
        throw new ValidationError('Task not found.');
      }
      if (task.archivedAt !== null) {
        throw new ValidationError('Cannot modify an archived task.');
      }

      const [chapter] = await tx
        .select()
        .from(chapters)
        .where(eq(chapters.id, task.chapterId));

      if (!chapter) {
        throw new ValidationError('Associated chapter not found.');
      }

      const nextStatus = payload.status ?? (task.status as 'not_started' | 'in_progress' | 'completed');
      if (!['not_started', 'in_progress', 'completed'].includes(nextStatus)) {
        throw new ValidationError('Invalid task status. Allowed values: not_started, in_progress, completed.');
      }

      // Check Task #6 PYQ Target Gate if completing "Complete assigned PYQ target"
      const isPyqTargetTask =
        chapter.chapterType === 'new_chapter' &&
        (task.taskOrder === 6 ||
          task.title.toLowerCase().includes('complete assigned pyq target'));

      if (isPyqTargetTask && nextStatus === 'completed' && task.status !== 'completed') {
        const sessions = await tx
          .select()
          .from(pyqSessions)
          .where(eq(pyqSessions.chapterId, chapter.id));

        const totalAttempted = sessions.reduce((acc, s) => acc + s.attemptedCount, 0);
        const hasExistingOverride = Boolean(chapter.pyqTargetOverrideReason?.trim());
        const hasNewMentorOverride =
          actor.role === 'mentor' && Boolean(payload.overrideReason?.trim());

        if (
          totalAttempted < chapter.targetPyqCount &&
          !hasExistingOverride &&
          !hasNewMentorOverride
        ) {
          throw new ValidationError(
            `PYQ target not reached for ${chapter.chapterName}: ${totalAttempted} / ${chapter.targetPyqCount} PYQs attempted. Log at least ${chapter.targetPyqCount} PYQs in date-wise sessions before marking this task complete (or Mentor Nikhil can grant an audited override).`
          );
        }

        if (hasNewMentorOverride && payload.overrideReason) {
          await tx
            .update(chapters)
            .set({
              pyqTargetOverrideReason: payload.overrideReason.trim(),
              pyqTargetOverriddenBy: actor.displayName,
              pyqTargetOverriddenAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(chapters.id, chapter.id));

          await tx.insert(taskAuditEvents).values({
            taskId: task.id,
            chapterId: chapter.id,
            action: 'pyq_gate_override',
            previousStatus: task.status,
            newStatus: nextStatus,
            reason: payload.overrideReason.trim(),
            oldValue: `${totalAttempted}/${chapter.targetPyqCount} PYQs`,
            newValue: `Mentor override granted`,
            changedBy: actor.uid,
            changedByName: actor.displayName,
            changedByRole: actor.role,
            eventDateIst: getCurrentDateIst(),
          });
        }
      }

      const now = new Date();
      const todayIst = getCurrentDateIst(now);

      let completedAt = task.completedAt;
      let completedDateIst = task.completedDateIst;

      if (nextStatus === 'completed' && task.status !== 'completed') {
        completedAt = now;
        completedDateIst = todayIst;
      } else if (nextStatus !== 'completed') {
        completedAt = null;
        completedDateIst = null;
      }

      const nextNotes = payload.notes !== undefined ? payload.notes : task.notes;
      const nextResourceLink =
        payload.resourceLink !== undefined ? payload.resourceLink : task.resourceLink;

      const [updatedTask] = await tx
        .update(studyTasks)
        .set({
          status: nextStatus,
          completedAt,
          completedDateIst,
          notes: nextNotes,
          resourceLink: nextResourceLink,
          updatedAt: now,
        })
        .where(eq(studyTasks.id, task.id))
        .returning();

      // Record audit event for status change
      if (nextStatus !== task.status) {
        await tx.insert(taskAuditEvents).values({
          taskId: task.id,
          chapterId: chapter.id,
          action: 'status_changed',
          previousStatus: task.status,
          newStatus: nextStatus,
          previousDueDate: task.dueDate,
          newDueDate: task.dueDate,
          reason: payload.overrideReason?.trim() || '',
          oldValue: task.status,
          newValue: nextStatus,
          changedBy: actor.uid,
          changedByName: actor.displayName,
          changedByRole: actor.role,
          eventDateIst: todayIst,
        });
      } else if (nextNotes !== task.notes || nextResourceLink !== task.resourceLink) {
        await tx.insert(taskAuditEvents).values({
          taskId: task.id,
          chapterId: chapter.id,
          action: 'notes_updated',
          previousStatus: task.status,
          newStatus: nextStatus,
          previousDueDate: task.dueDate,
          newDueDate: task.dueDate,
          reason: 'Updated notes or resource link',
          oldValue: JSON.stringify({ notes: task.notes, resourceLink: task.resourceLink }),
          newValue: JSON.stringify({ notes: nextNotes, resourceLink: nextResourceLink }),
          changedBy: actor.uid,
          changedByName: actor.displayName,
          changedByRole: actor.role,
          eventDateIst: todayIst,
        });
      }

      // Sync chapter status & updatedAt
      const allChapterTasks = await tx
        .select()
        .from(studyTasks)
        .where(eq(studyTasks.chapterId, chapter.id));
      const activeChapterTasks = allChapterTasks.filter((t) => t.archivedAt === null);
      const allDone =
        activeChapterTasks.length > 0 &&
        activeChapterTasks.every((t) =>
          t.id === task.id ? nextStatus === 'completed' : t.status === 'completed'
        );
      const anyActive = activeChapterTasks.some((t) =>
        t.id === task.id ? nextStatus !== 'not_started' : t.status !== 'not_started'
      );
      const nextChapterStatus = allDone
        ? 'completed'
        : anyActive
        ? 'in_progress'
        : 'not_started';

      await tx
        .update(chapters)
        .set({
          status: nextChapterStatus,
          updatedAt: now,
        })
        .where(eq(chapters.id, chapter.id));

      return updatedTask;
    });
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    console.error('Failed to update task status:', error);
    throw new Error('Database error while updating task.', { cause: error });
  }
}

export async function rescheduleTaskByMentor(
  taskId: number,
  payload: {
    assignedDate?: string;
    dueDate: string;
    reason?: string;
  },
  actor: AuthenticatedProfile
) {
  if (actor.role !== 'mentor') {
    throw new ValidationError('Only Mentor (Titanium Nikhil) can reschedule tasks.');
  }
  if (!payload.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(payload.dueDate)) {
    throw new ValidationError('A valid due date (YYYY-MM-DD) is required.');
  }

  try {
    return await db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(studyTasks)
        .where(eq(studyTasks.id, taskId));

      if (!task) {
        throw new ValidationError('Task not found.');
      }

      const nextAssignedDate = payload.assignedDate || task.assignedDate;
      const nextDueDate = payload.dueDate;
      const isRescheduled =
        nextDueDate !== task.originalDueDate ||
        nextAssignedDate !== task.originalAssignedDate;

      const [updated] = await tx
        .update(studyTasks)
        .set({
          assignedDate: nextAssignedDate,
          dueDate: nextDueDate,
          isRescheduled,
          rescheduleCount: task.rescheduleCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(studyTasks.id, task.id))
        .returning();

      await tx.insert(taskAuditEvents).values({
        taskId: task.id,
        chapterId: task.chapterId,
        action: 'rescheduled',
        previousStatus: task.status,
        newStatus: task.status,
        previousDueDate: task.dueDate,
        newDueDate: nextDueDate,
        reason: payload.reason?.trim() || 'Rescheduled by mentor',
        oldValue: `${task.assignedDate} -> ${task.dueDate} (orig: ${task.originalDueDate})`,
        newValue: `${nextAssignedDate} -> ${nextDueDate}`,
        changedBy: actor.uid,
        changedByName: actor.displayName,
        changedByRole: actor.role,
        eventDateIst: getCurrentDateIst(),
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    console.error('Failed to reschedule task:', error);
    throw new Error('Failed to reschedule task in database.', { cause: error });
  }
}

export async function createCustomTaskByMentor(
  payload: {
    chapterId: number;
    title: string;
    description?: string;
    taskType: string;
    assignedDate: string;
    dueDate: string;
    estimatedMinutes?: number;
  },
  actor: AuthenticatedProfile
) {
  if (actor.role !== 'mentor') {
    throw new ValidationError('Only Mentor (Titanium Nikhil) can create assigned tasks.');
  }
  if (!payload.title?.trim()) {
    throw new ValidationError('Task title is required.');
  }

  try {
    return await db.transaction(async (tx) => {
      const [chapter] = await tx
        .select()
        .from(chapters)
        .where(eq(chapters.id, payload.chapterId));

      if (!chapter) {
        throw new ValidationError('Selected chapter does not exist.');
      }

      const existingTasks = await tx
        .select()
        .from(studyTasks)
        .where(eq(studyTasks.chapterId, chapter.id));

      const nextOrder = existingTasks.length + 1;
      const taskCode = `${chapter.chapterCode}-custom-${Date.now()}`;

      const [inserted] = await tx
        .insert(studyTasks)
        .values({
          sprintId: chapter.sprintId,
          chapterId: chapter.id,
          taskCode,
          taskOrder: nextOrder,
          title: payload.title.trim(),
          description: payload.description?.trim() || '',
          taskType: payload.taskType || 'Other',
          originalAssignedDate: payload.assignedDate,
          originalDueDate: payload.dueDate,
          assignedDate: payload.assignedDate,
          dueDate: payload.dueDate,
          isRescheduled: false,
          rescheduleCount: 0,
          status: 'not_started',
          estimatedMinutes: payload.estimatedMinutes || 45,
          createdBy: actor.uid,
        })
        .returning();

      await tx.insert(taskAuditEvents).values({
        taskId: inserted.id,
        chapterId: chapter.id,
        action: 'task_created',
        previousStatus: '',
        newStatus: 'not_started',
        previousDueDate: '',
        newDueDate: payload.dueDate,
        reason: 'Created by mentor',
        oldValue: '',
        newValue: inserted.title,
        changedBy: actor.uid,
        changedByName: actor.displayName,
        changedByRole: actor.role,
        eventDateIst: getCurrentDateIst(),
      });

      return inserted;
    });
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    console.error('Failed to create custom task:', error);
    throw new Error('Failed to create custom task.', { cause: error });
  }
}

export async function archiveOrRestoreTaskByMentor(
  taskId: number,
  archive: boolean,
  reason: string,
  actor: AuthenticatedProfile
) {
  if (actor.role !== 'mentor') {
    throw new ValidationError('Only Mentor (Titanium Nikhil) can archive or restore tasks.');
  }

  try {
    return await db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(studyTasks)
        .where(eq(studyTasks.id, taskId));

      if (!task) {
        throw new ValidationError('Task not found.');
      }

      const [updated] = await tx
        .update(studyTasks)
        .set({
          archivedAt: archive ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(studyTasks.id, task.id))
        .returning();

      await tx.insert(taskAuditEvents).values({
        taskId: task.id,
        chapterId: task.chapterId,
        action: archive ? 'task_archived' : 'task_restored',
        previousStatus: task.status,
        newStatus: task.status,
        previousDueDate: task.dueDate,
        newDueDate: task.dueDate,
        reason: reason?.trim() || (archive ? 'Soft-archived by mentor' : 'Restored by mentor'),
        oldValue: archive ? 'active' : 'archived',
        newValue: archive ? 'archived' : 'active',
        changedBy: actor.uid,
        changedByName: actor.displayName,
        changedByRole: actor.role,
        eventDateIst: getCurrentDateIst(),
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    console.error('Failed to archive/restore task:', error);
    throw new Error('Failed to update task archive status.', { cause: error });
  }
}

export async function updateChapterTargetsByMentor(
  chapterId: number,
  payload: {
    targetStartDate?: string;
    targetEndDate?: string;
    targetPyqCount?: number;
    pyqTargetOverrideReason?: string;
  },
  actor: AuthenticatedProfile
) {
  if (actor.role !== 'mentor') {
    throw new ValidationError('Only Mentor (Titanium Nikhil) can modify chapter targets.');
  }

  try {
    return await db.transaction(async (tx) => {
      const [ch] = await tx
        .select()
        .from(chapters)
        .where(eq(chapters.id, chapterId));

      if (!ch) {
        throw new ValidationError('Chapter not found.');
      }

      const nextPyqTarget =
        payload.targetPyqCount !== undefined ? Number(payload.targetPyqCount) : ch.targetPyqCount;
      if (ch.chapterType === 'new_chapter' && (!Number.isInteger(nextPyqTarget) || nextPyqTarget <= 0)) {
        throw new ValidationError('Target PYQ count must be a positive integer.');
      }

      const nextStartDate = payload.targetStartDate || ch.targetStartDate;
      const nextEndDate = payload.targetEndDate || ch.targetEndDate;
      const nextOverrideReason =
        payload.pyqTargetOverrideReason !== undefined
          ? payload.pyqTargetOverrideReason.trim()
          : ch.pyqTargetOverrideReason;

      const [updated] = await tx
        .update(chapters)
        .set({
          targetStartDate: nextStartDate,
          targetEndDate: nextEndDate,
          targetPyqCount: nextPyqTarget,
          pyqTargetOverrideReason: nextOverrideReason,
          pyqTargetOverriddenBy: nextOverrideReason ? actor.displayName : ch.pyqTargetOverriddenBy,
          pyqTargetOverriddenAt: nextOverrideReason ? new Date() : ch.pyqTargetOverriddenAt,
          updatedAt: new Date(),
        })
        .where(eq(chapters.id, ch.id))
        .returning();

      await tx.insert(pyqSessionAuditEvents).values({
        sessionId: null,
        chapterId: ch.id,
        action:
          nextOverrideReason !== ch.pyqTargetOverrideReason
            ? 'target_override_granted'
            : 'target_updated',
        oldValue: JSON.stringify({
          targetStartDate: ch.targetStartDate,
          targetEndDate: ch.targetEndDate,
          targetPyqCount: ch.targetPyqCount,
          pyqTargetOverrideReason: ch.pyqTargetOverrideReason,
        }),
        newValue: JSON.stringify({
          targetStartDate: nextStartDate,
          targetEndDate: nextEndDate,
          targetPyqCount: nextPyqTarget,
          pyqTargetOverrideReason: nextOverrideReason,
        }),
        reason: nextOverrideReason || 'Updated chapter target settings',
        changedBy: actor.uid,
        changedByName: actor.displayName,
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    console.error('Failed to update chapter targets:', error);
    throw new Error('Failed to update chapter targets.', { cause: error });
  }
}

export async function logOrUpdatePyqSession(
  payload: {
    sessionId?: number;
    chapterId: number;
    practiceDate: string;
    attemptedCount: number;
    correctCount: number;
    incorrectCount: number;
    unclassifiedCount: number;
    notes?: string;
    reason?: string;
  },
  actor: AuthenticatedProfile
) {
  const attempted = Number(payload.attemptedCount);
  const correct = Number(payload.correctCount);
  const incorrect = Number(payload.incorrectCount);
  const unclassified = Number(payload.unclassifiedCount);

  if (
    !Number.isInteger(attempted) ||
    !Number.isInteger(correct) ||
    !Number.isInteger(incorrect) ||
    !Number.isInteger(unclassified)
  ) {
    throw new ValidationError('PYQ counts must be whole numbers.');
  }
  if (attempted < 0 || correct < 0 || incorrect < 0 || unclassified < 0) {
    throw new ValidationError('PYQ counts cannot be negative.');
  }
  if (correct + incorrect > attempted) {
    throw new ValidationError('Attempted PYQs cannot be less than Correct + Incorrect.');
  }
  if (correct + incorrect + unclassified !== attempted) {
    throw new ValidationError(
      `Correct (${correct}) + Incorrect (${incorrect}) + Unclassified (${unclassified}) must equal Attempted (${attempted}).`
    );
  }
  if (!payload.practiceDate || !/^\d{4}-\d{2}-\d{2}$/.test(payload.practiceDate)) {
    throw new ValidationError('A valid practice date (YYYY-MM-DD) is required.');
  }

  try {
    return await db.transaction(async (tx) => {
      const [ch] = await tx
        .select()
        .from(chapters)
        .where(eq(chapters.id, payload.chapterId));

      if (!ch) {
        throw new ValidationError('Chapter not found.');
      }

      if (payload.sessionId) {
        const [existing] = await tx
          .select()
          .from(pyqSessions)
          .where(eq(pyqSessions.id, payload.sessionId));

        if (!existing) {
          throw new ValidationError('PYQ session record not found.');
        }

        const [updated] = await tx
          .update(pyqSessions)
          .set({
            practiceDate: payload.practiceDate,
            attemptedCount: attempted,
            correctCount: correct,
            incorrectCount: incorrect,
            unclassifiedCount: unclassified,
            notes: payload.notes?.trim() ?? existing.notes,
            updatedAt: new Date(),
          })
          .where(eq(pyqSessions.id, existing.id))
          .returning();

        await tx.insert(pyqSessionAuditEvents).values({
          sessionId: existing.id,
          chapterId: ch.id,
          action: 'session_corrected',
          oldValue: JSON.stringify({
            practiceDate: existing.practiceDate,
            attempted: existing.attemptedCount,
            correct: existing.correctCount,
            incorrect: existing.incorrectCount,
            unclassified: existing.unclassifiedCount,
            notes: existing.notes,
          }),
          newValue: JSON.stringify({
            practiceDate: updated.practiceDate,
            attempted: updated.attemptedCount,
            correct: updated.correctCount,
            incorrect: updated.incorrectCount,
            unclassified: updated.unclassifiedCount,
            notes: updated.notes,
          }),
          reason: payload.reason?.trim() || 'Session figures updated',
          changedBy: actor.uid,
          changedByName: actor.displayName,
        });

        await tx
          .update(chapters)
          .set({ updatedAt: new Date() })
          .where(eq(chapters.id, ch.id));

        return updated;
      } else {
        const [inserted] = await tx
          .insert(pyqSessions)
          .values({
            sprintId: ch.sprintId,
            chapterId: ch.id,
            studentUid: CANONICAL_STUDENT_UID,
            practiceDate: payload.practiceDate,
            attemptedCount: attempted,
            correctCount: correct,
            incorrectCount: incorrect,
            unclassifiedCount: unclassified,
            notes: payload.notes?.trim() || '',
            createdBy: actor.uid,
          })
          .returning();

        await tx.insert(pyqSessionAuditEvents).values({
          sessionId: inserted.id,
          chapterId: ch.id,
          action: 'session_logged',
          oldValue: '',
          newValue: JSON.stringify({
            practiceDate: inserted.practiceDate,
            attempted: inserted.attemptedCount,
            correct: inserted.correctCount,
            incorrect: inserted.incorrectCount,
            unclassified: inserted.unclassifiedCount,
            notes: inserted.notes,
          }),
          reason: 'New PYQ practice session logged',
          changedBy: actor.uid,
          changedByName: actor.displayName,
        });

        await tx
          .update(chapters)
          .set({ updatedAt: new Date() })
          .where(eq(chapters.id, ch.id));

        return inserted;
      }
    });
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    console.error('Failed to save PYQ session:', error);
    throw new Error('Database error while saving PYQ session.', { cause: error });
  }
}

export async function saveDailyReflectionWithOCC(
  payload: {
    reflectionDate: string;
    whatDidYouDo: string;
    tomorrowPlan: string;
    todayRegret: string;
    todayAchievement: string;
    mode: 'draft' | 'submit';
    expectedVersion: number;
  },
  actor: AuthenticatedProfile
) {
  if (!payload.reflectionDate || !/^\d{4}-\d{2}-\d{2}$/.test(payload.reflectionDate)) {
    throw new ValidationError('A valid reflection date (YYYY-MM-DD) is required.');
  }

  const q1 = (payload.whatDidYouDo ?? '').trim();
  const q2 = (payload.tomorrowPlan ?? '').trim();
  const q3 = (payload.todayRegret ?? '').trim();
  const q4 = (payload.todayAchievement ?? '').trim();

  if (payload.mode === 'submit') {
    if (!q1 || !q2 || !q3 || !q4) {
      throw new ValidationError(
        'All four Hinglish reflection questions must be answered before submitting the daily report. You can click "Save Draft" to save partial progress.'
      );
    }
  } else {
    if (!q1 && !q2 && !q3 && !q4) {
      throw new ValidationError('Please write at least one response before saving a draft.');
    }
  }

  try {
    return await db.transaction(async (tx) => {
      const [sprint] = await tx
        .select()
        .from(studySprints)
        .where(eq(studySprints.slug, SPRINT_SLUG));

      if (!sprint) {
        throw new Error('Sprint not found.');
      }

      const existingRows = await tx
        .select()
        .from(dailyReflections)
        .where(eq(dailyReflections.reflectionDate, payload.reflectionDate));

      const existing = existingRows[0];
      const now = new Date();

      if (!existing) {
        // Optimistic concurrency check on creation: expectedVersion must be 0
        if (payload.expectedVersion && payload.expectedVersion !== 0) {
          throw new ConcurrencyConflictError(
            'Version mismatch: expected an existing reflection version, but none was found.',
            null
          );
        }

        const initialStatus =
          payload.mode === 'submit' ? 'submitted' : 'draft_saved';

        const [created] = await tx
          .insert(dailyReflections)
          .values({
            sprintId: sprint.id,
            studentUid: CANONICAL_STUDENT_UID,
            reflectionDate: payload.reflectionDate,
            currentVersion: 1,
            status: initialStatus,
            whatDidYouDo: q1,
            tomorrowPlan: q2,
            todayRegret: q3,
            todayAchievement: q4,
            submittedAt: payload.mode === 'submit' ? now : null,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        const [versionRow] = await tx
          .insert(reflectionVersions)
          .values({
            reflectionId: created.id,
            reflectionDate: payload.reflectionDate,
            versionNumber: 1,
            whatDidYouDo: q1,
            tomorrowPlan: q2,
            todayRegret: q3,
            todayAchievement: q4,
            changeType: initialStatus,
            editedBy: actor.uid,
            editedByName: actor.displayName,
            editedByRole: actor.role,
            editedAt: now,
          })
          .returning();

        return {
          reflection: created,
          latestVersion: versionRow,
          noOp: false,
        };
      }

      // Existing reflection found — verify Optimistic Concurrency Control (Requirement #2)
      if (
        payload.expectedVersion === undefined ||
        payload.expectedVersion === null ||
        Number(payload.expectedVersion) !== existing.currentVersion
      ) {
        const versions = await tx
          .select()
          .from(reflectionVersions)
          .where(eq(reflectionVersions.reflectionId, existing.id))
          .orderBy(desc(reflectionVersions.versionNumber));

        throw new ConcurrencyConflictError(
          `Concurrent edit conflict detected for ${payload.reflectionDate}: your form was based on version v${payload.expectedVersion ?? 0}, but the server is already at version v${existing.currentVersion}. Your unsaved text has been preserved so you can review and retry.`,
          {
            ...existing,
            versions,
          }
        );
      }

      const wasEverSubmitted = existing.submittedAt !== null;
      let nextStatus: 'draft_saved' | 'submitted' | 'edited_after_submission';
      let changeType: 'draft_saved' | 'submitted' | 'edited_after_submission';

      if (wasEverSubmitted) {
        nextStatus = 'edited_after_submission';
        changeType = 'edited_after_submission';
      } else if (payload.mode === 'submit') {
        nextStatus = 'submitted';
        changeType = 'submitted';
      } else {
        nextStatus = 'draft_saved';
        changeType = 'draft_saved';
      }

      const contentChanged =
        existing.whatDidYouDo !== q1 ||
        existing.tomorrowPlan !== q2 ||
        existing.todayRegret !== q3 ||
        existing.todayAchievement !== q4;

      const statusPromoted = existing.status !== nextStatus;

      // Do not create duplicate history records if submitted data is identical to currently saved version
      if (!contentChanged && !statusPromoted) {
        const versions = await tx
          .select()
          .from(reflectionVersions)
          .where(eq(reflectionVersions.reflectionId, existing.id))
          .orderBy(desc(reflectionVersions.versionNumber));

        return {
          reflection: existing,
          latestVersion: versions[0],
          noOp: true,
        };
      }

      const nextVersionNumber = existing.currentVersion + 1;
      const nextSubmittedAt =
        existing.submittedAt || (payload.mode === 'submit' ? now : null);

      const [updated] = await tx
        .update(dailyReflections)
        .set({
          currentVersion: nextVersionNumber,
          status: nextStatus,
          whatDidYouDo: q1,
          tomorrowPlan: q2,
          todayRegret: q3,
          todayAchievement: q4,
          submittedAt: nextSubmittedAt,
          updatedAt: now,
        })
        .where(eq(dailyReflections.id, existing.id))
        .returning();

      const [versionRow] = await tx
        .insert(reflectionVersions)
        .values({
          reflectionId: existing.id,
          reflectionDate: payload.reflectionDate,
          versionNumber: nextVersionNumber,
          whatDidYouDo: q1,
          tomorrowPlan: q2,
          todayRegret: q3,
          todayAchievement: q4,
          changeType,
          editedBy: actor.uid,
          editedByName: actor.displayName,
          editedByRole: actor.role,
          editedAt: now,
        })
        .returning();

      return {
        reflection: updated,
        latestVersion: versionRow,
        noOp: false,
      };
    });
  } catch (error) {
    if (error instanceof ConcurrencyConflictError || error instanceof ValidationError) {
      throw error;
    }
    console.error('Database error in saveDailyReflectionWithOCC:', error);
    throw new Error('Failed to save daily reflection to database.', { cause: error });
  }
}

export async function saveMentorFeedback(
  payload: {
    feedbackId?: number;
    reflectionDate: string;
    feedbackText: string;
  },
  actor: AuthenticatedProfile
) {
  if (actor.role !== 'mentor') {
    throw new ValidationError('Only Mentor (Titanium Nikhil) can add or edit mentor feedback.');
  }
  const text = (payload.feedbackText || '').trim();
  if (!text) {
    throw new ValidationError('Feedback text cannot be empty.');
  }

  try {
    return await db.transaction(async (tx) => {
      const [sprint] = await tx
        .select()
        .from(studySprints)
        .where(eq(studySprints.slug, SPRINT_SLUG));

      if (!sprint) throw new Error('Sprint not found.');

      const [reflection] = await tx
        .select()
        .from(dailyReflections)
        .where(eq(dailyReflections.reflectionDate, payload.reflectionDate));

      if (payload.feedbackId) {
        const [existing] = await tx
          .select()
          .from(mentorFeedback)
          .where(eq(mentorFeedback.id, payload.feedbackId));

        if (!existing) {
          throw new ValidationError('Feedback record not found.');
        }

        const nextVer = existing.versionNumber + 1;
        const [updated] = await tx
          .update(mentorFeedback)
          .set({
            feedbackText: text,
            versionNumber: nextVer,
            updatedAt: new Date(),
          })
          .where(eq(mentorFeedback.id, existing.id))
          .returning();

        await tx.insert(mentorFeedbackVersions).values({
          feedbackId: existing.id,
          versionNumber: nextVer,
          feedbackText: text,
          editedBy: actor.displayName,
        });

        return updated;
      } else {
        const [inserted] = await tx
          .insert(mentorFeedback)
          .values({
            sprintId: sprint.id,
            reflectionDate: payload.reflectionDate,
            reflectionId: reflection ? reflection.id : null,
            mentorUid: actor.uid,
            mentorName: actor.displayName,
            feedbackText: text,
            versionNumber: 1,
          })
          .returning();

        await tx.insert(mentorFeedbackVersions).values({
          feedbackId: inserted.id,
          versionNumber: 1,
          feedbackText: text,
          editedBy: actor.displayName,
        });

        return inserted;
      }
    });
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    console.error('Failed to save mentor feedback:', error);
    throw new Error('Failed to save mentor feedback.', { cause: error });
  }
}

export async function updateMockTestRecord(
  mockId: number,
  payload: {
    physicsMarks: number | null;
    chemistryMarks: number | null;
    mathsMarks: number | null;
    attempted: number | null;
    correct: number | null;
    incorrect: number | null;
    notes?: string;
    mentorAnalysis?: string;
  },
  actor: AuthenticatedProfile
) {
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(mockTests)
        .where(eq(mockTests.id, mockId));

      if (!existing) {
        throw new ValidationError('Mock test record not found.');
      }

      const hasScores =
        payload.physicsMarks !== null &&
        payload.physicsMarks !== undefined &&
        payload.chemistryMarks !== null &&
        payload.chemistryMarks !== undefined &&
        payload.mathsMarks !== null &&
        payload.mathsMarks !== undefined;

      let phy: number | null = existing.physicsMarks;
      let chem: number | null = existing.chemistryMarks;
      let math: number | null = existing.mathsMarks;
      let att: number | null = existing.attempted;
      let corr: number | null = existing.correct;
      let incorr: number | null = existing.incorrect;

      if (hasScores) {
        phy = Number(payload.physicsMarks);
        chem = Number(payload.chemistryMarks);
        math = Number(payload.mathsMarks);
        att = Number(payload.attempted ?? 0);
        corr = Number(payload.correct ?? 0);
        incorr = Number(payload.incorrect ?? 0);

        if (phy < -25 || phy > 100 || chem < -25 || chem > 100 || math < -25 || math > 100) {
          throw new ValidationError('Each subject score must be between -25 and 100.');
        }
        if (att < 0 || corr < 0 || incorr < 0 || corr + incorr > att) {
          throw new ValidationError(
            'Attempted questions must be non-negative and equal to or greater than Correct + Incorrect.'
          );
        }
      }

      const nextNotes = payload.notes !== undefined ? payload.notes.trim() : existing.notes;
      // Only mentor can update mentorAnalysis
      const nextMentorAnalysis =
        actor.role === 'mentor' && payload.mentorAnalysis !== undefined
          ? payload.mentorAnalysis.trim()
          : existing.mentorAnalysis;

      const [updated] = await tx
        .update(mockTests)
        .set({
          physicsMarks: phy,
          chemistryMarks: chem,
          mathsMarks: math,
          attempted: att,
          correct: corr,
          incorrect: incorr,
          notes: nextNotes,
          mentorAnalysis: nextMentorAnalysis,
          recordedAt: hasScores ? existing.recordedAt || new Date() : existing.recordedAt,
          updatedAt: new Date(),
        })
        .where(eq(mockTests.id, existing.id))
        .returning();

      return updated;
    });
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    console.error('Failed to update mock test record:', error);
    throw new Error('Failed to save mock test record.', { cause: error });
  }
}
