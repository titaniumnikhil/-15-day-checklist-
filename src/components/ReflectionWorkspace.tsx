import React, { useState, useEffect } from 'react';
import {
  DailyReflectionRecord,
  DaySummaryItem,
  MentorFeedbackItem,
  ReflectionVersion,
  UserProfile,
} from '../types.ts';
import {
  formatIndianDate,
  formatTimestampIst,
  getDayNumberForDate,
} from '../utils/ist.ts';
import { computeWordDiff } from '../utils/diff.ts';
import {
  Save,
  Send,
  AlertTriangle,
  CheckCircle2,
  History,
  GitCompare,
  MessageSquare,
  RotateCcw,
} from 'lucide-react';

interface ReflectionWorkspaceProps {
  selectedDate: string;
  daysSummary: DaySummaryItem[];
  reflections: DailyReflectionRecord[];
  mentorFeedback: MentorFeedbackItem[];
  currentUser: UserProfile;
  authToken: string;
  onSelectDate: (date: string) => void;
  onStateUpdated: (newState: any) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  darkMode: boolean;
  historyOnlyMode?: boolean;
}

export const ReflectionWorkspace: React.FC<ReflectionWorkspaceProps> = ({
  selectedDate,
  daysSummary,
  reflections,
  mentorFeedback,
  currentUser,
  authToken,
  onSelectDate,
  onStateUpdated,
  onDirtyChange,
  darkMode,
  historyOnlyMode = false,
}) => {
  const currentRecord =
    reflections.find((r) => r.reflectionDate === selectedDate) || null;
  const dayNumber = getDayNumberForDate(selectedDate) || 1;
  const dayFeedback = mentorFeedback.filter(
    (f) => f.reflectionDate === selectedDate
  );

  const [whatDidYouDo, setWhatDidYouDo] = useState('');
  const [tomorrowPlan, setTomorrowPlan] = useState('');
  const [todayRegret, setTodayRegret] = useState('');
  const [todayAchievement, setTodayAchievement] = useState('');
  const [expectedVersion, setExpectedVersion] = useState<number>(0);

  const [saveStatus, setSaveStatus] = useState<
    | 'idle'
    | 'unsaved'
    | 'saving'
    | 'saved_draft'
    | 'submitted'
    | 'edited_after_submission'
    | 'conflict'
    | 'failed'
  >('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [conflictServerRecord, setConflictServerRecord] = useState<any | null>(
    null
  );

  // History viewer controls
  const [historyViewMode, setHistoryViewMode] = useState<
    'timeline' | 'comparison'
  >('timeline');
  const [compareBeforeVer, setCompareBeforeVer] = useState<number>(1);
  const [compareAfterVer, setCompareAfterVer] = useState<number>(1);

  // Mentor feedback input
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [editingFeedbackId, setEditingFeedbackId] = useState<number | null>(
    null
  );
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Load selected day's reflection into form
  useEffect(() => {
    if (currentRecord) {
      setWhatDidYouDo(currentRecord.whatDidYouDo);
      setTomorrowPlan(currentRecord.tomorrowPlan);
      setTodayRegret(currentRecord.todayRegret);
      setTodayAchievement(currentRecord.todayAchievement);
      setExpectedVersion(currentRecord.currentVersion);
      setSaveStatus(
        currentRecord.status === 'submitted'
          ? 'submitted'
          : currentRecord.status === 'edited_after_submission'
          ? 'edited_after_submission'
          : 'saved_draft'
      );
      setStatusMessage('');
      setConflictServerRecord(null);

      const vers = [...currentRecord.versions].sort(
        (a, b) => a.versionNumber - b.versionNumber
      );
      if (vers.length >= 2) {
        setCompareBeforeVer(vers[0].versionNumber);
        setCompareAfterVer(vers[vers.length - 1].versionNumber);
      } else if (vers.length === 1) {
        setCompareBeforeVer(1);
        setCompareAfterVer(1);
      }
    } else {
      setWhatDidYouDo('');
      setTomorrowPlan('');
      setTodayRegret('');
      setTodayAchievement('');
      setExpectedVersion(0);
      setSaveStatus('idle');
      setStatusMessage('');
      setConflictServerRecord(null);
    }
    onDirtyChange?.(false);
  }, [selectedDate, currentRecord?.id, currentRecord?.currentVersion]);

  const isDirty = Boolean(
    currentRecord
      ? whatDidYouDo !== currentRecord.whatDidYouDo ||
          tomorrowPlan !== currentRecord.tomorrowPlan ||
          todayRegret !== currentRecord.todayRegret ||
          todayAchievement !== currentRecord.todayAchievement
      : whatDidYouDo.trim() ||
          tomorrowPlan.trim() ||
          todayRegret.trim() ||
          todayAchievement.trim()
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
    if (isDirty && saveStatus !== 'saving' && saveStatus !== 'conflict' && saveStatus !== 'failed') {
      setSaveStatus('unsaved');
    }
  }, [
    whatDidYouDo,
    tomorrowPlan,
    todayRegret,
    todayAchievement,
    isDirty,
  ]);

  // Browser tab close warning when unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleSaveReflection = async (
    mode: 'draft' | 'submit',
    overrideExpectedVersion?: number
  ) => {
    setSaveStatus('saving');
    setStatusMessage('Saving to PostgreSQL database...');

    try {
      const res = await fetch('/api/reflections', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-trial-seat': currentUser.role,
        },
        body: JSON.stringify({
          reflectionDate: selectedDate,
          whatDidYouDo,
          tomorrowPlan,
          todayRegret,
          todayAchievement,
          mode,
          expectedVersion:
            overrideExpectedVersion !== undefined
              ? overrideExpectedVersion
              : expectedVersion,
        }),
      });

      const data = await res.json();

      if (res.status === 409 && data.conflict) {
        setSaveStatus('conflict');
        setConflictServerRecord(data.serverRecord);
        setStatusMessage(
          data.error ||
            'Concurrent edit conflict detected! Another session updated this reflection. Your text is preserved below.'
        );
        return;
      }

      if (!res.ok) {
        setSaveStatus('failed');
        setStatusMessage(
          data.error ||
            'Your report could not be saved. Your text is still available here. Please retry.'
        );
        return;
      }

      const savedRef = data.reflection;
      setExpectedVersion(savedRef.currentVersion);
      setConflictServerRecord(null);
      onStateUpdated(data.state);
      onDirtyChange?.(false);

      const formattedDate = formatIndianDate(selectedDate);
      if (savedRef.status === 'submitted') {
        setSaveStatus('submitted');
        setStatusMessage(
          `Report successfully saved — Day ${dayNumber}, ${formattedDate} (Version v${savedRef.currentVersion})`
        );
      } else if (savedRef.status === 'edited_after_submission') {
        setSaveStatus('edited_after_submission');
        setStatusMessage(
          `Edited report saved with immutable snapshot — Day ${dayNumber}, ${formattedDate} (Version v${savedRef.currentVersion})`
        );
      } else {
        setSaveStatus('saved_draft');
        setStatusMessage(
          `Draft saved — Day ${dayNumber}, ${formattedDate} (Version v${savedRef.currentVersion})`
        );
      }
    } catch (err: any) {
      setSaveStatus('failed');
      setStatusMessage(
        'Your report could not be saved due to a connection error. Your text is still available here. Please retry.'
      );
    }
  };

  const handleSaveFeedback = async () => {
    if (!feedbackDraft.trim()) return;
    setFeedbackSaving(true);
    setFeedbackBanner(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-trial-seat': currentUser.role,
        },
        body: JSON.stringify({
          feedbackId: editingFeedbackId || undefined,
          reflectionDate: selectedDate,
          feedbackText: feedbackDraft,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save feedback.');
      }
      setFeedbackDraft('');
      setEditingFeedbackId(null);
      setFeedbackBanner('Mentor feedback saved and persisted.');
      onStateUpdated(data.state);
    } catch (err: any) {
      setFeedbackBanner(err.message || 'Error saving feedback.');
    } finally {
      setFeedbackSaving(false);
    }
  };

  const sortedVersionsAsc: ReflectionVersion[] = currentRecord
    ? [...currentRecord.versions].sort(
        (a, b) => a.versionNumber - b.versionNumber
      )
    : [];

  const beforeVersionObj =
    sortedVersionsAsc.find((v) => v.versionNumber === compareBeforeVer) ||
    sortedVersionsAsc[0];
  const afterVersionObj =
    sortedVersionsAsc.find((v) => v.versionNumber === compareAfterVer) ||
    sortedVersionsAsc[sortedVersionsAsc.length - 1];

  const renderDiffField = (
    label: string,
    beforeText: string,
    afterText: string
  ) => {
    const tokens = computeWordDiff(beforeText, afterText);
    const isUnchanged = beforeText.trim() === afterText.trim();
    return (
      <div
        className={`p-4 rounded-lg border ${
          darkMode
            ? 'bg-slate-950/60 border-slate-800'
            : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold font-display">{label}</span>
          <span className="text-[11px] text-slate-500">
            {isUnchanged ? 'No change in this field' : 'Modified'}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-3">
          <div
            className={`p-3 rounded border ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-slate-300'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <div className="text-[10px] font-mono text-slate-400 mb-1">
              BEFORE (v{beforeVersionObj?.versionNumber}) ·{' '}
              {formatTimestampIst(beforeVersionObj?.editedAt)}
            </div>
            <p className="whitespace-pre-wrap leading-relaxed">
              {beforeText || '—'}
            </p>
          </div>
          <div
            className={`p-3 rounded border ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-slate-200'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="text-[10px] font-mono text-slate-400 mb-1">
              AFTER (v{afterVersionObj?.versionNumber}) ·{' '}
              {formatTimestampIst(afterVersionObj?.editedAt)}
            </div>
            <p className="whitespace-pre-wrap leading-relaxed">
              {afterText || '—'}
            </p>
          </div>
        </div>
        {!isUnchanged && (
          <div
            className={`p-3 rounded border text-xs leading-relaxed ${
              darkMode
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="text-[10px] font-mono text-slate-400 mb-1">
              HIGHLIGHTED WORD-LEVEL DIFF
            </div>
            <div>
              {tokens.map((tok, idx) => {
                if (tok.type === 'added') {
                  return (
                    <span
                      key={idx}
                      className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300 px-0.5 rounded font-medium"
                    >
                      {tok.text}
                    </span>
                  );
                }
                if (tok.type === 'removed') {
                  return (
                    <span
                      key={idx}
                      className="bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 line-through px-0.5 rounded"
                    >
                      {tok.text}
                    </span>
                  );
                }
                return <span key={idx}>{tok.text}</span>;
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Day Header & Selector */}
      <div
        className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          darkMode
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200'
        }`}
      >
        <div>
          <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
            Daily Accountability &amp; Night Reflection
          </div>
          <h2 className="text-xl font-bold font-display mt-0.5">
            Day {dayNumber} — {formatIndianDate(selectedDate)}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
            <span>Status:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {saveStatus === 'unsaved'
                ? 'Unsaved changes'
                : saveStatus === 'saving'
                ? 'Saving...'
                : saveStatus === 'failed'
                ? 'Save failed'
                : saveStatus === 'conflict'
                ? 'Concurrent version conflict'
                : currentRecord?.status === 'submitted'
                ? 'Submitted'
                : currentRecord?.status === 'edited_after_submission'
                ? 'Edited after submission'
                : currentRecord?.status === 'draft_saved'
                ? 'Draft saved'
                : 'No report saved yet'}
            </span>
            {currentRecord && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Version v{currentRecord.currentVersion} ({currentRecord.editCount}{' '}
                  {currentRecord.editCount === 1 ? 'edit' : 'edits'})
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Last saved: {formatTimestampIst(currentRecord.updatedAt)}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">
            Switch Day:
          </label>
          <select
            value={selectedDate}
            onChange={(e) => {
              const targetDate = e.target.value;
              onSelectDate(targetDate);
            }}
            className={`px-3 py-2 rounded-lg border text-xs font-medium font-mono ${
              darkMode
                ? 'bg-slate-950 border-slate-700 text-slate-100'
                : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          >
            {daysSummary.map((d) => (
              <option key={d.date} value={d.date}>
                Day {d.dayNumber} · {d.shortLabel} (
                {d.reflectionStatus === 'none'
                  ? 'Empty'
                  : d.reflectionStatus === 'draft_saved'
                  ? 'Draft'
                  : d.reflectionStatus === 'edited_after_submission'
                  ? 'Edited'
                  : 'Submitted'}
                )
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status / Confirmation / Error / OCC Conflict Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
            saveStatus === 'failed' || saveStatus === 'conflict'
              ? 'border-red-300 bg-red-50 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200'
              : saveStatus === 'saving'
              ? 'border-blue-200 bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200'
              : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {saveStatus === 'failed' || saveStatus === 'conflict' ? (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-semibold">{statusMessage}</div>
              {saveStatus === 'conflict' && conflictServerRecord && (
                <div className="text-[11px] opacity-90">
                  Server is at Version v{conflictServerRecord.currentVersion} (last updated{' '}
                  {formatTimestampIst(conflictServerRecord.updatedAt)}). You can either save your current answers as Version v
                  {conflictServerRecord.currentVersion + 1} or reload the server&apos;s text.
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {saveStatus === 'failed' && (
              <button
                type="button"
                onClick={() => handleSaveReflection('submit')}
                className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Save</span>
              </button>
            )}
            {saveStatus === 'conflict' && conflictServerRecord && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    handleSaveReflection(
                      'submit',
                      conflictServerRecord.currentVersion
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-semibold cursor-pointer"
                >
                  Save Mine as v{conflictServerRecord.currentVersion + 1}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWhatDidYouDo(conflictServerRecord.whatDidYouDo);
                    setTomorrowPlan(conflictServerRecord.tomorrowPlan);
                    setTodayRegret(conflictServerRecord.todayRegret);
                    setTodayAchievement(conflictServerRecord.todayAchievement);
                    setExpectedVersion(conflictServerRecord.currentVersion);
                    setSaveStatus('submitted');
                    setConflictServerRecord(null);
                    setStatusMessage('Loaded latest server version.');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-red-400 font-medium cursor-pointer"
                >
                  Load Server v{conflictServerRecord.currentVersion}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Four Hinglish Questions Form */}
      {!historyOnlyMode && (
        <div
          className={`p-6 rounded-xl border space-y-5 ${
            darkMode
              ? 'bg-slate-900 border-slate-800'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold font-display">
                Four Required Daily Questions (Hinglish)
              </h3>
              <p className="text-xs text-slate-500">
                Every edit creates a permanent, append-only version snapshot in PostgreSQL.
              </p>
            </div>
            {isDirty && (
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Unsaved changes in form
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Question 1 */}
            <div className="space-y-1.5">
              <label className="block text-sm font-bold font-display">
                1. Aaj kya kiya?
              </label>
              <p className="text-xs text-slate-500">
                Explain the lectures, short notes, PYQs, and revisions you actually completed today.
              </p>
              <textarea
                rows={4}
                value={whatDidYouDo}
                onChange={(e) => setWhatDidYouDo(e.target.value)}
                placeholder="e.g., EMI ka one-shot lecture complete kiya aur 20 PYQs solve kiye..."
                className={`w-full p-3 rounded-lg border text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                  darkMode
                    ? 'bg-slate-950 border-slate-800 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            {/* Question 2 */}
            <div className="space-y-1.5">
              <label className="block text-sm font-bold font-display">
                2. Kal kya karna hai?
              </label>
              <p className="text-xs text-slate-500">
                Describe tomorrow&apos;s specific chapter, lecture, and PYQ targets.
              </p>
              <textarea
                rows={4}
                value={tomorrowPlan}
                onChange={(e) => setTomorrowPlan(e.target.value)}
                placeholder="e.g., Kal EMI ke remaining PYQs aur Matrices ka revision complete karna hai..."
                className={`w-full p-3 rounded-lg border text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                  darkMode
                    ? 'bg-slate-950 border-slate-800 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            {/* Question 3 */}
            <div className="space-y-1.5">
              <label className="block text-sm font-bold font-display">
                3. Aaj ka regret kya raha?
              </label>
              <p className="text-xs text-slate-500">
                Be honest about missed targets, distractions, slow speed, or avoidable mistakes.
              </p>
              <textarea
                rows={4}
                value={todayRegret}
                onChange={(e) => setTodayRegret(e.target.value)}
                placeholder="e.g., Afternoon mein 1 hour phone distraction mein waste hua, silly calculation mistakes hui..."
                className={`w-full p-3 rounded-lg border text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                  darkMode
                    ? 'bg-slate-950 border-slate-800 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            {/* Question 4 */}
            <div className="space-y-1.5">
              <label className="block text-sm font-bold font-display">
                4. Aaj kya achieve kiya?
              </label>
              <p className="text-xs text-slate-500">
                Identify concrete progress, tough concepts mastered, or accuracy improvements.
              </p>
              <textarea
                rows={4}
                value={todayAchievement}
                onChange={(e) => setTodayAchievement(e.target.value)}
                placeholder="e.g., Faraday's law & Lenz law questions mein confidence aa gaya aur Kinematics short notes ban gaye..."
                className={`w-full p-3 rounded-lg border text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                  darkMode
                    ? 'bg-slate-950 border-slate-800 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              Expected Concurrency Version:{' '}
              <span className="font-mono font-semibold tabular-nums">
                v{expectedVersion}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={saveStatus === 'saving'}
                onClick={() => handleSaveReflection('draft')}
                className={`px-4 py-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                  darkMode
                    ? 'border-slate-700 hover:bg-slate-800 text-slate-200'
                    : 'border-slate-300 hover:bg-slate-100 text-slate-800'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                disabled={saveStatus === 'saving'}
                onClick={() => handleSaveReflection('submit')}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>
                  {currentRecord?.submittedAt
                    ? 'Save Edited Report (New Version)'
                    : 'Submit Daily Report'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mentor Feedback Panel for this Day */}
      <div
        className={`p-6 rounded-xl border space-y-4 ${
          darkMode
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-bold font-display">
              Mentor Feedback — Day {dayNumber} ({formatIndianDate(selectedDate)})
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            {currentUser.role === 'mentor'
              ? 'Mentor Write Access Enabled'
              : 'Read-Only for Student'}
          </span>
        </div>

        {dayFeedback.length === 0 ? (
          <div className="text-xs text-slate-500 py-2">
            No mentor feedback recorded for Day {dayNumber} yet.
          </div>
        ) : (
          <div className="space-y-3">
            {dayFeedback.map((fb) => (
              <div
                key={fb.id}
                className={`p-4 rounded-lg border ${
                  darkMode
                    ? 'bg-slate-950/60 border-slate-800'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {fb.mentorName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono tabular-nums">
                      v{fb.versionNumber} · {formatTimestampIst(fb.updatedAt)}
                    </span>
                    {currentUser.role === 'mentor' && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFeedbackId(fb.id);
                          setFeedbackDraft(fb.feedbackText);
                        }}
                        className="text-blue-600 dark:text-blue-400 underline cursor-pointer"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {fb.feedbackText}
                </p>
              </div>
            ))}
          </div>
        )}

        {currentUser.role === 'mentor' && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <label className="block text-xs font-semibold">
              {editingFeedbackId
                ? `Editing Feedback #${editingFeedbackId} (Preserves Version History)`
                : `Add Mentor Feedback for Day ${dayNumber}`}
            </label>
            <textarea
              rows={2}
              value={feedbackDraft}
              onChange={(e) => setFeedbackDraft(e.target.value)}
              placeholder='e.g., "EMI ke PYQs aur improve karo. Kal Physics ka pending revision complete karna."'
              className={`w-full p-3 rounded-lg border text-xs ${
                darkMode
                  ? 'bg-slate-950 border-slate-800 text-slate-100'
                  : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                {feedbackBanner}
              </span>
              <div className="flex items-center gap-2">
                {editingFeedbackId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFeedbackId(null);
                      setFeedbackDraft('');
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  disabled={feedbackSaving || !feedbackDraft.trim()}
                  onClick={handleSaveFeedback}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  {feedbackSaving
                    ? 'Saving...'
                    : editingFeedbackId
                    ? 'Update Feedback'
                    : 'Post Mentor Feedback'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Immutable Reflection Version History & Diff Viewer */}
      <div
        className={`p-6 rounded-xl border space-y-5 ${
          darkMode
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-base font-bold font-display">
                Immutable Version History — Day {dayNumber} (
                {formatIndianDate(selectedDate)})
              </h3>
              <p className="text-xs text-slate-500">
                Append-only historical snapshots. Neither student nor mentor can delete or overwrite past versions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setHistoryViewMode('timeline')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                historyViewMode === 'timeline'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Timeline View ({sortedVersionsAsc.length})
            </button>
            <button
              type="button"
              onClick={() => setHistoryViewMode('comparison')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                historyViewMode === 'comparison'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Comparison Diff View</span>
            </button>
          </div>
        </div>

        {!currentRecord || sortedVersionsAsc.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No reflection versions have been saved for Day {dayNumber} (
            {formatIndianDate(selectedDate)}) yet.
          </div>
        ) : historyViewMode === 'timeline' ? (
          <div className="space-y-4">
            {sortedVersionsAsc.map((ver) => (
              <div
                key={ver.id}
                className={`p-4 rounded-xl border space-y-3 ${
                  darkMode
                    ? 'bg-slate-950/50 border-slate-800'
                    : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                      Version {ver.versionNumber} —{' '}
                      {ver.versionNumber === 1
                        ? 'Original'
                        : ver.versionNumber === 2
                        ? 'Edited'
                        : 'Edited again'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium">
                      {ver.changeType === 'draft_saved'
                        ? 'Draft Saved'
                        : ver.changeType === 'submitted'
                        ? 'Submitted'
                        : 'Edited After Submission'}
                    </span>
                  </div>
                  <div className="text-slate-500 font-mono tabular-nums">
                    By {ver.editedByName} ({ver.editedByRole}) ·{' '}
                    {formatTimestampIst(ver.editedAt)}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-slate-500 mb-0.5">
                      Aaj kya kiya?
                    </div>
                    <p className="whitespace-pre-wrap">{ver.whatDidYouDo || '—'}</p>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-500 mb-0.5">
                      Kal kya karna hai?
                    </div>
                    <p className="whitespace-pre-wrap">{ver.tomorrowPlan || '—'}</p>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-500 mb-0.5">
                      Aaj ka regret kya raha?
                    </div>
                    <p className="whitespace-pre-wrap">{ver.todayRegret || '—'}</p>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-500 mb-0.5">
                      Aaj kya achieve kiya?
                    </div>
                    <p className="whitespace-pre-wrap">
                      {ver.todayAchievement || '—'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Compare Before:</span>
                <select
                  value={compareBeforeVer}
                  onChange={(e) => setCompareBeforeVer(Number(e.target.value))}
                  className={`px-2.5 py-1.5 rounded border font-mono ${
                    darkMode
                      ? 'bg-slate-950 border-slate-700'
                      : 'bg-white border-slate-300'
                  }`}
                >
                  {sortedVersionsAsc.map((v) => (
                    <option key={v.versionNumber} value={v.versionNumber}>
                      v{v.versionNumber} ({v.changeType}) ·{' '}
                      {formatTimestampIst(v.editedAt)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500">With After:</span>
                <select
                  value={compareAfterVer}
                  onChange={(e) => setCompareAfterVer(Number(e.target.value))}
                  className={`px-2.5 py-1.5 rounded border font-mono ${
                    darkMode
                      ? 'bg-slate-950 border-slate-700'
                      : 'bg-white border-slate-300'
                  }`}
                >
                  {sortedVersionsAsc.map((v) => (
                    <option key={v.versionNumber} value={v.versionNumber}>
                      v{v.versionNumber} ({v.changeType}) ·{' '}
                      {formatTimestampIst(v.editedAt)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {beforeVersionObj && afterVersionObj && (
              <div className="space-y-3">
                {renderDiffField(
                  '1. Aaj kya kiya?',
                  beforeVersionObj.whatDidYouDo,
                  afterVersionObj.whatDidYouDo
                )}
                {renderDiffField(
                  '2. Kal kya karna hai?',
                  beforeVersionObj.tomorrowPlan,
                  afterVersionObj.tomorrowPlan
                )}
                {renderDiffField(
                  '3. Aaj ka regret kya raha?',
                  beforeVersionObj.todayRegret,
                  afterVersionObj.todayRegret
                )}
                {renderDiffField(
                  '4. Aaj kya achieve kiya?',
                  beforeVersionObj.todayAchievement,
                  afterVersionObj.todayAchievement
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
