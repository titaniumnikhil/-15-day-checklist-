import React from 'react';
import { DaySummaryItem } from '../types.ts';
import { CheckCircle2, FileText, Clock } from 'lucide-react';

interface DayNavigatorStripProps {
  daysSummary: DaySummaryItem[];
  selectedDate: string;
  currentDateIst: string;
  onSelectDate: (date: string) => void;
  darkMode: boolean;
  compact?: boolean;
}

export const DayNavigatorStrip: React.FC<DayNavigatorStripProps> = ({
  daysSummary,
  selectedDate,
  currentDateIst,
  onSelectDate,
  darkMode,
  compact = false,
}) => {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
        {daysSummary.map((day) => {
          const isSelected = day.date === selectedDate;
          const isToday = day.date === currentDateIst;
          const isComplete =
            day.assignedCount > 0 && day.completedCount === day.assignedCount;
          const isPartial =
            day.completedCount > 0 ||
            day.actualActivity.tasksCompletedCount > 0 ||
            day.reflectionStatus !== 'none';

          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDate(day.date)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600'
                  : isComplete
                  ? darkMode
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300 hover:bg-emerald-900/40'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                  : isPartial
                  ? darkMode
                    ? 'bg-amber-950/30 border-amber-800/70 text-amber-300 hover:bg-amber-900/30'
                    : 'bg-amber-50/70 border-amber-200 text-amber-900 hover:bg-amber-100/70'
                  : darkMode
                  ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="font-mono font-semibold tabular-nums">
                D{day.dayNumber}
              </span>
              <span className="opacity-80">{day.shortLabel}</span>
              {isToday && (
                <span
                  className={`text-[10px] underline ${
                    isSelected ? 'text-white' : 'text-blue-600 dark:text-blue-400'
                  }`}
                >
                  Today
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 gap-3">
      {daysSummary.map((day) => {
        const isSelected = day.date === selectedDate;
        const isToday = day.date === currentDateIst;
        const isFullyCompleted =
          day.assignedCount > 0 && day.completedCount === day.assignedCount;
        const hasActivity =
          day.completedCount > 0 ||
          day.actualActivity.tasksCompletedCount > 0 ||
          day.actualActivity.pyqsAttemptedCount > 0 ||
          day.reflectionStatus !== 'none';

        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelectDate(day.date)}
            className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              isSelected
                ? 'border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/40 dark:bg-blue-950/30 dark:border-blue-500'
                : isFullyCompleted
                ? darkMode
                  ? 'bg-emerald-950/20 border-emerald-800/70 hover:border-emerald-700'
                  : 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300'
                : hasActivity
                ? darkMode
                  ? 'bg-slate-900 border-amber-800/60 hover:border-amber-700'
                  : 'bg-white border-amber-300 hover:border-amber-400'
                : darkMode
                ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold tabular-nums text-blue-600 dark:text-blue-400">
                  Day {day.dayNumber}
                </span>
                <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                  {day.shortLabel}
                </span>
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <div className="font-mono text-lg font-bold tabular-nums">
                  {day.completionPercentage === null
                    ? 'N/A'
                    : `${day.completionPercentage}%`}
                </div>
                <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                  {day.assignedCount === 0
                    ? 'No tasks due'
                    : `${day.completedCount}/${day.assignedCount} done`}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-1.5 w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    isFullyCompleted
                      ? 'bg-emerald-600'
                      : (day.completionPercentage || 0) > 0
                      ? 'bg-blue-600'
                      : 'bg-transparent'
                  }`}
                  style={{ width: `${day.completionPercentage ?? 0}%` }}
                />
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1 text-[11px] text-slate-500">
              <div className="flex items-center justify-between">
                <span>Pending due:</span>
                <span className="font-mono tabular-nums font-medium text-slate-700 dark:text-slate-300">
                  {day.pendingCount}
                </span>
              </div>

              {day.oldNotesTotal > 0 && (
                <div className="flex items-center justify-between">
                  <span>Old notes:</span>
                  <span className="font-mono tabular-nums font-medium text-slate-700 dark:text-slate-300">
                    {day.oldNotesCompleted}/{day.oldNotesTotal}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span>Actual on date:</span>
                <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {day.actualActivity.tasksCompletedCount}t · {day.actualActivity.pyqsAttemptedCount}p
                </span>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  <span>Report:</span>
                </span>
                <span
                  className={`font-medium ${
                    day.reflectionStatus === 'submitted' ||
                    day.reflectionStatus === 'edited_after_submission'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : day.reflectionStatus === 'draft_saved'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-400'
                  }`}
                >
                  {day.reflectionStatus === 'submitted'
                    ? 'Submitted'
                    : day.reflectionStatus === 'edited_after_submission'
                    ? 'Edited'
                    : day.reflectionStatus === 'draft_saved'
                    ? 'Draft'
                    : 'Not saved'}
                </span>
              </div>

              {isToday && (
                <div className="pt-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Current IST Date</span>
                </div>
              )}
              {isFullyCompleted && !isToday && (
                <div className="pt-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Completed Day</span>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
