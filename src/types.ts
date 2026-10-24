export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'mentor' | 'student';
  authMethod: 'firebase' | 'seat_session';
}

export interface StudyTask {
  id: number;
  sprintId: number;
  chapterId: number;
  taskCode: string;
  taskOrder: number;
  title: string;
  description: string;
  taskType: string;
  originalAssignedDate: string;
  originalDueDate: string;
  assignedDate: string;
  dueDate: string;
  isRescheduled: boolean;
  rescheduleCount: number;
  status: 'not_started' | 'in_progress' | 'completed';
  completedAt: string | null;
  completedDateIst: string | null;
  notes: string;
  resourceLink: string;
  estimatedMinutes: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapterName: string;
  chapterType: 'new_chapter' | 'old_short_notes';
  isArchived: boolean;
  isOverdue: boolean;
}

export interface PyqSession {
  id: number;
  sprintId: number;
  chapterId: number;
  studentUid: string;
  practiceDate: string;
  attemptedCount: number;
  correctCount: number;
  incorrectCount: number;
  unclassifiedCount: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PyqAuditEvent {
  id: number;
  sessionId: number | null;
  chapterId: number;
  action: string;
  oldValue: string;
  newValue: string;
  reason: string;
  changedBy: string;
  changedByName: string;
  changedAt: string;
}

export interface NewChapterSummary {
  id: number;
  sprintId: number;
  chapterCode: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapterName: string;
  chapterType: 'new_chapter';
  chapterOrder: number;
  originalTargetStartDate: string;
  originalTargetEndDate: string;
  targetStartDate: string;
  targetEndDate: string;
  targetPyqCount: number;
  pyqTargetOverrideReason: string;
  pyqTargetOverriddenBy: string;
  pyqTargetOverriddenAt: string | null;
  status: 'not_started' | 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  completionPercentage: number;
  oneShotStatus: 'Not Started' | 'In Progress' | 'Completed';
  shortNotesStatus: 'Not Started' | 'In Progress' | 'Completed';
  revisionStatus: 'Not Started' | 'In Progress' | 'Completed';
  pyqSummary: {
    targetCount: number;
    attemptedCount: number;
    correctCount: number;
    incorrectCount: number;
    unclassifiedCount: number;
    progressPercentage: number;
    accuracyPercentage: number | null;
    lastPracticeDate: string | null;
    sessions: PyqSession[];
  };
  tasks: StudyTask[];
}

export interface OldShortNoteItem {
  id: number;
  sprintId: number;
  chapterCode: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapterName: string;
  chapterType: 'old_short_notes';
  chapterOrder: number;
  originalTargetStartDate: string;
  originalTargetEndDate: string;
  targetStartDate: string;
  targetEndDate: string;
  status: 'not_started' | 'in_progress' | 'completed';
  updatedAt: string;
  task: StudyTask | null;
  completedAt: string | null;
  completedDateIst: string | null;
  notes: string;
  resourceLink: string;
  dueDate: string;
  originalDueDate: string;
  isOverdue: boolean;
  isRescheduled: boolean;
}

export interface ReflectionVersion {
  id: number;
  reflectionId: number;
  reflectionDate: string;
  versionNumber: number;
  whatDidYouDo: string;
  tomorrowPlan: string;
  todayRegret: string;
  todayAchievement: string;
  changeType: 'draft_saved' | 'submitted' | 'edited_after_submission';
  editedBy: string;
  editedByName: string;
  editedByRole: string;
  editedAt: string;
}

export interface MentorFeedbackVersion {
  id: number;
  feedbackId: number;
  versionNumber: number;
  feedbackText: string;
  editedBy: string;
  editedAt: string;
}

export interface MentorFeedbackItem {
  id: number;
  sprintId: number;
  reflectionDate: string;
  reflectionId: number | null;
  mentorUid: string;
  mentorName: string;
  feedbackText: string;
  versionNumber: number;
  createdAt: string;
  updatedAt: string;
  versions: MentorFeedbackVersion[];
}

export interface DailyReflectionRecord {
  id: number;
  sprintId: number;
  studentUid: string;
  reflectionDate: string;
  currentVersion: number;
  status: 'draft_saved' | 'submitted' | 'edited_after_submission';
  whatDidYouDo: string;
  tomorrowPlan: string;
  todayRegret: string;
  todayAchievement: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  versions: ReflectionVersion[];
  editCount: number;
  feedback: MentorFeedbackItem[];
}

export interface DaySummaryItem {
  dayNumber: number;
  date: string;
  label: string;
  shortLabel: string;
  assignedCount: number;
  completedCount: number;
  pendingCount: number;
  completionPercentage: number | null;
  plannedTasksDue: StudyTask[];
  activeSpanTasks: StudyTask[];
  carryForwardCount: number;
  oldNotesTotal: number;
  oldNotesCompleted: number;
  oldNotesPercentage: number | null;
  oldNotes: OldShortNoteItem[];
  actualActivity: {
    tasksCompletedCount: number;
    tasksCompleted: StudyTask[];
    auditEventsCount: number;
    pyqSessionsCount: number;
    pyqsAttemptedCount: number;
    hasReflectionActivity: boolean;
  };
  reflectionStatus: 'none' | 'draft_saved' | 'submitted' | 'edited_after_submission';
  reflection: DailyReflectionRecord | null;
  feedback: MentorFeedbackItem[];
}

export interface TaskAuditEvent {
  id: number;
  taskId: number;
  chapterId: number;
  action: string;
  previousStatus: string;
  newStatus: string;
  previousDueDate: string;
  newDueDate: string;
  reason: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedByName: string;
  changedByRole: string;
  eventDateIst: string;
  changedAt: string;
}

export interface MockTestRecord {
  id: number;
  sprintId: number;
  mockCode: string;
  studentUid: string;
  testDate: string;
  testName: string;
  maximumMarks: number;
  physicsMarks: number | null;
  chemistryMarks: number | null;
  mathsMarks: number | null;
  attempted: number | null;
  correct: number | null;
  incorrect: number | null;
  notes: string;
  mentorAnalysis: string;
  recordedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SprintStateResponse {
  serverTimestampUtc: string;
  currentDateIst: string;
  currentUser: UserProfile;
  sprint: {
    id: number;
    slug: string;
    studentUid: string;
    mentorUid: string;
    title: string;
    originalStartDate: string;
    originalEndDate: string;
    startDate: string;
    endDate: string;
    mockTargetDate: string;
    timezone: string;
    dailyCapacityHours: string;
  };
  metrics: {
    overallProgressPercentage: number;
    totalEligibleTasks: number;
    completedEligibleTasks: number;
    inProgressEligibleTasks: number;
    pendingEligibleTasks: number;
    overdueEligibleTasks: number;
    rescheduledEligibleTasks: number;
    newChaptersCount: number;
    fullyCompletedNewChaptersCount: number;
    newChapterTasksTotal: number;
    newChapterTasksCompleted: number;
    newChaptersTaskPercentage: number;
    oldNotesTotal: number;
    oldNotesCompleted: number;
    oldNotesTaskPercentage: number;
    submittedReflectionsCount: number;
    draftReflectionsCount: number;
    totalReflectionsDays: number;
    pyqSummary: {
      totalTarget: number;
      totalAttempted: number;
      totalCorrect: number;
      totalIncorrect: number;
      totalUnclassified: number;
      overallAccuracyPercentage: number | null;
      sessionsCount: number;
    };
  };
  subjectProgress: {
    subject: 'Physics' | 'Chemistry' | 'Mathematics';
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    percentage: number;
    totalNewChapters: number;
    completedNewChapters: number;
  }[];
  newChapters: NewChapterSummary[];
  oldShortNotes: OldShortNoteItem[];
  daysSummary: DaySummaryItem[];
  tasks: StudyTask[];
  pyqSessions: PyqSession[];
  pyqAuditEvents: PyqAuditEvent[];
  reflections: DailyReflectionRecord[];
  taskAuditEvents: TaskAuditEvent[];
  mentorFeedback: MentorFeedbackItem[];
  mockTests: MockTestRecord[];
}
