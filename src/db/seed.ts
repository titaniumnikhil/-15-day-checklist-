import { db } from './index.ts';
import {
  profiles,
  mentorStudentLinks,
  studySprints,
  chapters,
  studyTasks,
  mockTests,
} from './schema.ts';
import { eq } from 'drizzle-orm';

export const CANONICAL_MENTOR_UID = 'mentor-titanium-nikhil';
export const CANONICAL_STUDENT_UID = 'student-janvi';
export const SPRINT_SLUG = 'janvi-jee-2027-sprint';

interface NewChapterSeed {
  code: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  name: string;
  order: number;
  startDate: string;
  endDate: string;
  taskDates: [string, string, string, string, string, string, string, string, string, string];
}

const NEW_CHAPTERS_SEED: NewChapterSeed[] = [
  // PHYSICS — 3 CHAPTERS
  {
    code: 'new-phy-01-emi',
    subject: 'Physics',
    name: 'Electromagnetic Induction (EMI)',
    order: 1,
    startDate: '2026-10-25',
    endDate: '2026-10-27',
    taskDates: [
      '2026-10-25',
      '2026-10-25',
      '2026-10-25',
      '2026-10-26',
      '2026-10-26',
      '2026-10-26',
      '2026-10-27',
      '2026-10-27',
      '2026-10-27',
      '2026-10-27',
    ],
  },
  {
    code: 'new-phy-02-ac',
    subject: 'Physics',
    name: 'Alternating Current (AC)',
    order: 2,
    startDate: '2026-10-28',
    endDate: '2026-10-30',
    taskDates: [
      '2026-10-28',
      '2026-10-28',
      '2026-10-28',
      '2026-10-29',
      '2026-10-29',
      '2026-10-29',
      '2026-10-30',
      '2026-10-30',
      '2026-10-30',
      '2026-10-30',
    ],
  },
  {
    code: 'new-phy-03-emw',
    subject: 'Physics',
    name: 'Electromagnetic Waves',
    order: 3,
    startDate: '2026-10-31',
    endDate: '2026-11-02',
    taskDates: [
      '2026-10-31',
      '2026-10-31',
      '2026-10-31',
      '2026-11-01',
      '2026-11-01',
      '2026-11-01',
      '2026-11-02',
      '2026-11-02',
      '2026-11-02',
      '2026-11-02',
    ],
  },

  // CHEMISTRY — 4 CHAPTERS
  {
    code: 'new-chem-04-alcohols',
    subject: 'Chemistry',
    name: 'Alcohols, Phenols and Ethers',
    order: 4,
    startDate: '2026-10-28',
    endDate: '2026-10-30',
    taskDates: [
      '2026-10-28',
      '2026-10-28',
      '2026-10-29',
      '2026-10-29',
      '2026-10-29',
      '2026-10-30',
      '2026-10-30',
      '2026-10-30',
      '2026-10-30',
      '2026-10-30',
    ],
  },
  {
    code: 'new-chem-05-aldehydes',
    subject: 'Chemistry',
    name: 'Aldehydes, Ketones and Carboxylic Acids',
    order: 5,
    startDate: '2026-11-03',
    endDate: '2026-11-05',
    taskDates: [
      '2026-11-03',
      '2026-11-03',
      '2026-11-03',
      '2026-11-04',
      '2026-11-04',
      '2026-11-04',
      '2026-11-05',
      '2026-11-05',
      '2026-11-05',
      '2026-11-05',
    ],
  },
  {
    code: 'new-chem-06-amines',
    subject: 'Chemistry',
    name: 'Amines',
    order: 6,
    startDate: '2026-11-06',
    endDate: '2026-11-08',
    taskDates: [
      '2026-11-06',
      '2026-11-06',
      '2026-11-06',
      '2026-11-07',
      '2026-11-07',
      '2026-11-07',
      '2026-11-08',
      '2026-11-08',
      '2026-11-08',
      '2026-11-08',
    ],
  },
  {
    code: 'new-chem-07-coordination',
    subject: 'Chemistry',
    name: 'Coordination Compounds',
    order: 7,
    startDate: '2026-11-06',
    endDate: '2026-11-08',
    taskDates: [
      '2026-11-06',
      '2026-11-06',
      '2026-11-07',
      '2026-11-07',
      '2026-11-07',
      '2026-11-08',
      '2026-11-08',
      '2026-11-08',
      '2026-11-08',
      '2026-11-08',
    ],
  },

  // MATHEMATICS — 3 CHAPTERS
  {
    code: 'new-math-08-matrices',
    subject: 'Mathematics',
    name: 'Matrices and Determinants',
    order: 8,
    startDate: '2026-10-25',
    endDate: '2026-11-02',
    // Starts 25-27 Oct, completes 31 Oct - 2 Nov
    taskDates: [
      '2026-10-25',
      '2026-10-26',
      '2026-10-26',
      '2026-10-27',
      '2026-10-27',
      '2026-10-31',
      '2026-11-01',
      '2026-11-01',
      '2026-11-02',
      '2026-11-02',
    ],
  },
  {
    code: 'new-math-09-vectors',
    subject: 'Mathematics',
    name: 'Vector Algebra',
    order: 9,
    startDate: '2026-10-31',
    endDate: '2026-11-02',
    taskDates: [
      '2026-10-31',
      '2026-10-31',
      '2026-11-01',
      '2026-11-01',
      '2026-11-01',
      '2026-11-02',
      '2026-11-02',
      '2026-11-02',
      '2026-11-02',
      '2026-11-02',
    ],
  },
  {
    code: 'new-math-10-3d-geometry',
    subject: 'Mathematics',
    name: 'Three-Dimensional Geometry',
    order: 10,
    startDate: '2026-11-03',
    endDate: '2026-11-05',
    taskDates: [
      '2026-11-03',
      '2026-11-03',
      '2026-11-04',
      '2026-11-04',
      '2026-11-04',
      '2026-11-05',
      '2026-11-05',
      '2026-11-05',
      '2026-11-05',
      '2026-11-05',
    ],
  },
];

