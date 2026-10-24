import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  role: text('role').notNull(), // 'mentor' | 'student'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const mentorStudentLinks = pgTable('mentor_student_links', {
  id: serial('id').primaryKey(),
  mentorUid: text('mentor_uid').notNull(),
  studentUid: text('student_uid').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const studySprints = pgTable('study_sprints', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  studentUid: text('student_uid').notNull(),
  mentorUid: text('mentor_uid').notNull(),
  title: text('title').notNull(),
  originalStartDate: text('original_start_date').notNull(),
  originalEndDate: text('original_end_date').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  mockTargetDate: text('mock_target_date').notNull(),
  timezone: text('timezone').notNull(),
  dailyCapacityHours: text('daily_capacity_hours').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const chapters = pgTable('chapters', {
  id: serial('id').primaryKey(),
  sprintId: integer('sprint_id')
    .references(() => studySprints.id)
    .notNull(),
  chapterCode: text('chapter_code').notNull().unique(),
  subject: text('subject').notNull(), // 'Physics' | 'Chemistry' | 'Mathematics'
  chapterName: text('chapter_name').notNull(),
  chapterType: text('chapter_type').notNull(), // 'new_chapter' | 'old_short_notes'
  chapterOrder: integer('chapter_order').notNull(),
  originalTargetStartDate: text('original_target_start_date').notNull(),
  originalTargetEndDate: text('original_target_end_date').notNull(),
  targetStartDate: text('target_start_date').notNull(),
  targetEndDate: text('target_end_date').notNull(),
  targetPyqCount: integer('target_pyq_count').notNull().default(30),
  pyqTargetOverrideReason: text('pyq_target_override_reason').notNull().default(''),
  pyqTargetOverriddenBy: text('pyq_target_overridden_by').notNull().default(''),
  pyqTargetOverriddenAt: timestamp('pyq_target_overridden_at', { withTimezone: true }),
  status: text('status').notNull().default('not_started'), // 'not_started' | 'in_progress' | 'completed'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const studyTasks = pgTable('study_tasks', {
  id: serial('id').primaryKey(),
  sprintId: integer('sprint_id')
    .references(() => studySprints.id)
    .notNull(),
  chapterId: integer('chapter_id')
    .references(() => chapters.id)
    .notNull(),
  taskCode: text('task_code').notNull().unique(),
  taskOrder: integer('task_order').notNull().default(1),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  taskType: text('task_type').notNull(), // 'Lecture' | 'Concept review' | 'PYQ' | 'Short notes' | 'Revision' | 'Test' | 'Mistake analysis' | 'Old chapter notes' | 'Other'
  originalAssignedDate: text('original_assigned_date').notNull(),
  originalDueDate: text('original_due_date').notNull(),
  assignedDate: text('assigned_date').notNull(),
  dueDate: text('due_date').notNull(),
  isRescheduled: boolean('is_rescheduled').notNull().default(false),
  rescheduleCount: integer('reschedule_count').notNull().default(0),
  status: text('status').notNull().default('not_started'), // 'not_started' | 'in_progress' | 'completed'
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completedDateIst: text('completed_date_ist'), // YYYY-MM-DD in Asia/Kolkata when marked completed
  notes: text('notes').notNull().default(''),
  resourceLink: text('resource_link').notNull().default(''),
  estimatedMinutes: integer('estimated_minutes').notNull().default(45),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
});

export const pyqSessions = pgTable('pyq_sessions', {
  id: serial('id').primaryKey(),
  sprintId: integer('sprint_id')
    .references(() => studySprints.id)
    .notNull(),
  chapterId: integer('chapter_id')
    .references(() => chapters.id)
    .notNull(),
  studentUid: text('student_uid').notNull(),
  practiceDate: text('practice_date').notNull(), // YYYY-MM-DD
  attemptedCount: integer('attempted_count').notNull(),
  correctCount: integer('correct_count').notNull(),
  incorrectCount: integer('incorrect_count').notNull(),
  unclassifiedCount: integer('unclassified_count').notNull(),
  notes: text('notes').notNull().default(''),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const pyqSessionAuditEvents = pgTable('pyq_session_audit_events', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id'),
  chapterId: integer('chapter_id')
    .references(() => chapters.id)
    .notNull(),
  action: text('action').notNull(), // 'session_logged' | 'session_corrected' | 'target_updated' | 'target_override_granted'
  oldValue: text('old_value').notNull().default(''),
  newValue: text('new_value').notNull().default(''),
  reason: text('reason').notNull().default(''),
  changedBy: text('changed_by').notNull(),
  changedByName: text('changed_by_name').notNull(),
  changedAt: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
});

export const dailyReflections = pgTable('daily_reflections', {
  id: serial('id').primaryKey(),
  sprintId: integer('sprint_id')
    .references(() => studySprints.id)
    .notNull(),
  studentUid: text('student_uid').notNull(),
  reflectionDate: text('reflection_date').notNull().unique(), // YYYY-MM-DD
  currentVersion: integer('current_version').notNull().default(1),
  status: text('status').notNull().default('draft_saved'), // 'draft_saved' | 'submitted' | 'edited_after_submission'
  whatDidYouDo: text('what_did_you_do').notNull().default(''),
  tomorrowPlan: text('tomorrow_plan').notNull().default(''),
  todayRegret: text('today_regret').notNull().default(''),
  todayAchievement: text('today_achievement').notNull().default(''),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const reflectionVersions = pgTable('reflection_versions', {
  id: serial('id').primaryKey(),
  reflectionId: integer('reflection_id')
    .references(() => dailyReflections.id)
    .notNull(),
  reflectionDate: text('reflection_date').notNull(),
  versionNumber: integer('version_number').notNull(),
  whatDidYouDo: text('what_did_you_do').notNull(),
  tomorrowPlan: text('tomorrow_plan').notNull(),
  todayRegret: text('today_regret').notNull(),
  todayAchievement: text('today_achievement').notNull(),
  changeType: text('change_type').notNull(), // 'draft_saved' | 'submitted' | 'edited_after_submission'
  editedBy: text('edited_by').notNull(),
  editedByName: text('edited_by_name').notNull(),
  editedByRole: text('edited_by_role').notNull(),
  editedAt: timestamp('edited_at', { withTimezone: true }).defaultNow().notNull(),
});

export const taskAuditEvents = pgTable('task_audit_events', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id')
    .references(() => studyTasks.id)
    .notNull(),
  chapterId: integer('chapter_id')
    .references(() => chapters.id)
    .notNull(),
  action: text('action').notNull(), // 'status_changed' | 'rescheduled' | 'notes_updated' | 'task_created' | 'task_archived' | 'task_restored' | 'pyq_gate_override'
  previousStatus: text('previous_status').notNull().default(''),
  newStatus: text('new_status').notNull().default(''),
  previousDueDate: text('previous_due_date').notNull().default(''),
  newDueDate: text('new_due_date').notNull().default(''),
  reason: text('reason').notNull().default(''),
  oldValue: text('old_value').notNull().default(''),
  newValue: text('new_value').notNull().default(''),
  changedBy: text('changed_by').notNull(),
  changedByName: text('changed_by_name').notNull(),
  changedByRole: text('changed_by_role').notNull(),
  eventDateIst: text('event_date_ist').notNull(), // YYYY-MM-DD in Asia/Kolkata
  changedAt: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
});

export const mentorFeedback = pgTable('mentor_feedback', {
  id: serial('id').primaryKey(),
  sprintId: integer('sprint_id')
    .references(() => studySprints.id)
    .notNull(),
  reflectionDate: text('reflection_date').notNull(),
  reflectionId: integer('reflection_id'),
  mentorUid: text('mentor_uid').notNull(),
  mentorName: text('mentor_name').notNull(),
  feedbackText: text('feedback_text').notNull(),
  versionNumber: integer('version_number').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const mentorFeedbackVersions = pgTable('mentor_feedback_versions', {
  id: serial('id').primaryKey(),
  feedbackId: integer('feedback_id')
    .references(() => mentorFeedback.id)
    .notNull(),
  versionNumber: integer('version_number').notNull(),
  feedbackText: text('feedback_text').notNull(),
  editedBy: text('edited_by').notNull(),
  editedAt: timestamp('edited_at', { withTimezone: true }).defaultNow().notNull(),
});

export const mockTests = pgTable('mock_tests', {
  id: serial('id').primaryKey(),
  sprintId: integer('sprint_id')
    .references(() => studySprints.id)
    .notNull(),
  mockCode: text('mock_code').notNull().unique(),
  studentUid: text('student_uid').notNull(),
  testDate: text('test_date').notNull(),
  testName: text('test_name').notNull(),
  maximumMarks: integer('maximum_marks').notNull().default(300),
  physicsMarks: integer('physics_marks'),
  chemistryMarks: integer('chemistry_marks'),
  mathsMarks: integer('maths_marks'),
  attempted: integer('attempted'),
  correct: integer('correct'),
  incorrect: integer('incorrect'),
  notes: text('notes').notNull().default(''),
  mentorAnalysis: text('mentor_analysis').notNull().default(''),
  recordedAt: timestamp('recorded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
