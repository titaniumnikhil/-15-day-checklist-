import React, { useState } from 'react';
import {
  NewChapterSummary,
  OldShortNoteItem,
  StudyTask,
  UserProfile,
} from '../types.ts';
import {
  formatShortIndianDate,
  formatTimestampIst,
} from '../utils/ist.ts';
import {
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Plus,
  Edit3,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Calculator,
} from 'lucide-react';

interface ChaptersAndPyqViewProps {
  newChapters: NewChapterSummary[];
  oldShortNotes: OldShortNoteItem[];
  currentUser: UserProfile;
  authToken: string;
  selectedDate: string;
  onStateUpdated: (newState: any) => void;
  darkMode: boolean;
  initialSelectedChapterId?: number | null;
}

export const ChaptersAndPyqView: React.FC<ChaptersAndPyqViewProps> = ({
  newChapters,
  oldShortNotes,
  currentUser,
  authToken,
  selectedDate,
  onStateUpdated,
  darkMode,
  initialSelectedChapterId = null,
}) => {
  const [expandedChapterId, setExpandedChapterId] = useState<number | null>(
    initialSelectedChapterId || (newChapters[0]?.id ?? null)
  );
  const [activeTab, setActiveTab] = useState<'new_chapters' | 'old_short_notes'>(
    'new_chapters'
  );
  const [taskLoadingId, setTaskLoadingId] = useState<number | null>(null);
  const [banner, setBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Date-wise PYQ session form state
  const [pyqSessionId, setPyqSessionId] = useState<number | null>(null);
  const [pyqDate, setPyqDate] = useState<string>(selectedDate);
  const [pyqAttempted, setPyqAttempted] = useState<string>('15');
  const [pyqCorrect, setPyqCorrect] = useState<string>('12');
  const [pyqIncorrect, setPyqIncorrect] = useState<string>('3');
  const [pyqUnclassified, setPyqUnclassified] = useState<string>('0');
  const [pyqNotes, setPyqNotes] = useState<string>('');
  const [pyqEditReason, setPyqEditReason] = useState<string>('');
  const [pyqSaving, setPyqSaving] = useState<boolean>(false);

  // Mentor chapter target editor state
  const [editingTargetChapterId, setEditingTargetChapterId] = useState<
    number | null
  >(null);
  const [targetStartInput, setTargetStartInput] = useState('');
  const [targetEndInput, setTargetEndInput] = useState('');
  const [targetPyqInput, setTargetPyqInput] = useState('30');
  const [overrideReasonInput, setOverrideReasonInput] = useState('');

  // Old short notes inline editor state
  const [editingOldNoteTaskId, setEditingOldNoteTaskId] = useState<
    number | null
  >(null);
  const [oldNoteText, setOldNoteText] = useState('');
  const [oldNoteLink, setOldNoteLink] = useState('');

  const handleTaskStatusUpdate = async (
    task: StudyTask,
    nextStatus: 'not_started' | 'in_progress' | 'completed',
    extra?: { notes?: string; resourceLink?: string; overrideReason?: string }
  ) => {
    setTaskLoadingId(task.id);
    setBanner(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-trial-seat': currentUser.role,
        },
        body: JSON.stringify({
          status: nextStatus,
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update task.');
      }
      onStateUpdated(data.state);
      setBanner({
        type: 'success',
        text: `Updated "${task.title}" (${task.chapterName}) to ${
          nextStatus === 'completed'
            ? 'Completed'
            : nextStatus === 'in_progress'
            ? 'In Progress'
            : 'Not Started'
        }.`,
      });
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err.message || 'Could not update task status.',
      });
    } finally {
      setTaskLoadingId(null);
    }
  };

  const handleSavePyqSession = async (chapterId: number) => {
    setPyqSaving(true);
    setBanner(null);
    try {
      const res = await fetch('/api/pyq-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-trial-seat': currentUser.role,
        },
        body: JSON.stringify({
          sessionId: pyqSessionId || undefined,
          chapterId,
          practiceDate: pyqDate,
          attemptedCount: Number(pyqAttempted),
          correctCount: Number(pyqCorrect),
          incorrectCount: Number(pyqIncorrect),
          unclassifiedCount: Number(pyqUnclassified),
          notes: pyqNotes,
          reason: pyqEditReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save PYQ practice session.');
      }
      onStateUpdated(data.state);
      setPyqSessionId(null);
      setPyqNotes('');
      setPyqEditReason('');
      setBanner({
        type: 'success',
        text: pyqSessionId
          ? 'PYQ practice session updated and audit record saved.'
          : 'New date-wise PYQ practice session saved to database.',
      });
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err.message || 'Failed to save PYQ session.',
      });
    } finally {
      setPyqSaving(false);
    }
  };

  const handleSaveChapterTargets = async (chapterId: number) => {
    setBanner(null);
    try {
      const res = await fetch(`/api/chapters/${chapterId}/targets`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-trial-seat': currentUser.role,
        },
        body: JSON.stringify({
          targetStartDate: targetStartInput,
          targetEndDate: targetEndInput,
          targetPyqCount: Number(targetPyqInput),
          pyqTargetOverrideReason: overrideReasonInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update chapter targets.');
      }
      onStateUpdated(data.state);
      setEditingTargetChapterId(null);
      setBanner({
        type: 'success',
        text: 'Chapter targets and PYQ configuration updated.',
      });
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err.message || 'Error updating chapter targets.',
      });
    }
  };

  const subjects: ('Physics' | 'Chemistry' | 'Mathematics')[] = [
    'Physics',
    'Chemistry',
    'Mathematics',
  ];

  const oldNotesDays = [
    { dayNumber: 1, date: '2026-10-25', label: 'Day 1 — 25 October (Physics)' },
    { dayNumber: 2, date: '2026-10-26', label: 'Day 2 — 26 October (Physics)' },
    { dayNumber: 3, date: '2026-10-27', label: 'Day 3 — 27 October (Physics)' },
    {
      dayNumber: 4,
      date: '2026-10-28',
      label: 'Day 4 — 28 October (Chemistry)',
    },
    {
      dayNumber: 5,
      date: '2026-10-29',
      label: 'Day 5 — 29 October (Chemistry + Mathematics)',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Segmented Switcher between 10 New Chapters and 5-Day Old Short Notes */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          darkMode
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200'
        }`}
      >
        <div>
          <h2 className="text-lg font-bold font-display">
            Assigned Syllabus &amp; Chapter Checklists
          </h2>
          <p className="text-xs text-slate-500">
            10 New Target Chapters (10 tasks each + Date-wise PYQ sessions) &amp; 5-Day Old-Chapter Short Notes (20 individual chapters).
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('new_chapters')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'new_chapters'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            10 New Target Chapters
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('old_short_notes')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'old_short_notes'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            5-Day Old Short Notes (20)
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-2.5 text-xs ${
            banner.type === 'error'
              ? 'border-red-300 bg-red-50 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200'
              : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
          }`}
        >
          {banner.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">{banner.text}</div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-[11px] underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {activeTab === 'new_chapters' ? (
        <div className="space-y-8">
          {subjects.map((subject) => {
            const subjChapters = newChapters.filter(
              (c) => c.subject === subject
            );
            const accentText =
              subject === 'Physics'
                ? 'text-indigo-600 dark:text-indigo-400'
                : subject === 'Chemistry'
                ? 'text-teal-600 dark:text-teal-400'
                : 'text-violet-600 dark:text-violet-400';
            const accentBar =
              subject === 'Physics'
                ? 'bg-indigo-600'
                : subject === 'Chemistry'
                ? 'bg-teal-600'
                : 'bg-violet-600';

            return (
              <div key={subject} className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className={`w-4 h-4 ${accentText}`} />
                    <h3 className="text-base font-bold font-display">
                      {subject} — {subjChapters.length} Assigned Chapters
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 font-mono tabular-nums">
                    {
                      subjChapters.filter((c) => c.status === 'completed')
                        .length
                    }{' '}
                    / {subjChapters.length} Fully Completed
                  </span>
                </div>

                <div className="space-y-4">
                  {subjChapters.map((ch) => {
                    const isExpanded = expandedChapterId === ch.id;
                    return (
                      <div
                        key={ch.id}
                        className={`rounded-xl border transition-all ${
                          darkMode
                            ? 'bg-slate-900 border-slate-800'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        {/* Chapter Card Header */}
                        <div className="p-5">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span className={`font-semibold ${accentText}`}>
                                  {ch.subject}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  Assigned:{' '}
                                  {formatShortIndianDate(ch.targetStartDate)} –{' '}
                                  {formatShortIndianDate(ch.targetEndDate)}
                                </span>
                                {(ch.targetStartDate !==
                                  ch.originalTargetStartDate ||
                                  ch.targetEndDate !==
                                    ch.originalTargetEndDate) && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-amber-600 dark:text-amber-400 font-mono">
                                      Orig:{' '}
                                      {formatShortIndianDate(
                                        ch.originalTargetStartDate
                                      )}
                                      –
                                      {formatShortIndianDate(
                                        ch.originalTargetEndDate
                                      )}
                                    </span>
                                  </>
                                )}
                                <span aria-hidden="true">·</span>
                                <span>
                                  Status:{' '}
                                  <strong className="text-slate-800 dark:text-slate-200">
                                    {ch.status === 'completed'
                                      ? 'Completed'
                                      : ch.status === 'in_progress'
                                      ? 'In Progress'
                                      : 'Not Started'}
                                  </strong>
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  Updated: {formatTimestampIst(ch.updatedAt)}
                                </span>
                              </div>

                              <h4 className="text-lg font-bold font-display">
                                {ch.chapterOrder}. {ch.chapterName}
                              </h4>

                              {/* Sub-status row */}
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400 pt-1">
                                <span>
                                  One-Shot:{' '}
                                  <strong className="text-slate-900 dark:text-slate-100">
                                    {ch.oneShotStatus}
                                  </strong>
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  Short Notes:{' '}
                                  <strong className="text-slate-900 dark:text-slate-100">
                                    {ch.shortNotesStatus}
                                  </strong>
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  Revision:{' '}
                                  <strong className="text-slate-900 dark:text-slate-100">
                                    {ch.revisionStatus}
                                  </strong>
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  Tasks: <strong>{ch.completedTasks}</strong>{' '}
                                  done / <strong>{ch.pendingTasks}</strong>{' '}
                                  pending
                                </span>
                              </div>
                            </div>

                            {/* Dual Progress Bars: Task Completion % and PYQ Progress % */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0">
                              <div
                                className={`p-3 rounded-lg border min-w-[165px] ${
                                  darkMode
                                    ? 'bg-slate-950/60 border-slate-800'
                                    : 'bg-slate-50 border-slate-200'
                                }`}
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-500">
                                    Task Progress
                                  </span>
                                  <span className="font-mono font-bold tabular-nums">
                                    {ch.completionPercentage}%
                                  </span>
                                </div>
                                <div className="mt-1.5 w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                  <div
                                    className={`h-full ${accentBar} transition-all`}
                                    style={{
                                      width: `${ch.completionPercentage}%`,
                                    }}
                                  />
                                </div>
                                <div className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
                                  {ch.completedTasks} of {ch.totalTasks} tasks
                                </div>
                              </div>

                              <div
                                className={`p-3 rounded-lg border min-w-[185px] ${
                                  darkMode
                                    ? 'bg-slate-950/60 border-slate-800'
                                    : 'bg-slate-50 border-slate-200'
                                }`}
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-500">
                                    PYQ Progress
                                  </span>
                                  <span className="font-mono font-bold tabular-nums">
                                    {ch.pyqSummary.attemptedCount} /{' '}
                                    {ch.pyqSummary.targetCount} (
                                    {ch.pyqSummary.progressPercentage}%)
                                  </span>
                                </div>
                                <div className="mt-1.5 w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-600 transition-all"
                                    style={{
                                      width: `${ch.pyqSummary.progressPercentage}%`,
                                    }}
                                  />
                                </div>
                                <div className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums flex items-center justify-between">
                                  <span>
                                    Accuracy:{' '}
                                    {ch.pyqSummary.accuracyPercentage === null
                                      ? 'Not available'
                                      : `${ch.pyqSummary.accuracyPercentage}%`}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedChapterId(
                                    isExpanded ? null : ch.id
                                  )
                                }
                                className={`px-3.5 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                                  darkMode
                                    ? 'border-slate-700 hover:bg-slate-800 text-slate-200'
                                    : 'border-slate-300 hover:bg-slate-100 text-slate-800'
                                }`}
                              >
                                <span>
                                  {isExpanded
                                    ? 'Hide Details'
                                    : 'Tasks & PYQs'}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Checklist & Date-wise PYQ Logger */}
                        {isExpanded && (
                          <div className="border-t border-slate-200 dark:border-slate-800 p-5 space-y-6 bg-slate-50/50 dark:bg-slate-950/30">
                            {/* Mentor Target Configuration Bar */}
                            {currentUser.role === 'mentor' && (
                              <div
                                className={`p-4 rounded-lg border ${
                                  darkMode
                                    ? 'bg-slate-900 border-slate-800'
                                    : 'bg-white border-slate-200'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="text-xs">
                                    <span className="font-bold font-display">
                                      Mentor Chapter Target Controls
                                    </span>
                                    {ch.pyqTargetOverrideReason && (
                                      <span className="ml-2 text-amber-600 dark:text-amber-400">
                                        · PYQ Gate Override Active:{' '}
                                        {ch.pyqTargetOverrideReason}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (editingTargetChapterId === ch.id) {
                                        setEditingTargetChapterId(null);
                                      } else {
                                        setEditingTargetChapterId(ch.id);
                                        setTargetStartInput(ch.targetStartDate);
                                        setTargetEndInput(ch.targetEndDate);
                                        setTargetPyqInput(
                                          String(ch.targetPyqCount)
                                        );
                                        setOverrideReasonInput(
                                          ch.pyqTargetOverrideReason || ''
                                        );
                                      }
                                    }}
                                    className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>
                                      {editingTargetChapterId === ch.id
                                        ? 'Close Editor'
                                        : 'Edit Dates / PYQ Target / Override'}
                                    </span>
                                  </button>
                                </div>

                                {editingTargetChapterId === ch.id && (
                                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                                    <div>
                                      <label className="block text-slate-500 mb-1">
                                        Start Date
                                      </label>
                                      <input
                                        type="date"
                                        value={targetStartInput}
                                        onChange={(e) =>
                                          setTargetStartInput(e.target.value)
                                        }
                                        className={`w-full px-2.5 py-1.5 rounded border font-mono ${
                                          darkMode
                                            ? 'bg-slate-950 border-slate-700'
                                            : 'bg-white border-slate-300'
                                        }`}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-slate-500 mb-1">
                                        End Date
                                      </label>
                                      <input
                                        type="date"
                                        value={targetEndInput}
                                        onChange={(e) =>
                                          setTargetEndInput(e.target.value)
                                        }
                                        className={`w-full px-2.5 py-1.5 rounded border font-mono ${
                                          darkMode
                                            ? 'bg-slate-950 border-slate-700'
                                            : 'bg-white border-slate-300'
                                        }`}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-slate-500 mb-1">
                                        PYQ Target Count
                                      </label>
                                      <input
                                        type="number"
                                        min={1}
                                        value={targetPyqInput}
                                        onChange={(e) =>
                                          setTargetPyqInput(e.target.value)
                                        }
                                        className={`w-full px-2.5 py-1.5 rounded border font-mono ${
                                          darkMode
                                            ? 'bg-slate-950 border-slate-700'
                                            : 'bg-white border-slate-300'
                                        }`}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-slate-500 mb-1">
                                        PYQ Task #6 Override Reason
                                      </label>
                                      <input
                                        type="text"
                                        value={overrideReasonInput}
                                        onChange={(e) =>
                                          setOverrideReasonInput(e.target.value)
                                        }
                                        placeholder="Optional mentor override explanation..."
                                        className={`w-full px-2.5 py-1.5 rounded border ${
                                          darkMode
                                            ? 'bg-slate-950 border-slate-700'
                                            : 'bg-white border-slate-300'
                                        }`}
                                      />
                                    </div>
                                    <div className="sm:col-span-4 flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleSaveChapterTargets(ch.id)
                                        }
                                        className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                                      >
                                        Save Chapter Target Changes
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                              {/* Left 7 Cols: 10 Individual Chapter Tasks */}
                              <div className="lg:col-span-7 space-y-3">
                                <div className="flex items-center justify-between">
                                  <h5 className="text-sm font-bold font-display">
                                    Chapter Task Checklist ({ch.completedTasks} /{' '}
                                    {ch.totalTasks} Completed)
                                  </h5>
                                  <span className="text-xs text-slate-500">
                                    One-tap completion · Reopen anytime
                                  </span>
                                </div>

                                <div className="space-y-2">
                                  {ch.tasks.map((task) => {
                                    const isDone = task.status === 'completed';
                                    const isInProg =
                                      task.status === 'in_progress';
                                    return (
                                      <div
                                        key={task.id}
                                        className={`p-3.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                          darkMode
                                            ? 'bg-slate-900 border-slate-800'
                                            : 'bg-white border-slate-200'
                                        }`}
                                      >
                                        <div className="flex items-start gap-3">
                                          <button
                                            type="button"
                                            disabled={taskLoadingId === task.id}
                                            onClick={() =>
                                              handleTaskStatusUpdate(
                                                task,
                                                isDone
                                                  ? 'not_started'
                                                  : 'completed'
                                              )
                                            }
                                            className="mt-0.5 text-blue-600 dark:text-blue-400 hover:scale-105 transition-transform cursor-pointer"
                                            title={
                                              isDone
                                                ? 'Reopen task'
                                                : 'Mark task completed'
                                            }
                                          >
                                            {isDone ? (
                                              <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                            ) : (
                                              <Square className="w-5 h-5 text-slate-400" />
                                            )}
                                          </button>

                                          <div>
                                            <div
                                              className={`text-sm font-medium ${
                                                isDone
                                                  ? 'line-through text-slate-400 dark:text-slate-500'
                                                  : ''
                                              }`}
                                            >
                                              {task.taskOrder}. {task.title}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                              <span>{task.taskType}</span>
                                              <span aria-hidden="true">·</span>
                                              <span className="font-mono tabular-nums">
                                                Due:{' '}
                                                {formatShortIndianDate(
                                                  task.dueDate
                                                )}
                                              </span>
                                              {task.isRescheduled && (
                                                <>
                                                  <span aria-hidden="true">
                                                    ·
                                                  </span>
                                                  <span className="text-amber-600 dark:text-amber-400 font-mono">
                                                    Rescheduled (orig:{' '}
                                                    {formatShortIndianDate(
                                                      task.originalDueDate
                                                    )}
                                                    )
                                                  </span>
                                                </>
                                              )}
                                              {task.isOverdue && (
                                                <>
                                                  <span aria-hidden="true">
                                                    ·
                                                  </span>
                                                  <span className="text-red-600 dark:text-red-400 font-semibold">
                                                    Overdue
                                                  </span>
                                                </>
                                              )}
                                              {task.completedAt && (
                                                <>
                                                  <span aria-hidden="true">
                                                    ·
                                                  </span>
                                                  <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                                                    Done:{' '}
                                                    {formatTimestampIst(
                                                      task.completedAt
                                                    )}
                                                  </span>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                          <select
                                            value={task.status}
                                            disabled={taskLoadingId === task.id}
                                            onChange={(e) =>
                                              handleTaskStatusUpdate(
                                                task,
                                                e.target.value as
                                                  | 'not_started'
                                                  | 'in_progress'
                                                  | 'completed'
                                              )
                                            }
                                            className={`px-2.5 py-1 rounded border text-xs font-medium ${
                                              isDone
                                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300'
                                                : isInProg
                                                ? 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300'
                                                : darkMode
                                                ? 'bg-slate-950 border-slate-700 text-slate-300'
                                                : 'bg-slate-50 border-slate-300 text-slate-700'
                                            }`}
                                          >
                                            <option value="not_started">
                                              Not Started
                                            </option>
                                            <option value="in_progress">
                                              In Progress
                                            </option>
                                            <option value="completed">
                                              Completed
                                            </option>
                                          </select>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Right 5 Cols: Date-Wise PYQ Practice Logger & Sessions */}
                              <div className="lg:col-span-5 space-y-4">
                                <div
                                  className={`p-4 rounded-xl border space-y-4 ${
                                    darkMode
                                      ? 'bg-slate-900 border-slate-800'
                                      : 'bg-white border-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Calculator className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                      <h5 className="text-sm font-bold font-display">
                                        {pyqSessionId
                                          ? `Edit PYQ Session #${pyqSessionId}`
                                          : 'Log Date-Wise PYQ Session'}
                                      </h5>
                                    </div>
                                    <span className="text-xs font-mono text-slate-500 tabular-nums">
                                      Target: {ch.targetPyqCount} PYQs
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="col-span-2">
                                      <label className="block text-slate-500 mb-1">
                                        Practice Date
                                      </label>
                                      <input
                                        type="date"
                                        value={pyqDate}
                                        onChange={(e) =>
                                          setPyqDate(e.target.value)
                                        }
                                        className={`w-full px-2.5 py-1.5 rounded border font-mono ${
                                          darkMode
                                            ? 'bg-slate-950 border-slate-700'
                                            : 'bg-slate-50 border-slate-300'
                                        }`}
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-slate-500 mb-1">
                                        Attempted PYQs
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={pyqAttempted}
                                        onChange={(e) => {
                                          const att = Number(e.target.value);
                                          setPyqAttempted(e.target.value);
                                          const corr = Number(pyqCorrect);
                                          const inc = Number(pyqIncorrect);
                                          if (att >= corr + inc) {
                                            setPyqUnclassified(
                                              String(att - (corr + inc))
                                            );
                                          }
                                        }}
                                        className={`w-full px-2.5 py-1.5 rounded border font-mono tabular-nums ${
                                          darkMode
                                            ? 'bg-slate-950 border-slate-700'
                                            : 'bg-slate-50 border-slate-300'
                                        }`}
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-slate-500 mb-1">
                                        Correct PYQs
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={pyqCorrect}
                                        onChange={(e) => {
                                          const corr = Number(e.target.value);
                                          setPyqCorrect(e.target.value);
                                          const att = Number(pyqAttempted);
                                          const inc = Number(pyqIncorrect);
                                          if (att >= corr + inc) {
                                            setPyqUnclassified(
                                              String(att - (corr + inc))
                                            );
                                          }
                                        }}
                                        className={`w-full px-2.5 py-1.5 rounded border font-mono tabular-nums ${
                                          darkMode
                                            ? 'bg-slate-950 border-slate-700'
                                            : 'bg-slate-50 border-slate-300'
                                        }`}
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-slate-500 mb-1">
                                        Incorrect PYQs
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={pyqIncorrect}
                                        onChange={(e) => {
                                          const inc = Number(e.target.value);
                                          setPyqIncorrect(e.target.value);
                                          const att = Number(pyqAttempted);
                                          const corr = Number(pyqCorrect);
                                          if (att >= corr + inc) {
                                            setPyqUnclassified(
                                              String(att - (corr + inc))
                                            );
                                          }
                                        }}
                                        className={`w-full px-2.5 py-1.5 rounded border font-mono tabular-nums ${
                                          darkMode
                                            ? 'bg-slate-950 border-slate-700'
                                            : 'bg-slate-50 border-slate-300'
                                        }`}
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-slate-500 mb-1">
                                        Unclassified / Skipped
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={pyqUnclassified}
                                        onChange={(e) =>
                                          setPyqUnclassified(e.target.value)
                                        }
                                        className={`w-full px-2.5 py-1.5 rounded border font-mono tabular-nums ${
                                          darkMode
                                            ? 'bg-slate-950 border-slate-700'
                                            : 'bg-slate-50 border-slate-300'
                                        }`}
                                      />
                                    </div>

                                    <div className="col-span-2">
                                      <label className="block text-slate-500 mb-1">
                                        Mistake Notes &amp; Weak Subtopics
                                      </label>
                                      <input
                                        type="text"
                                        value={pyqNotes}
                                        onChange={(e) =>
                                          setPyqNotes(e.target.value)
                                        }
                                        placeholder="e.g., Sign error in motional EMF, revise self-inductance..."
                                        className={`w-full px-2.5 py-1.5 rounded border ${
                                          darkMode
                                            ? 'bg-slate-950 border-slate-700'
                                            : 'bg-slate-50 border-slate-300'
                                        }`}
                                      />
                                    </div>

                                    {pyqSessionId && (
                                      <div className="col-span-2">
                                        <label className="block text-slate-500 mb-1">
                                          Reason for Correction (Audit Log)
                                        </label>
                                        <input
                                          type="text"
                                          value={pyqEditReason}
                                          onChange={(e) =>
                                            setPyqEditReason(e.target.value)
                                          }
                                          placeholder="Explain why this session count was corrected..."
                                          className={`w-full px-2.5 py-1.5 rounded border ${
                                            darkMode
                                              ? 'bg-slate-950 border-slate-700'
                                              : 'bg-slate-50 border-slate-300'
                                          }`}
                                        />
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-end gap-2">
                                    {pyqSessionId && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPyqSessionId(null);
                                          setPyqNotes('');
                                          setPyqEditReason('');
                                        }}
                                        className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-xs cursor-pointer"
                                      >
                                        Cancel Edit
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      disabled={pyqSaving}
                                      onClick={() =>
                                        handleSavePyqSession(ch.id)
                                      }
                                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>
                                        {pyqSaving
                                          ? 'Saving...'
                                          : pyqSessionId
                                          ? 'Save Audited Correction'
                                          : 'Save PYQ Session'}
                                      </span>
                                    </button>
                                  </div>

                                  {/* Saved PYQ Sessions History for this Chapter */}
                                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                                    <div className="text-xs font-bold font-display">
                                      Saved Date-Wise PYQ Sessions (
                                      {ch.pyqSummary.sessions.length})
                                    </div>
                                    {ch.pyqSummary.sessions.length === 0 ? (
                                      <p className="text-xs text-slate-500">
                                        No PYQ practice sessions recorded for this chapter yet.
                                      </p>
                                    ) : (
                                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                        {ch.pyqSummary.sessions.map((sess) => (
                                          <div
                                            key={sess.id}
                                            className={`p-2.5 rounded border text-xs ${
                                              darkMode
                                                ? 'bg-slate-950 border-slate-800'
                                                : 'bg-slate-50 border-slate-200'
                                            }`}
                                          >
                                            <div className="flex items-center justify-between font-mono tabular-nums">
                                              <span className="font-semibold">
                                                {formatShortIndianDate(
                                                  sess.practiceDate
                                                )}
                                              </span>
                                              <span>
                                                Attempted: {sess.attemptedCount}{' '}
                                                (✓{sess.correctCount} · ✗
                                                {sess.incorrectCount} · ?
                                                {sess.unclassifiedCount})
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setPyqSessionId(sess.id);
                                                  setPyqDate(sess.practiceDate);
                                                  setPyqAttempted(
                                                    String(sess.attemptedCount)
                                                  );
                                                  setPyqCorrect(
                                                    String(sess.correctCount)
                                                  );
                                                  setPyqIncorrect(
                                                    String(sess.incorrectCount)
                                                  );
                                                  setPyqUnclassified(
                                                    String(
                                                      sess.unclassifiedCount
                                                    )
                                                  );
                                                  setPyqNotes(sess.notes || '');
                                                }}
                                                className="text-blue-600 dark:text-blue-400 underline cursor-pointer"
                                              >
                                                Correct
                                              </button>
                                            </div>
                                            {sess.notes && (
                                              <p className="text-slate-500 mt-1">
                                                Note: {sess.notes}
                                              </p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 5-DAY OLD-CHAPTER SHORT NOTES PLAN (20 INDIVIDUAL ITEMS) */
        <div className="space-y-6">
          <div
            className={`p-4 rounded-xl border text-xs ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-slate-300'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            Alongside the 10 new chapters, Janvi completes concise formula, reaction, concept, or question-pattern sheets for 20 previously studied chapters across Days 1–5 (25–29 October). Each old chapter has its own independent completion checkbox, notes field, and resource link.
          </div>

          {oldNotesDays.map((dayGroup) => {
            const items = oldShortNotes.filter(
              (n) => n.originalDueDate === dayGroup.date || n.dueDate === dayGroup.date
            );
            const completedCount = items.filter(
              (i) => i.status === 'completed'
            ).length;
            const pct =
              items.length > 0
                ? Math.round((completedCount / items.length) * 1000) / 10
                : 0;

            return (
              <div
                key={dayGroup.date}
                className={`p-5 rounded-xl border space-y-4 ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h3 className="text-base font-bold font-display">
                      {dayGroup.label}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Individual chapter checkboxes — completing 1 shows 1 out of{' '}
                      {items.length}, never bulk 100%.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold tabular-nums">
                      {completedCount} out of {items.length} ({pct}%)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map((item) => {
                    const task = item.task;
                    if (!task) return null;
                    const isDone = item.status === 'completed';
                    const isEditingNotes = editingOldNoteTaskId === task.id;

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-lg border space-y-2.5 ${
                          darkMode
                            ? 'bg-slate-950/60 border-slate-800'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <button
                              type="button"
                              disabled={taskLoadingId === task.id}
                              onClick={() =>
                                handleTaskStatusUpdate(
                                  task,
                                  isDone ? 'not_started' : 'completed'
                                )
                              }
                              className="mt-0.5 cursor-pointer"
                            >
                              {isDone ? (
                                <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-400" />
                              )}
                            </button>
                            <div>
                              <div
                                className={`text-sm font-bold font-display ${
                                  isDone
                                    ? 'line-through text-slate-400 dark:text-slate-500'
                                    : ''
                                }`}
                              >
                                {item.chapterName}
                              </div>
                              <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span>{item.subject}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  Due: {formatShortIndianDate(item.dueDate)}
                                </span>
                                {item.completedAt && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                                      Completed:{' '}
                                      {formatTimestampIst(item.completedAt)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              value={item.status}
                              disabled={taskLoadingId === task.id}
                              onChange={(e) =>
                                handleTaskStatusUpdate(
                                  task,
                                  e.target.value as
                                    | 'not_started'
                                    | 'in_progress'
                                    | 'completed'
                                )
                              }
                              className={`px-2 py-1 rounded border text-xs font-medium ${
                                darkMode
                                  ? 'bg-slate-900 border-slate-700'
                                  : 'bg-white border-slate-300'
                              }`}
                            >
                              <option value="not_started">Not Started</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => {
                                if (isEditingNotes) {
                                  setEditingOldNoteTaskId(null);
                                } else {
                                  setEditingOldNoteTaskId(task.id);
                                  setOldNoteText(item.notes || '');
                                  setOldNoteLink(item.resourceLink || '');
                                }
                              }}
                              className="text-xs text-blue-600 dark:text-blue-400 underline cursor-pointer"
                            >
                              {isEditingNotes ? 'Close' : 'Notes/Link'}
                            </button>
                          </div>
                        </div>

                        {(item.notes || item.resourceLink) && !isEditingNotes && (
                          <div className="pl-7 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                            {item.notes && <p>Summary: {item.notes}</p>}
                            {item.resourceLink && (
                              <a
                                href={item.resourceLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 underline"
                              >
                                <span>Open Sheet Link</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}

                        {isEditingNotes && (
                          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                            <input
                              type="text"
                              value={oldNoteText}
                              onChange={(e) => setOldNoteText(e.target.value)}
                              placeholder="Key formulas, reactions, or concept summary notes..."
                              className={`w-full px-2.5 py-1.5 rounded border ${
                                darkMode
                                  ? 'bg-slate-900 border-slate-700'
                                  : 'bg-white border-slate-300'
                              }`}
                            />
                            <div className="flex items-center gap-2">
                              <input
                                type="url"
                                value={oldNoteLink}
                                onChange={(e) => setOldNoteLink(e.target.value)}
                                placeholder="Optional Drive / Notion / reference link (https://...)"
                                className={`flex-1 px-2.5 py-1.5 rounded border ${
                                  darkMode
                                    ? 'bg-slate-900 border-slate-700'
                                    : 'bg-white border-slate-300'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  await handleTaskStatusUpdate(
                                    task,
                                    task.status,
                                    {
                                      notes: oldNoteText,
                                      resourceLink: oldNoteLink,
                                    }
                                  );
                                  setEditingOldNoteTaskId(null);
                                }}
                                className="px-3 py-1.5 rounded bg-blue-600 text-white font-semibold cursor-pointer"
                              >
                                Save Note
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