const DEFAULT_CHAPTER_TASKS: {
  order: number;
  title: string;
  description: string;
  taskType: string;
  estimatedMinutes: number;
}[] = [
  {
    order: 1,
    title: 'Start one-shot lecture',
    description: 'Begin the comprehensive one-shot lecture and set up active problem-solving notes.',
    taskType: 'Lecture',
    estimatedMinutes: 120,
  },
  {
    order: 2,
    title: 'Complete one-shot lecture',
    description: 'Finish watching the full one-shot lecture and work through all in-lecture illustrations.',
    taskType: 'Lecture',
    estimatedMinutes: 180,
  },
  {
    order: 3,
    title: 'Complete core concept understanding/review',
    description: 'Review derivations, mechanisms, and standard JEE Main question frameworks.',
    taskType: 'Concept review',
    estimatedMinutes: 60,
  },
  {
    order: 4,
    title: 'Prepare short notes or formula/reaction sheet',
    description: 'Create concise 1–2 page summary of formulas, reactions, exceptions, and key question patterns.',
    taskType: 'Short notes',
    estimatedMinutes: 60,
  },
  {
    order: 5,
    title: 'Attempt first PYQ practice batch',
    description: 'Solve the initial set of 15 JEE Main PYQs under timed conditions and log session counts.',
    taskType: 'PYQ',
    estimatedMinutes: 60,
  },
  {
    order: 6,
    title: 'Complete assigned PYQ target',
    description: 'Reach the chapter PYQ target count (default 30 PYQs) across logged practice sessions.',
    taskType: 'PYQ',
    estimatedMinutes: 90,
  },
  {
    order: 7,
    title: 'Review incorrect PYQs',
    description: 'Analyze every wrong or skipped PYQ and document the exact conceptual or calculation gap.',
    taskType: 'Mistake analysis',
    estimatedMinutes: 45,
  },
  {
    order: 8,
    title: 'Perform first revision',
    description: 'Active recall revision of short notes, starred PYQs, and standard traps.',
    taskType: 'Revision',
    estimatedMinutes: 45,
  },
  {
    order: 9,
    title: 'Complete a short timed chapter test',
    description: 'Attempt a focused 30–45 minute chapter assessment without referring to notes.',
    taskType: 'Test',
    estimatedMinutes: 45,
  },
  {
    order: 10,
    title: 'Review chapter test mistakes',
    description: 'Record post-test mistake analysis and update the chapter formula/reaction sheet.',
    taskType: 'Mistake analysis',
    estimatedMinutes: 30,
  },
];

interface OldNoteSeed {
  code: string;
  dayDate: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  name: string;
  order: number;
}

