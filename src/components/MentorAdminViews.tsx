import React, { useState } from 'react';
import {
  SprintStateResponse,
  StudyTask,
  UserProfile,
} from '../types.ts';
import {
  formatIndianDate,
  formatShortIndianDate,
  formatTimestampIst,
  roundOneDecimal,
} from '../utils/ist.ts';
import {
  Plus,
  Calendar,
  Archive,
  RotateCcw,
  Download,
  History,
  Award,
  CheckCircle2,
  AlertCircle,
  Search,
  ExternalLink,
  Folder,
  FileText,
  Cloud,
  ShieldCheck,
  Database,
  Share2,
} from 'lucide-react';

interface TaskMonitorProps {
  sprintState: SprintStateResponse;
  currentUser: UserProfile;
  authToken: string;
  onStateUpdated: (newState: any) => void;
  darkMode: boolean;
  overdueOnly?: boolean;
}

export const TaskMonitorView: React.FC<TaskMonitorProps> = ({
  sprintState,
  currentUser,
  authToken,
  onStateUpdated,
  darkMode,
  overdueOnly = false,
}) => {
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>(
    overdueOnly ? 'overdue' : 'All'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [banner, setBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Create custom task form state (Mentor only)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTaskChapterId, setNewTaskChapterId] = useState<number>(
    sprintState.newChapters[0]?.id || 1
  );
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskType, setNewTaskType] = useState('PYQ');
  const [newTaskAssignedDate, setNewTaskAssignedDate] = useState('2026-10-25');
  const [newTaskDueDate, setNewTaskDueDate] = useState('2026-10-28');
  const [newTaskMinutes, setNewTaskMinutes] = useState('45');

  // Reschedule modal/inline state
  const [reschedulingTaskId, setReschedulingTaskId] = useState<number | null>(
    null
  );
  const [rescheduleAssignedDate, setRescheduleAssignedDate] = useState('');
  const [rescheduleDueDate, setRescheduleDueDate] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  const filteredTasks = sprintState.tasks.filter((t) => {
    if (statusFilter !== 'archived' && t.isArchived) return false;
    if (statusFilter === 'archived' && !t.isArchived) return false;
    if (subjectFilter !== 'All' && t.subject !== subjectFilter) return false;
    if (statusFilter === 'overdue' && !t.isOverdue) return false;
    if (
      statusFilter === 'pending_all' &&
      (t.status === 'completed' || t.isArchived)
    )
      return false;
    if (statusFilter === 'rescheduled' && !t.isRescheduled) return false;
    if (
      ['not_started', 'in_progress', 'completed'].includes(statusFilter) &&
      t.status !== statusFilter
    ) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !t.title.toLowerCase().includes(q) &&
        !t.chapterName.toLowerCase().includes(q) &&
        !t.taskType.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const handleCreateCustomTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-trial-seat': currentUser.role,
        },
        body: JSON.stringify({
          chapterId: Number(newTaskChapterId),
          title: newTaskTitle,
          description: newTaskDesc,
          taskType: newTaskType,
          assignedDate: newTaskAssignedDate,
          dueDate: newTaskDueDate,
          estimatedMinutes: Number(newTaskMinutes) || 45,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create custom task.');
      }
      onStateUpdated(data.state);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setShowCreateForm(false);
      setBanner({
        type: 'success',
        text: `Created new assigned task "${data.createdTask.title}".`,
      });
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err.message || 'Error creating task.',
      });
    }
  };

  const handleRescheduleSubmit = async (taskId: number) => {
    setBanner(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/reschedule`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-trial-seat': currentUser.role,
        },
        body: JSON.stringify({
          assignedDate: rescheduleAssignedDate,
          dueDate: rescheduleDueDate,
          reason: rescheduleReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reschedule task.');
      }
      onStateUpdated(data.state);
      setReschedulingTaskId(null);
      setRescheduleReason('');
      setBanner({
        type: 'success',
        text: `Rescheduled task to ${formatIndianDate(
          rescheduleDueDate
        )} (original due date preserved in audit log).`,
      });
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err.message || 'Failed to reschedule task.',
      });
    }
  };

  const handleArchiveToggle = async (task: StudyTask) => {
    setBanner(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/archive`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-trial-seat': currentUser.role,
        },
        body: JSON.stringify({
          archive: !task.isArchived,
          reason: task.isArchived
            ? 'Restored to active sprint tasks by mentor'
            : 'Soft-archived by mentor (excluded from active denominator)',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update archive state.');
      }
      onStateUpdated(data.state);
      setBanner({
        type: 'success',
        text: task.isArchived
          ? `Restored "${task.title}" to active sprint tasks.`
          : `Archived "${task.title}". Active completion percentage recalculated while preserving audit history.`,
      });
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err.message || 'Error archiving task.',
      });
    }
  };

  const handleStatusChange = async (
    task: StudyTask,
    nextStatus: 'not_started' | 'in_progress' | 'completed'
  ) => {
    setBanner(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-trial-seat': currentUser.role,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update task status.');
      }
      onStateUpdated(data.state);
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err.message || 'Error updating task status.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div
        className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          darkMode
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200'
        }`}
      >
        <div>
          <h2 className="text-lg font-bold font-display">
            {overdueOnly
              ? 'Pending, Carry-Forward & Overdue Task Queue'
              : 'Mentor Task Monitor & Schedule Administration'}
          </h2>
          <p className="text-xs text-slate-500">
            Rescheduling preserves original due dates. Soft-archiving excludes tasks from active denominators while retaining full audit history.
          </p>
        </div>

        {currentUser.role === 'mentor' && (
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{showCreateForm ? 'Close Form' : 'Assign New Task'}</span>
          </button>
        )}
      </div>

      {banner && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            banner.type === 'error'
              ? 'border-red-300 bg-red-50 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200'
              : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{banner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Mentor Create Custom Task Form */}
      {showCreateForm && currentUser.role === 'mentor' && (
        <form
          onSubmit={handleCreateCustomTask}
          className={`p-5 rounded-xl border space-y-4 ${
            darkMode
              ? 'bg-slate-900 border-slate-800'
              : 'bg-white border-slate-200'
          }`}
        >
          <h3 className="text-sm font-bold font-display">
            Create &amp; Assign Custom Sprint Task
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">Target Chapter</label>
              <select
                value={newTaskChapterId}
                onChange={(e) => setNewTaskChapterId(Number(e.target.value))}
                className={`w-full px-3 py-2 rounded-lg border ${
                  darkMode
                    ? 'bg-slate-950 border-slate-700'
                    : 'bg-slate-50 border-slate-300'
                }`}
              >
                {sprintState.newChapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.subject}: {c.chapterName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-500 mb-1">Task Type</label>
              <select
                value={newTaskType}
                onChange={(e) => setNewTaskType(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${
                  darkMode
                    ? 'bg-slate-950 border-slate-700'
                    : 'bg-slate-50 border-slate-300'
                }`}
              >
                <option value="Lecture">Lecture</option>
                <option value="Concept review">Concept review</option>
                <option value="PYQ">PYQ</option>
                <option value="Short notes">Short notes</option>
                <option value="Revision">Revision</option>
                <option value="Test">Test</option>
                <option value="Mistake analysis">Mistake analysis</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 mb-1">
                Estimated Minutes
              </label>
              <input
                type="number"
                min={5}
                value={newTaskMinutes}
                onChange={(e) => setNewTaskMinutes(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border font-mono ${
                  darkMode
                    ? 'bg-slate-950 border-slate-700'
                    : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-slate-500 mb-1">Task Title</label>
              <input
                type="text"
                required
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="e.g., Solve 15 additional LCR resonance PYQs (2023-2025)"
                className={`w-full px-3 py-2 rounded-lg border ${
                  darkMode
                    ? 'bg-slate-950 border-slate-700'
                    : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-1">Assigned Date</label>
              <input
                type="date"
                required
                value={newTaskAssignedDate}
                onChange={(e) => setNewTaskAssignedDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border font-mono ${
                  darkMode
                    ? 'bg-slate-950 border-slate-700'
                    : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-1">Due Date</label>
              <input
                type="date"
                required
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border font-mono ${
                  darkMode
                    ? 'bg-slate-950 border-slate-700'
                    : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-1">
                Optional Instructions
              </label>
              <input
                type="text"
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                placeholder="Notes for Janvi..."
                className={`w-full px-3 py-2 rounded-lg border ${
                  darkMode
                    ? 'bg-slate-950 border-slate-700'
                    : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              Create &amp; Assign Task
            </button>
          </div>
        </form>
      )}

      {/* Filter Bar */}
      <div
        className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
          darkMode
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className={`px-3 py-1.5 rounded-lg border font-medium ${
              darkMode
                ? 'bg-slate-950 border-slate-700'
                : 'bg-slate-50 border-slate-300'
            }`}
          >
            <option value="All">All Subjects</option>
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Mathematics">Mathematics</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-3 py-1.5 rounded-lg border font-medium ${
              darkMode
                ? 'bg-slate-950 border-slate-700'
                : 'bg-slate-50 border-slate-300'
            }`}
          >
            <option value="All">All Active Tasks</option>
            <option value="pending_all">All Pending (Not Completed)</option>
            <option value="overdue">Overdue Only</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="rescheduled">Rescheduled</option>
            <option value="archived">Archived Tasks</option>
          </select>
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by chapter or task title..."
            className={`w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs ${
              darkMode
                ? 'bg-slate-950 border-slate-700'
                : 'bg-slate-50 border-slate-300'
            }`}
          />
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-2.5">
        {filteredTasks.length === 0 ? (
          <div
            className={`p-8 rounded-xl border text-center text-xs text-slate-500 ${
              darkMode
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-slate-200'
            }`}
          >
            No tasks match the current filter criteria.
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isRescheduling = reschedulingTaskId === task.id;
            return (
              <div
                key={task.id}
                className={`p-4 rounded-xl border space-y-3 ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {task.subject}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{task.chapterName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{task.taskType}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Due: {formatShortIndianDate(task.dueDate)}
                      </span>
                      {task.isRescheduled && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-600 dark:text-amber-400 font-mono">
                            Rescheduled (Orig Due:{' '}
                            {formatShortIndianDate(task.originalDueDate)})
                          </span>
                        </>
                      )}
                      {task.isOverdue && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-red-600 dark:text-red-400 font-semibold">
                            Overdue
                          </span>
                        </>
                      )}
                    </div>

                    <div className="text-sm font-bold font-display">
                      {task.title}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <select
                      value={task.status}
                      disabled={task.isArchived}
                      onChange={(e) =>
                        handleStatusChange(
                          task,
                          e.target.value as
                            | 'not_started'
                            | 'in_progress'
                            | 'completed'
                        )
                      }
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
                        darkMode
                          ? 'bg-slate-950 border-slate-700'
                          : 'bg-slate-50 border-slate-300'
                      }`}
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>

                    {currentUser.role === 'mentor' && !task.isArchived && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isRescheduling) {
                            setReschedulingTaskId(null);
                          } else {
                            setReschedulingTaskId(task.id);
                            setRescheduleAssignedDate(task.assignedDate);
                            setRescheduleDueDate(task.dueDate);
                            setRescheduleReason('');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 cursor-pointer ${
                          darkMode
                            ? 'border-slate-700 hover:bg-slate-800'
                            : 'border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Reschedule</span>
                      </button>
                    )}

                    {currentUser.role === 'mentor' && (
                      <button
                        type="button"
                        onClick={() => handleArchiveToggle(task)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 cursor-pointer ${
                          task.isArchived
                            ? 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300'
                            : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-400'
                        }`}
                      >
                        {task.isArchived ? (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restore</span>
                          </>
                        ) : (
                          <>
                            <Archive className="w-3.5 h-3.5" />
                            <span>Archive</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {isRescheduling && currentUser.role === 'mentor' && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-500 mb-1">
                        Original Due Date (Preserved)
                      </label>
                      <input
                        type="text"
                        disabled
                        value={task.originalDueDate}
                        className="w-full px-2.5 py-1.5 rounded border bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">
                        New Due Date
                      </label>
                      <input
                        type="date"
                        value={rescheduleDueDate}
                        onChange={(e) => setRescheduleDueDate(e.target.value)}
                        className={`w-full px-2.5 py-1.5 rounded border font-mono ${
                          darkMode
                            ? 'bg-slate-950 border-slate-700'
                            : 'bg-white border-slate-300'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">
                        Reason for Rescheduling
                      </label>
                      <input
                        type="text"
                        value={rescheduleReason}
                        onChange={(e) => setRescheduleReason(e.target.value)}
                        placeholder="e.g., Adjusted for heavy organic chem workload"
                        className={`w-full px-2.5 py-1.5 rounded border ${
                          darkMode
                            ? 'bg-slate-950 border-slate-700'
                            : 'bg-white border-slate-300'
                        }`}
                      />
                    </div>
                    <div className="flex items-end justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleRescheduleSubmit(task.id)}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                      >
                        Save New Due Date
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

interface AuditHistoryViewProps {
  sprintState: SprintStateResponse;
  darkMode: boolean;
}

export const AuditHistoryView: React.FC<AuditHistoryViewProps> = ({
  sprintState,
  darkMode,
}) => {
  const [tab, setTab] = useState<'tasks' | 'pyqs'>('tasks');
  const taskMap = new Map(sprintState.tasks.map((t) => [t.id, t]));
  const chapterMap = new Map(sprintState.newChapters.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <div
        className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          darkMode
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <div>
            <h2 className="text-lg font-bold font-display">
              Immutable Task &amp; PYQ Audit Trail
            </h2>
            <p className="text-xs text-slate-500">
              Append-only chronological log of all status transitions, rescheduling events, and PYQ session logs/corrections.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setTab('tasks')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
              tab === 'tasks'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Task Audit Events ({sprintState.taskAuditEvents.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('pyqs')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
              tab === 'pyqs'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            PYQ Audit Events ({sprintState.pyqAuditEvents.length})
          </button>
        </div>
      </div>

      {tab === 'tasks' ? (
        <div className="space-y-2.5">
          {sprintState.taskAuditEvents.length === 0 ? (
            <div
              className={`p-8 rounded-xl border text-center text-xs text-slate-500 ${
                darkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200'
              }`}
            >
              No task status or schedule changes have been recorded yet.
            </div>
          ) : (
            sprintState.taskAuditEvents.map((ev) => {
              const t = taskMap.get(ev.taskId);
              return (
                <div
                  key={ev.id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                    darkMode
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-slate-500">
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {ev.changedByName} ({ev.changedByRole})
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{ev.action}</span>
                      {t && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            {t.subject} — {t.chapterName}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="font-semibold text-sm">
                      {t ? t.title : `Task #${ev.taskId}`}
                    </div>

                    <div className="text-slate-600 dark:text-slate-400 font-mono">
                      {ev.action === 'status_changed' && (
                        <span>
                          Status: {ev.previousStatus} → {ev.newStatus}
                        </span>
                      )}
                      {ev.action === 'rescheduled' && (
                        <span>
                          Due Date: {ev.previousDueDate} → {ev.newDueDate}{' '}
                          {ev.reason ? `(${ev.reason})` : ''}
                        </span>
                      )}
                      {ev.action !== 'status_changed' &&
                        ev.action !== 'rescheduled' && (
                          <span>
                            {ev.reason || `${ev.oldValue} → ${ev.newValue}`}
                          </span>
                        )}
                    </div>
                  </div>

                  <div className="text-slate-500 font-mono tabular-nums shrink-0">
                    {formatTimestampIst(ev.changedAt)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {sprintState.pyqAuditEvents.length === 0 ? (
            <div
              className={`p-8 rounded-xl border text-center text-xs text-slate-500 ${
                darkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200'
              }`}
            >
              No PYQ session or target audit events recorded yet.
            </div>
          ) : (
            sprintState.pyqAuditEvents.map((ev) => {
              const ch = chapterMap.get(ev.chapterId);
              return (
                <div
                  key={ev.id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                    darkMode
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {ev.changedByName}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{ev.action}</span>
                      {ch && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            {ch.subject} — {ch.chapterName}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="text-slate-700 dark:text-slate-300 font-mono break-all">
                      {ev.reason && <span className="mr-2">{ev.reason}:</span>}
                      {ev.oldValue ? `${ev.oldValue} → ` : ''}
                      {ev.newValue}
                    </div>
                  </div>
                  <div className="text-slate-500 font-mono tabular-nums shrink-0">
                    {formatTimestampIst(ev.changedAt)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

interface MockTestsViewProps {
  sprintState: SprintStateResponse;
  currentUser: UserProfile;
  authToken: string;
  onStateUpdated: (newState: any) => void;
  darkMode: boolean;
}

export const MockTestsView: React.FC<MockTestsViewProps> = ({
  sprintState,
  currentUser,
  authToken,
  onStateUpdated,
  darkMode,
}) => {
  const mock = sprintState.mockTests[0];
  const [physics, setPhysics] = useState<string>(
    mock?.physicsMarks !== null && mock?.physicsMarks !== undefined
      ? String(mock.physicsMarks)
      : ''
  );
  const [chemistry, setChemistry] = useState<string>(
    mock?.chemistryMarks !== null && mock?.chemistryMarks !== undefined
      ? String(mock.chemistryMarks)
      : ''
  );
  const [maths, setMaths] = useState<string>(
    mock?.mathsMarks !== null && mock?.mathsMarks !== undefined
      ? String(mock.mathsMarks)
      : ''
  );
  const [attempted, setAttempted] = useState<string>(
    mock?.attempted !== null && mock?.attempted !== undefined
      ? String(mock.attempted)
      : ''
  );
  const [correct, setCorrect] = useState<string>(
    mock?.correct !== null && mock?.correct !== undefined
      ? String(mock.correct)
      : ''
  );
  const [incorrect, setIncorrect] = useState<string>(
    mock?.incorrect !== null && mock?.incorrect !== undefined
      ? String(mock.incorrect)
      : ''
  );
  const [notes, setNotes] = useState<string>(mock?.notes || '');
  const [mentorAnalysis, setMentorAnalysis] = useState<string>(
    mock?.mentorAnalysis || ''
  );
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  if (!mock) return null;

  const hasResultRecorded =
    mock.physicsMarks !== null &&
    mock.chemistryMarks !== null &&
    mock.mathsMarks !== null;

  const totalScore = hasResultRecorded
    ? (mock.physicsMarks || 0) +
      (mock.chemistryMarks || 0) +
      (mock.mathsMarks || 0)
    : null;

  const classifiedQuestions = (mock.correct || 0) + (mock.incorrect || 0);
  const accuracyPct =
    hasResultRecorded && classifiedQuestions > 0
      ? roundOneDecimal(((mock.correct || 0) / classifiedQuestions) * 100)
      : null;

  const handleSaveMock = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setBanner(null);
    try {
      const hasScoreInputs =
        physics.trim() !== '' &&
        chemistry.trim() !== '' &&
        maths.trim() !== '';

      const res = await fetch(`/api/mock-tests/${mock.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-trial-seat': currentUser.role,
        },
        body: JSON.stringify({
          physicsMarks: hasScoreInputs ? Number(physics) : null,
          chemistryMarks: hasScoreInputs ? Number(chemistry) : null,
          mathsMarks: hasScoreInputs ? Number(maths) : null,
          attempted: attempted.trim() !== '' ? Number(attempted) : null,
          correct: correct.trim() !== '' ? Number(correct) : null,
          incorrect: incorrect.trim() !== '' ? Number(incorrect) : null,
          notes,
          mentorAnalysis,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save mock test record.');
      }
      onStateUpdated(data.state);
      setBanner('Mock test record saved to PostgreSQL.');
    } catch (err: any) {
      setBanner(err.message || 'Error saving mock test.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div
        className={`p-6 rounded-xl border space-y-4 ${
          darkMode
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-lg font-bold font-display">
                {formatIndianDate(mock.testDate)} — {mock.testName}
              </h2>
              <p className="text-xs text-slate-500">
                Maximum Marks: {mock.maximumMarks} · Post-Sprint Diagnostic Evaluation
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            Target Date: 9 November 2026
          </span>
        </div>

        {!hasResultRecorded ? (
          <div
            className={`p-5 rounded-lg border text-xs text-slate-500 ${
              darkMode
                ? 'bg-slate-950/60 border-slate-800'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            No mock test has been recorded yet. Once Janvi attempts the 9 November 2026 JEE Main Diagnostic Mock, enter the subject scores and question counts below.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div
              className={`p-4 rounded-lg border ${
                darkMode
                  ? 'bg-slate-950 border-slate-800'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="text-xs text-slate-500">Total Score</div>
              <div className="text-xl font-bold font-mono tabular-nums mt-1">
                {totalScore} / {mock.maximumMarks}
              </div>
            </div>
            <div
              className={`p-4 rounded-lg border ${
                darkMode
                  ? 'bg-slate-950 border-slate-800'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="text-xs text-slate-500">Physics</div>
              <div className="text-xl font-bold font-mono tabular-nums mt-1">
                {mock.physicsMarks} / 100
              </div>
            </div>
            <div
              className={`p-4 rounded-lg border ${
                darkMode
                  ? 'bg-slate-950 border-slate-800'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="text-xs text-slate-500">Chemistry</div>
              <div className="text-xl font-bold font-mono tabular-nums mt-1">
                {mock.chemistryMarks} / 100
              </div>
            </div>
            <div
              className={`p-4 rounded-lg border ${
                darkMode
                  ? 'bg-slate-950 border-slate-800'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="text-xs text-slate-500">Mathematics</div>
              <div className="text-xl font-bold font-mono tabular-nums mt-1">
                {mock.mathsMarks} / 100
              </div>
            </div>
            <div
              className={`p-4 rounded-lg border ${
                darkMode
                  ? 'bg-slate-950 border-slate-800'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="text-xs text-slate-500">Accuracy</div>
              <div className="text-xl font-bold font-mono tabular-nums mt-1">
                {accuracyPct === null ? 'N/A' : `${accuracyPct}%`}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSaveMock} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">
                Physics (/100)
              </label>
              <input
                type="number"
                min={-25}
                max={100}
                value={physics}
                onChange={(e) => setPhysics(e.target.value)}
                placeholder="—"
                className={`w-full px-3 py-2 rounded-lg border font-mono tabular-nums ${
                  darkMode
                    ? 'bg-slate-950 border-slate-700'
                    : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">
                Chemistry (/100)
              </label>
              <input
                type="number"
                min={-25}
                max={100}
                value={chemistry}
                onChange={(e) => setChemistry(e.target.value)}
                placeholder="—"
                className={`w-full px-3 py-2 rounded-lg border font-mono tabular-nums ${
                  darkMode
                    ? 'bg-slate-950 border-slate-700'
                    : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">
                Mathematics (/100)
              </label>
              <input
                type="number"
                min={-25}
                max={100}
                value={maths}
                onChange={(e) => setMaths(e.target.value)}
                placeholder="—"
                className={`w-full px-3 py-2 rounded-lg border font-mono tabular-nums ${
                  darkMode
                    ? 'bg-slate-950 border-slate-700'
                    : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">
                Attempted Qs
              </label>
              <input
                type="number"
                min={0}
                max={75}
                value={attempted}
                onChange={(e) => setAttempted(e.target.value)}
                placeholder="—"
                className={`w-full px-3 py-2 rounded-lg border font-mono tabular-nums ${
                  darkMode
                    ? 'bg-slate-950 border-slate-700'
                    : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Correct Qs</label>
              <input
                type="number"
                min={0}
                max={75}
                value={correct}
                onChange={(e) => setCorrect(e.target.value)}
                placeholder="—"
                className={`w-full px-3 py-2 rounded-lg border font-mono tabular-nums ${
                  darkMode
                    ? 'bg-slate-950 border-slate-700'
                    : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Incorrect Qs</label>
              <input
                type="number"
                min={0}
                max={75}
                value={incorrect}
                onChange={(e) => setIncorrect(e.target.value)}
                placeholder="—"
                className={`w-full px-3 py-2 rounded-lg border font-mono tabular-nums ${
                  darkMode
                    ? 'bg-slate-950 border-slate-700'
                    : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold mb-1">
                Student Mock Reflection &amp; Time-Management Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Janvi's post-mock notes..."
                className={`w-full p-3 rounded-lg border ${
                  darkMode
                    ? 'bg-slate-950 border-slate-700'
                    : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">
                Mentor Diagnostic Analysis (
                {currentUser.role === 'mentor'
                  ? 'Mentor Editable'
                  : 'Read-Only for Student'}
                )
              </label>
              <textarea
                rows={3}
                disabled={currentUser.role !== 'mentor'}
                value={mentorAnalysis}
                onChange={(e) => setMentorAnalysis(e.target.value)}
                placeholder="Titanium Nikhil's diagnostic breakdown..."
                className={`w-full p-3 rounded-lg border ${
                  darkMode
                    ? 'bg-slate-950 border-slate-700'
                    : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              {banner}
            </span>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Mock Test Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ExportsViewProps {
  authToken: string;
  currentUser: UserProfile;
  darkMode: boolean;
}

const GDRIVE_LINK_KEY = 'titanium_sprint_gdrive_folder_url';

export const ExportsView: React.FC<ExportsViewProps> = ({
  authToken,
  currentUser,
  darkMode,
}) => {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState<string>(() => {
    try {
      return localStorage.getItem(GDRIVE_LINK_KEY) || '';
    } catch {
      return '';
    }
  });
  const [editingDriveUrl, setEditingDriveUrl] = useState<boolean>(false);
  const [tempDriveUrl, setTempDriveUrl] = useState<string>(driveUrl);

  const handleSaveDriveUrl = () => {
    try {
      localStorage.setItem(GDRIVE_LINK_KEY, tempDriveUrl.trim());
      setDriveUrl(tempDriveUrl.trim());
      setEditingDriveUrl(false);
      setSuccessMsg('Google Drive Study Folder link updated.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch {
      setError('Failed to save Drive URL to browser storage.');
    }
  };

  const handleDownloadExport = async (
    type: 'tasks' | 'pyq-sessions' | 'reflections' | 'audit-history' | 'full-json',
    filename: string
  ) => {
    setDownloading(type);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/export/${type}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'x-trial-seat': currentUser.role,
        },
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Export failed.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessMsg(`Successfully exported ${filename}`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Could not export file.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Open Source & Zero Cost Architecture Card */}
      <div
        className={`p-6 rounded-xl border space-y-4 ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                100% Open Source
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                $0 / Month Cloud Tier
              </span>
            </div>
            <h3 className="text-base font-bold font-display mt-1">
              Open Source Architecture &amp; Data Portability
            </h3>
            <p className="text-xs text-slate-500">
              Licensed under the permissive <strong>MIT License</strong>. Runs completely within free cloud tiers (PostgreSQL via Cloud SQL / Neon / Supabase, Firebase Authentication, and Google Drive personal archiving). Zero vendor lock-in.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://drive.google.com/drive/my-drive"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open My Google Drive</span>
            </a>
          </div>
        </div>

        {/* Google Drive Workspace Folder Link Manager */}
        <div
          className={`p-4 rounded-lg border space-y-3 ${
            darkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold font-display">
                Sprint Google Drive Study Folder
              </span>
            </div>
            {!editingDriveUrl && (
              <button
                type="button"
                onClick={() => {
                  setTempDriveUrl(driveUrl);
                  setEditingDriveUrl(true);
                }}
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {driveUrl ? 'Change Link' : '+ Attach Drive Folder'}
              </button>
            )}
          </div>

          {editingDriveUrl ? (
            <div className="space-y-2">
              <input
                type="url"
                value={tempDriveUrl}
                onChange={(e) => setTempDriveUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className={`w-full px-3 py-2 rounded-lg border text-xs font-mono ${
                  darkMode
                    ? 'bg-slate-900 border-slate-700 text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDriveUrl(false)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                    darkMode ? 'border-slate-700' : 'border-slate-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDriveUrl}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Save Drive Link
                </button>
              </div>
            </div>
          ) : driveUrl ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono truncate max-w-md text-slate-600 dark:text-slate-400">
                {driveUrl}
              </span>
              <a
                href={driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800 text-xs font-semibold hover:bg-amber-500/20 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Folder in Drive</span>
              </a>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              No shared Google Drive study folder attached yet. Click &quot;Attach Drive Folder&quot; above to link your JEE notes, formula sheets, or scanned PYQ rough sheets.
            </p>
          )}

          <div className="text-[11px] text-slate-500 border-t border-slate-200/60 dark:border-slate-800/80 pt-2 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>
              Tip: You can also attach specific Google Drive file links to individual checklist tasks using each task&apos;s <strong>Resource Link</strong> field.
            </span>
          </div>
        </div>
      </div>

      {/* Backup and Export Downloads Card */}
      <div
        className={`p-6 rounded-xl border space-y-4 ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div>
          <h3 className="text-base font-bold font-display">
            Data Backup &amp; Report Exports
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Export raw data anytime to save in Google Drive or spreadsheet apps. Data is streamed directly from persisted PostgreSQL records.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 text-xs dark:bg-red-950/60 dark:border-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200">
            {successMsg}
          </div>
        )}

        {/* Primary Full JSON Backup Button (Ideal for Google Drive) */}
        <div
          className={`p-5 rounded-xl border-2 border-dashed flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            darkMode
              ? 'border-blue-900/80 bg-blue-950/20'
              : 'border-blue-200 bg-blue-50/50'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Recommended for Google Drive Archival
              </h4>
            </div>
            <div className="text-sm font-bold font-display">
              Complete Sprint Database Backup (Full JSON Snapshot)
            </div>
            <p className="text-xs text-slate-500">
              Contains all 100 chapter tasks, 20 old notes, all daily Hinglish reflections with full immutable version history diffs, date-wise PYQ sessions, and mock test scores.
            </p>
          </div>

          <button
            type="button"
            disabled={downloading !== null}
            onClick={() =>
              handleDownloadExport(
                'full-json',
                `janvi_sprint_full_backup_${new Date().toISOString().slice(0, 10)}.json`
              )
            }
            className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>
              {downloading === 'full-json'
                ? 'Exporting Backup...'
                : 'Download Full JSON Backup'}
            </span>
          </button>
        </div>

        {/* Granular CSV Exports */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <button
            type="button"
            disabled={downloading !== null}
            onClick={() =>
              handleDownloadExport('tasks', 'janvi_sprint_tasks_progress.csv')
            }
            className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
              darkMode
                ? 'bg-slate-950 border-slate-800 hover:border-blue-500'
                : 'bg-slate-50 border-slate-200 hover:border-blue-600'
            }`}
          >
            <Download className="w-4 h-4 text-blue-600 dark:text-blue-400 mb-2" />
            <div className="text-xs font-bold font-display">
              Export Task Progress CSV
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              All 120+ tasks with original vs revised due dates &amp; completion timestamps.
            </p>
          </button>

          <button
            type="button"
            disabled={downloading !== null}
            onClick={() =>
              handleDownloadExport('pyq-sessions', 'janvi_sprint_pyq_sessions.csv')
            }
            className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
              darkMode
                ? 'bg-slate-950 border-slate-800 hover:border-blue-500'
                : 'bg-slate-50 border-slate-200 hover:border-blue-600'
            }`}
          >
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mb-2" />
            <div className="text-xs font-bold font-display">
              Export PYQ Sessions CSV
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Date-wise PYQ practice sessions with attempted, correct &amp; mistake notes.
            </p>
          </button>

          <button
            type="button"
            disabled={downloading !== null}
            onClick={() =>
              handleDownloadExport('reflections', 'janvi_daily_reflections.csv')
            }
            className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
              darkMode
                ? 'bg-slate-950 border-slate-800 hover:border-blue-500'
                : 'bg-slate-50 border-slate-200 hover:border-blue-600'
            }`}
          >
            <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mb-2" />
            <div className="text-xs font-bold font-display">
              Export Daily Reflections CSV
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              All daily Hinglish reflections with dates, status, and edit counts.
            </p>
          </button>

          <button
            type="button"
            disabled={downloading !== null}
            onClick={() =>
              handleDownloadExport(
                'audit-history',
                'janvi_sprint_immutable_audit_history.csv'
              )
            }
            className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
              darkMode
                ? 'bg-slate-950 border-slate-800 hover:border-blue-500'
                : 'bg-slate-50 border-slate-200 hover:border-blue-600'
            }`}
          >
            <Download className="w-4 h-4 text-violet-600 dark:text-violet-400 mb-2" />
            <div className="text-xs font-bold font-display">
              Export Full Audit History CSV
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              All reflection version snapshots, task transitions &amp; PYQ audit logs.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};