const OLD_SHORT_NOTES_SEED: OldNoteSeed[] = [
  // Day 1 — 25 October (Physics)
  { code: 'old-d1-phy-kinematics', dayDate: '2026-10-25', subject: 'Physics', name: 'Kinematics', order: 101 },
  { code: 'old-d1-phy-nlm', dayDate: '2026-10-25', subject: 'Physics', name: "Newton's Laws of Motion", order: 102 },
  { code: 'old-d1-phy-wep', dayDate: '2026-10-25', subject: 'Physics', name: 'Work, Energy and Power', order: 103 },

  // Day 2 — 26 October (Physics)
  { code: 'old-d2-phy-com', dayDate: '2026-10-26', subject: 'Physics', name: 'Centre of Mass', order: 104 },
  { code: 'old-d2-phy-rotational', dayDate: '2026-10-26', subject: 'Physics', name: 'Rotational Motion', order: 105 },
  { code: 'old-d2-phy-gravitation', dayDate: '2026-10-26', subject: 'Physics', name: 'Gravitation', order: 106 },

  // Day 3 — 27 October (Physics)
  { code: 'old-d3-phy-solids', dayDate: '2026-10-27', subject: 'Physics', name: 'Mechanical Properties of Solids', order: 107 },
  { code: 'old-d3-phy-fluids', dayDate: '2026-10-27', subject: 'Physics', name: 'Mechanical Properties of Fluids', order: 108 },
  { code: 'old-d3-phy-thermo', dayDate: '2026-10-27', subject: 'Physics', name: 'Thermodynamics', order: 109 },

  // Day 4 — 28 October (Chemistry)
  { code: 'old-d4-chem-goc', dayDate: '2026-10-28', subject: 'Chemistry', name: 'General Organic Chemistry (GOC)', order: 110 },
  { code: 'old-d4-chem-haloalkanes', dayDate: '2026-10-28', subject: 'Chemistry', name: 'Haloalkanes and Haloarenes', order: 111 },
  { code: 'old-d4-chem-bonding', dayDate: '2026-10-28', subject: 'Chemistry', name: 'Chemical Bonding', order: 112 },
  { code: 'old-d4-chem-periodicity', dayDate: '2026-10-28', subject: 'Chemistry', name: 'Classification of Elements and Periodicity', order: 113 },

  // Day 5 — 29 October (Chemistry + Mathematics)
  { code: 'old-d5-chem-mole', dayDate: '2026-10-29', subject: 'Chemistry', name: 'Mole Concept', order: 114 },
  { code: 'old-d5-chem-atomic', dayDate: '2026-10-29', subject: 'Chemistry', name: 'Structure of Atom', order: 115 },
  { code: 'old-d5-math-quadratic', dayDate: '2026-10-29', subject: 'Mathematics', name: 'Quadratic Equations', order: 116 },
  { code: 'old-d5-math-complex', dayDate: '2026-10-29', subject: 'Mathematics', name: 'Complex Numbers', order: 117 },
  { code: 'old-d5-math-seq', dayDate: '2026-10-29', subject: 'Mathematics', name: 'Sequence and Series', order: 118 },
  { code: 'old-d5-math-trig', dayDate: '2026-10-29', subject: 'Mathematics', name: 'Trigonometry', order: 119 },
  { code: 'old-d5-math-itf', dayDate: '2026-10-29', subject: 'Mathematics', name: 'Inverse Trigonometric Functions', order: 120 },
];

let seedPromise: Promise<void> | null = null;

export async function ensureSprintSeeded(): Promise<void> {
  if (seedPromise) {
    return seedPromise;
  }
  seedPromise = runIdempotentSeed().finally(() => {
    seedPromise = null;
  });
  return seedPromise;
}

async function runIdempotentSeed(): Promise<void> {
  try {
    // 1. Ensure canonical Mentor and Student profiles exist
    await db
      .insert(profiles)
      .values({
        uid: CANONICAL_MENTOR_UID,
        email: 'titaniumoxide26@gmail.com',
        displayName: 'Titanium Nikhil',
        role: 'mentor',
      })
      .onConflictDoNothing({ target: profiles.uid });

    await db
      .insert(profiles)
      .values({
        uid: CANONICAL_STUDENT_UID,
        email: 'janvi.student@titanium.study',
        displayName: 'Janvi',
        role: 'student',
      })
      .onConflictDoNothing({ target: profiles.uid });

    // 2. Ensure Mentor-Student link exists
    const existingLinks = await db.select().from(mentorStudentLinks);
    if (existingLinks.length === 0) {
      await db.insert(mentorStudentLinks).values({
        mentorUid: CANONICAL_MENTOR_UID,
        studentUid: CANONICAL_STUDENT_UID,
      });
    }

    // 3. Ensure Sprint exists
    let [sprint] = await db
      .select()
      .from(studySprints)
      .where(eq(studySprints.slug, SPRINT_SLUG));

    if (!sprint) {
      const inserted = await db
        .insert(studySprints)
        .values({
          slug: SPRINT_SLUG,
          studentUid: CANONICAL_STUDENT_UID,
          mentorUid: CANONICAL_MENTOR_UID,
          title: 'JEE Main 2027 — 15-Day Preparation Sprint',
          originalStartDate: '2026-10-25',
          originalEndDate: '2026-11-08',
          startDate: '2026-10-25',
          endDate: '2026-11-08',
          mockTargetDate: '2026-11-09',
          timezone: 'Asia/Kolkata',
          dailyCapacityHours: '7–8 focused hours',
        })
        .onConflictDoNothing({ target: studySprints.slug })
        .returning();

      if (inserted.length > 0) {
        sprint = inserted[0];
      } else {
        [sprint] = await db
          .select()
          .from(studySprints)
          .where(eq(studySprints.slug, SPRINT_SLUG));
      }
    }

    // 4. Seed 10 New Chapters and their 10 distinct tasks each (idempotent)
    for (const ch of NEW_CHAPTERS_SEED) {
      await db
        .insert(chapters)
        .values({
          sprintId: sprint.id,
          chapterCode: ch.code,
          subject: ch.subject,
          chapterName: ch.name,
          chapterType: 'new_chapter',
          chapterOrder: ch.order,
          originalTargetStartDate: ch.startDate,
          originalTargetEndDate: ch.endDate,
          targetStartDate: ch.startDate,
          targetEndDate: ch.endDate,
          targetPyqCount: 30,
          status: 'not_started',
        })
        .onConflictDoNothing({ target: chapters.chapterCode });

      const [chapterRow] = await db
        .select()
        .from(chapters)
        .where(eq(chapters.chapterCode, ch.code));

      if (chapterRow) {
        for (let i = 0; i < DEFAULT_CHAPTER_TASKS.length; i++) {
          const def = DEFAULT_CHAPTER_TASKS[i];
          const taskDate = ch.taskDates[i];
          const taskCode = `${ch.code}-task-${String(def.order).padStart(2, '0')}`;
          await db
            .insert(studyTasks)
            .values({
              sprintId: sprint.id,
              chapterId: chapterRow.id,
              taskCode,
              taskOrder: def.order,
              title: def.title,
              description: def.description,
              taskType: def.taskType,
              originalAssignedDate: ch.startDate,
              originalDueDate: taskDate,
              assignedDate: ch.startDate,
              dueDate: taskDate,
              isRescheduled: false,
              rescheduleCount: 0,
              status: 'not_started',
              estimatedMinutes: def.estimatedMinutes,
              createdBy: CANONICAL_MENTOR_UID,
            })
            .onConflictDoNothing({ target: studyTasks.taskCode });
        }
      }
    }

    // 5. Seed 5-Day Old-Chapter Short Notes (20 distinct chapters + 20 distinct task checkboxes)
    for (const oldNote of OLD_SHORT_NOTES_SEED) {
      await db
        .insert(chapters)
        .values({
          sprintId: sprint.id,
          chapterCode: oldNote.code,
          subject: oldNote.subject,
          chapterName: oldNote.name,
          chapterType: 'old_short_notes',
          chapterOrder: oldNote.order,
          originalTargetStartDate: oldNote.dayDate,
          originalTargetEndDate: oldNote.dayDate,
          targetStartDate: oldNote.dayDate,
          targetEndDate: oldNote.dayDate,
          targetPyqCount: 0,
          status: 'not_started',
        })
        .onConflictDoNothing({ target: chapters.chapterCode });

      const [oldChapterRow] = await db
        .select()
        .from(chapters)
        .where(eq(chapters.chapterCode, oldNote.code));

      if (oldChapterRow) {
        const taskCode = `${oldNote.code}-short-notes`;
        await db
          .insert(studyTasks)
          .values({
            sprintId: sprint.id,
            chapterId: oldChapterRow.id,
            taskCode,
            taskOrder: 1,
            title: `Short Notes: ${oldNote.name}`,
            description: `Create concise formula, concept, reaction or question-pattern revision sheet for ${oldNote.name}.`,
            taskType: 'Old chapter notes',
            originalAssignedDate: oldNote.dayDate,
            originalDueDate: oldNote.dayDate,
            assignedDate: oldNote.dayDate,
            dueDate: oldNote.dayDate,
            isRescheduled: false,
            rescheduleCount: 0,
            status: 'not_started',
            estimatedMinutes: 40,
            createdBy: CANONICAL_MENTOR_UID,
          })
          .onConflictDoNothing({ target: studyTasks.taskCode });
      }
    }

    // 6. Seed 9 November 2026 Diagnostic Mock Test (without fabricated scores!)
    await db
      .insert(mockTests)
      .values({
        sprintId: sprint.id,
        mockCode: 'jee-main-diagnostic-2026-11-09',
        studentUid: CANONICAL_STUDENT_UID,
        testDate: '2026-11-09',
        testName: 'JEE Main Diagnostic Mock',
        maximumMarks: 300,
        physicsMarks: null,
        chemistryMarks: null,
        mathsMarks: null,
        attempted: null,
        correct: null,
        incorrect: null,
        notes: '',
        mentorAnalysis: '',
      })
      .onConflictDoNothing({ target: mockTests.mockCode });
  } catch (error) {
    console.error('Error seeding sprint data:', error);
    throw new Error('Failed to initialize study sprint database records.', { cause: error });
  }
}
