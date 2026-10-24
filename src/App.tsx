import React, { useState, useEffect, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from './lib/firebase.ts';
import {
  SprintStateResponse,
  StudyTask,
  UserProfile,
} from './types.ts';
import {
  SPRINT_DATES,
  formatIndianDate,
  formatShortIndianDate,
  formatTimestampIst,
  getCurrentDateIst,
  getDayNumberForDate,
  getGreetingIst,
  getSprintStatusLabel,
} from './utils/ist.ts';
import { LoginScreen } from './components/LoginScreen.tsx';
import { DayNavigatorStrip } from './components/DayNavigatorStrip.tsx';
import { ReflectionWorkspace } from './components/ReflectionWorkspace.tsx';
import { ChaptersAndPyqView } from './components/ChaptersAndPyqView.tsx';
import {
  TaskMonitorView,
  AuditHistoryView,
  MockTestsView,
  ExportsView,
} from './components/MentorAdminViews.tsx';
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  Square,
  BookOpen,
  FileText,
  History,
  BarChart3,
  MessageSquare,
  LogOut,
  Sun,
  Moon,
  RefreshCw,
  AlertCircle,
  Clock,
  Award,
  Settings,
  Menu,
  X,
  ArrowRight,
} from 'lucide-react';

type StudentNavKey =
  | 'dashboard'
  | 'plan_15'
  | 'todays_tasks'
  | 'chapters'
  | 'daily_reflection'
  | 'reflection_history'
  | 'my_progress'
  | 'mentor_feedback'
  | 'profile';

type MentorNavKey =
  | 'mentor_overview'
  | 'mentor_plan_15'
  | 'task_monitor'
  | 'chapter_progress'
  | 'daily_reports'
  | 'edit_history'
  | 'pending_overdue'
  | 'mock_tests'
  | 'feedback'
  | 'settings';

const SESSION_TOKEN_KEY = 'titanium_sprint_session_token';
const SESSION_ROLE_KEY = 'titanium_sprint_session_role';
const THEME_STORAGE_KEY = 'titanium_sprint_dark_mode';

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(SESSION_TOKEN_KEY);
    } catch {
      return null;
    }
  });

  const [seatRole, setSeatRole] = useState<'mentor' | 'student'>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_ROLE_KEY);
      return saved === 'mentor' ? 'mentor' : 'student';
    } catch {
      return 'student';
    }
  });

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [sprintState, setSprintState] = useState<SprintStateResponse | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(Boolean(authToken));
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Selected sprint date (defaults to current IST date if inside Oct 25 - Nov 8, otherwise Day 1: 2026-10-25)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = getCurrentDateIst();
    if (today >= '2026-10-25' && today <= '2026-11-08') {
      return today;
    }
    return '2026-10-25';
  });

  const [studentNav, setStudentNav] = useState<StudentNavKey>('dashboard');
  const [mentorNav, setMentorNav] = useState<MentorNavKey>('mentor_overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [reflectionDirty, setReflectionDirty] = useState<boolean>(false);
  const [focusedChapterId, setFocusedChapterId] = useState<number | null>(null);
  const [taskUpdatingId, setTaskUpdatingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, String(darkMode));
    } catch {
      // ignore storage errors
    }
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const fetchSprintState = useCallback(
    async (tokenToUse: string, roleToUse: 'mentor' | 'student', isBackground = false) => {
      if (!isBackground) setLoading(true);
      setSyncing(true);
      setError(null);
      try {
        const res = await fetch('/api/sprint', {
          headers: {
            Authorization: `Bearer ${tokenToUse}`,
            'x-trial-seat': roleToUse,
          },
        });
        if (res.status === 401) {
          handleLogout();
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load study sprint data.');
        }
        setSprintState(data);
        setUserProfile(data.currentUser);
      } catch (err: any) {
        if (!isBackground) {
          setError(err.message || 'Could not connect to server.');
        }
      } finally {
        setLoading(false);
        setSyncing(false);
      }
    },
    []
  );

  // Initial load & periodic cross-device sync
  useEffect(() => {
    if (!authToken) {
      setLoading(false);
      return;
    }
    fetchSprintState(authToken, seatRole, false);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !reflectionDirty) {
        fetchSprintState(authToken, seatRole, true);
      }
    }, 12000);

    const handleFocus = () => {
      if (!reflectionDirty) {
        fetchSprintState(authToken, seatRole, true);
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [authToken, seatRole, fetchSprintState, reflectionDirty]);

  const handleAuthenticated = (
    token: string,
    profile: UserProfile,
    role: 'mentor' | 'student'
  ) => {
    try {
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
      sessionStorage.setItem(SESSION_ROLE_KEY, role);
    } catch {
      // ignore
    }
    setAuthToken(token);
    setSeatRole(role);
    setUserProfile(profile);
    if (role === 'mentor') {
      setMentorNav('mentor_overview');
    } else {
      setStudentNav('dashboard');
    }
  };

  const handleLogout = async () => {
    if (
      reflectionDirty &&
      !window.confirm(
        'You have unsaved reflection text. Are you sure you want to log out?'
      )
    ) {
      return;
    }
    try {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      sessionStorage.removeItem(SESSION_ROLE_KEY);
      await signOut(auth).catch(() => {});
    } catch {
      // ignore
    }
    setAuthToken(null);
    setUserProfile(null);
    setSprintState(null);
    setReflectionDirty(false);
  };

  const safeChangeStudentNav = (next: StudentNavKey) => {
    if (
      reflectionDirty &&
      studentNav === 'daily_reflection' &&
      next !== 'daily_reflection'
    ) {
      if (
        !window.confirm(
          'You have unsaved changes in your Daily Reflection. Leave without saving?'
        )
      ) {
        return;
      }
      setReflectionDirty(false);
    }
    setStudentNav(next);
    setMobileMenuOpen(false);
  };

  const safeChangeMentorNav = (next: MentorNavKey) => {
    if (
      reflectionDirty &&
      mentorNav === 'daily_reports' &&
      next !== 'daily_reports'
    ) {
      if (
        !window.confirm(
          'You have unsaved changes in the report form. Leave without saving?'
        )
      ) {
        return;
      }
      setReflectionDirty(false);
    }
    setMentorNav(next);
    setMobileMenuOpen(false);
  };

  const safeSelectDate = (date: string) => {
    if (reflectionDirty && date !== selectedDate) {
      if (
        !window.confirm(
          'You have unsaved reflection text for the current day. Switch day without saving?'
        )
      ) {
        return;
      }
      setReflectionDirty(false);
    }
    setSelectedDate(date);
  };

  const handleQuickTaskToggle = async (
    task: StudyTask,
    nextStatus: 'not_started' | 'in_progress' | 'completed'
  ) => {
    if (!authToken || !userProfile) return;
    setTaskUpdatingId(task.id);
    setToastMessage(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-trial-seat': userProfile.role,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update task.');
      }
      setSprintState(data.state);
      setToastMessage(
        nextStatus === 'completed'
          ? `Marked "${task.title}" completed.`
          : `Reopened "${task.title}" (${nextStatus === 'in_progress' ? 'In Progress' : 'Not Started'}).`
      );
    } catch (err: any) {
      setToastMessage(`Error: ${err.message}`);
    } finally {
      setTaskUpdatingId(null);
    }
  };

  if (!authToken) {
    return (
      <LoginScreen
        onAuthenticated={handleAuthenticated}
        darkMode={darkMode}
      />
    );
  }

  if (loading && !sprintState) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center p-6 ${
          darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
        }`}
      >
        <div className="max-w-md w-full p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-3">
          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
          <div className="text-sm font-bold font-display">
            Loading Janvi&apos;s 15-Day JEE Sprint...
          </div>
          <p className="text-xs text-slate-500">
            Fetching live tasks, PYQ sessions, and reflection versions from Cloud SQL PostgreSQL.
          </p>
        </div>
      </div>
    );
  }

  if (error && !sprintState) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center p-6 ${
          darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
        }`}
      >
        <div className="max-w-md w-full p-6 rounded-xl border border-red-300 bg-white dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
            <AlertCircle className="w-5 h-5" />
            <span>Database Connection Error</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">{error}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fetchSprintState(authToken, seatRole, false)}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold cursor-pointer"
            >
              Retry Connection
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium cursor-pointer"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!sprintState || !userProfile) return null;

  const isMentor = userProfile.role === 'mentor';
  const currentDaySummary =
    sprintState.daysSummary.find((d) => d.date === selectedDate) ||
    sprintState.daysSummary[0];
  const selectedDayNumber = getDayNumberForDate(selectedDate) || 1;
  const sprintStatus = getSprintStatusLabel(sprintState.currentDateIst);

  // Carry-forward tasks for selectedDate (due before selectedDate and not completed)
  const carryForwardTasksForDay = sprintState.tasks.filter(
    (t) =>
      !t.isArchived &&
      t.dueDate < selectedDate &&
      t.status !== 'completed'
  );

  // Upcoming tasks (due after selectedDate)
  const upcomingTasksForDay = sprintState.tasks
    .filter((t) => !t.isArchived && t.dueDate > selectedDate)
    .slice(0, 8);

  const studentNavItems: {
    key: StudentNavKey;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'plan_15', label: 'My 15-Day Plan', icon: Calendar },
    { key: 'todays_tasks', label: "Today's Tasks", icon: CheckSquare },
    { key: 'chapters', label: 'Chapters & PYQs', icon: BookOpen },
    { key: 'daily_reflection', label: 'Daily Reflection', icon: FileText },
    { key: 'reflection_history', label: 'Reflection History', icon: History },
    { key: 'my_progress', label: 'My Progress', icon: BarChart3 },
    { key: 'mentor_feedback', label: 'Mentor Feedback', icon: MessageSquare },
    { key: 'profile', label: 'Profile / Logout', icon: Settings },
  ];

  const mentorNavItems: {
    key: MentorNavKey;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { key: 'mentor_overview', label: 'Mentor Overview', icon: LayoutDashboard },
    { key: 'mentor_plan_15', label: "Janvi's 15-Day Plan", icon: Calendar },
    { key: 'task_monitor', label: 'Task Monitor', icon: CheckSquare },
    { key: 'chapter_progress', label: 'Chapter Progress', icon: BookOpen },
    { key: 'daily_reports', label: 'Daily Reports', icon: FileText },
    { key: 'edit_history', label: 'Edit History', icon: History },
    {
      key: 'pending_overdue',
      label: 'Pending / Overdue Tasks',
      icon: Clock,
    },
    { key: 'mock_tests', label: 'Mock Tests', icon: Award },
    { key: 'feedback', label: 'Feedback', icon: MessageSquare },
    { key: 'settings', label: 'Settings / Export', icon: Settings },
  ];

  return (
    <div
      className={`min-h-screen flex flex-col md:flex-row ${
        darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r ${
          darkMode
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="text-base font-bold tracking-tight font-display">
            Titanium Study Tracker
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {isMentor
              ? 'Mentor Console · Titanium Nikhil'
              : "Student Workspace · Janvi's Sprint"}
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {isMentor
            ? mentorNavItems.map((item) => {
                const Icon = item.icon;
                const active = mentorNav === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => safeChangeMentorNav(item.key)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-blue-600 text-white'
                        : darkMode
                        ? 'text-slate-300 hover:bg-slate-800'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })
            : studentNavItems.map((item) => {
                const Icon = item.icon;
                const active = studentNav === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => safeChangeStudentNav(item.key)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-blue-600 text-white'
                        : darkMode
                        ? 'text-slate-300 hover:bg-slate-800'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold font-display">
                {userProfile.displayName}
              </div>
              <div className="text-[11px] text-slate-500 capitalize">
                Role: {userProfile.role}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg border cursor-pointer ${
                darkMode
                  ? 'border-slate-700 hover:bg-slate-800'
                  : 'border-slate-200 hover:bg-slate-100'
              }`}
              title="Toggle theme"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className={`w-full py-2 px-3 rounded-lg border font-medium flex items-center justify-center gap-2 cursor-pointer ${
              darkMode
                ? 'border-slate-700 hover:bg-slate-800 text-slate-300'
                : 'border-slate-300 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract (3 Zones) */}
        <header
          className={`sticky top-0 z-20 flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5 border-b ${
            darkMode
              ? 'bg-slate-900/95 border-slate-800 backdrop-blur-xs'
              : 'bg-white/95 border-slate-200 backdrop-blur-xs'
          }`}
        >
          {/* Zone 1: Brand / Active View Title */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-lg border border-slate-300 dark:border-slate-700"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
            <span className="text-sm sm:text-base font-bold font-display whitespace-nowrap">
              {isMentor
                ? 'Mentor Review · Titanium Nikhil'
                : 'Janvi · 15-Day JEE Sprint'}
            </span>
          </div>

          {/* Zone 2: Quick Day 1-15 Switcher */}
          <div className="hidden xl:block flex-1 max-w-2xl overflow-hidden">
            <DayNavigatorStrip
              daysSummary={sprintState.daysSummary}
              selectedDate={selectedDate}
              currentDateIst={sprintState.currentDateIst}
              onSelectDate={safeSelectDate}
              darkMode={darkMode}
              compact
            />
          </div>

          {/* Zone 3: Primary Action (Sync & Night Report CTA) */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => fetchSprintState(authToken, seatRole, true)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                darkMode
                  ? 'border-slate-700 hover:bg-slate-800 text-slate-300'
                  : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
              title="Synchronize with Cloud SQL PostgreSQL"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">
                {syncing ? 'Syncing...' : 'Sync'}
              </span>
            </button>

            {!isMentor ? (
              <button
                type="button"
                onClick={() => safeChangeStudentNav('daily_reflection')}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                Write Night Report
              </button>
            ) : (
              <button
                type="button"
                onClick={() => safeChangeMentorNav('edit_history')}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                Inspect Edit History
              </button>
            )}
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div
            className={`md:hidden border-b p-4 space-y-2 ${
              darkMode
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="grid grid-cols-2 gap-1.5">
              {isMentor
                ? mentorNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => safeChangeMentorNav(item.key)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                          mentorNav === item.key
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })
                : studentNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => safeChangeStudentNav(item.key)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                          studentNav === item.key
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setDarkMode(!darkMode)}
                className="text-xs font-medium flex items-center gap-1.5"
              >
                {darkMode ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
                <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs font-semibold text-red-600 flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}

        {/* Compact Day Strip for smaller screens */}
        <div
          className={`xl:hidden px-4 sm:px-6 py-2.5 border-b ${
            darkMode
              ? 'bg-slate-900/50 border-slate-800'
              : 'bg-slate-100/70 border-slate-200'
          }`}
        >
          <DayNavigatorStrip
            daysSummary={sprintState.daysSummary}
            selectedDate={selectedDate}
            currentDateIst={sprintState.currentDateIst}
            onSelectDate={safeSelectDate}
            darkMode={darkMode}
            compact
          />
        </div>

        {/* Main Viewport Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
          {toastMessage && (
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                toastMessage.startsWith('Error:')
                  ? 'border-red-300 bg-red-50 text-red-900 dark:bg-red-950/50 dark:border-red-800 dark:text-red-200'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200'
              }`}
            >
              <span>{toastMessage}</span>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* STUDENT DASHBOARD EXPERIENCES (JANVI)                          */}
          {/* ============================================================== */}
          {!isMentor && studentNav === 'dashboard' && (
            <div className="space-y-8">
              {/* Top Greeting Header */}
              <div
                className={`p-6 rounded-xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
                    <span>{sprintStatus.badgeText}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Current IST Date:{' '}
                      {formatIndianDate(sprintState.currentDateIst)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Mentor: Titanium Nikhil</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">
                    {getGreetingIst()}, Janvi
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Your JEE 15-Day Sprint · Viewing{' '}
                    <strong>
                      Day {selectedDayNumber} ({formatIndianDate(selectedDate)})
                    </strong>
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => safeChangeStudentNav('todays_tasks')}
                    className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Update Today&apos;s Tasks
                  </button>
                  <button
                    type="button"
                    onClick={() => safeChangeStudentNav('chapters')}
                    className={`px-3.5 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                      darkMode
                        ? 'border-slate-700 hover:bg-slate-800'
                        : 'border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Log PYQs
                  </button>
                  <button
                    type="button"
                    onClick={() => safeChangeStudentNav('daily_reflection')}
                    className={`px-3.5 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                      darkMode
                        ? 'border-slate-700 hover:bg-slate-800'
                        : 'border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Write Night Report
                  </button>
                  <button
                    type="button"
                    onClick={() => safeChangeStudentNav('plan_15')}
                    className={`px-3.5 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                      darkMode
                        ? 'border-slate-700 hover:bg-slate-800'
                        : 'border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Open Any Day
                  </button>
                </div>
              </div>

              {/* 4 Top-Level Statistics Cards + Secondary Metrics */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div
                    className={`p-5 rounded-xl border ${
                      darkMode
                        ? 'bg-slate-900 border-slate-800'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="text-xs text-slate-500">
                      Overall Sprint Progress
                    </div>
                    <div className="text-2xl font-bold font-mono tabular-nums mt-1">
                      {sprintState.metrics.overallProgressPercentage}%
                    </div>
                    <div className="mt-2 w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all"
                        style={{
                          width: `${sprintState.metrics.overallProgressPercentage}%`,
                        }}
                      />
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 font-mono tabular-nums">
                      New Chapters: {sprintState.metrics.newChaptersTaskPercentage}% · Old Notes:{' '}
                      {sprintState.metrics.oldNotesTaskPercentage}%
                    </div>
                  </div>

                  <div
                    className={`p-5 rounded-xl border ${
                      darkMode
                        ? 'bg-slate-900 border-slate-800'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="text-xs text-slate-500">
                      Completed / Assigned Tasks
                    </div>
                    <div className="text-2xl font-bold font-mono tabular-nums mt-1">
                      {sprintState.metrics.completedEligibleTasks} /{' '}
                      {sprintState.metrics.totalEligibleTasks}
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 font-mono tabular-nums">
                      {sprintState.metrics.newChapterTasksCompleted}/
                      {sprintState.metrics.newChapterTasksTotal} chapter tasks +{' '}
                      {sprintState.metrics.oldNotesCompleted}/
                      {sprintState.metrics.oldNotesTotal} short notes
                    </div>
                  </div>

                  <div
                    className={`p-5 rounded-xl border ${
                      darkMode
                        ? 'bg-slate-900 border-slate-800'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="text-xs text-slate-500">
                      Chapters Fully Completed
                    </div>
                    <div className="text-2xl font-bold font-mono tabular-nums mt-1">
                      {sprintState.metrics.fullyCompletedNewChaptersCount} / 10
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500">
                      Requires all 10 checklist tasks per chapter
                    </div>
                  </div>

                  <div
                    className={`p-5 rounded-xl border ${
                      darkMode
                        ? 'bg-slate-900 border-slate-800'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="text-xs text-slate-500">Pending Tasks</div>
                    <div className="text-2xl font-bold font-mono tabular-nums mt-1">
                      {sprintState.metrics.pendingEligibleTasks}
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 font-mono tabular-nums">
                      In Progress: {sprintState.metrics.inProgressEligibleTasks}{' '}
                      · Overdue: {sprintState.metrics.overdueEligibleTasks}
                    </div>
                  </div>
                </div>

                {/* Secondary Metrics Bar */}
                <div
                  className={`px-5 py-3 rounded-xl border flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400 ${
                    darkMode
                      ? 'bg-slate-900/60 border-slate-800'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div>
                    PYQs Attempted:{' '}
                    <strong className="font-mono tabular-nums text-slate-900 dark:text-white">
                      {sprintState.metrics.pyqSummary.totalAttempted} /{' '}
                      {sprintState.metrics.pyqSummary.totalTarget}
                    </strong>{' '}
                    (Accuracy:{' '}
                    <strong className="font-mono tabular-nums text-slate-900 dark:text-white">
                      {sprintState.metrics.pyqSummary
                        .overallAccuracyPercentage === null
                        ? 'Not available'
                        : `${sprintState.metrics.pyqSummary.overallAccuracyPercentage}%`}
                    </strong>
                    )
                  </div>
                  <div>
                    Old-Chapter Short Notes Completed:{' '}
                    <strong className="font-mono tabular-nums text-slate-900 dark:text-white">
                      {sprintState.metrics.oldNotesCompleted} /{' '}
                      {sprintState.metrics.oldNotesTotal}
                    </strong>
                  </div>
                  <div>
                    Days with Submitted Reflections:{' '}
                    <strong className="font-mono tabular-nums text-slate-900 dark:text-white">
                      {sprintState.metrics.submittedReflectionsCount} / 15
                    </strong>
                  </div>
                </div>
              </div>

              {/* 10 Assigned Chapter Targets Grouped by Subject */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold font-display">
                      Assigned 10-Chapter Study Targets
                    </h2>
                    <p className="text-xs text-slate-500">
                      Click any chapter card to open its 10-task checklist and date-wise PYQ session logger.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => safeChangeStudentNav('chapters')}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Open Full Chapters &amp; PYQ Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {(['Physics', 'Chemistry', 'Mathematics'] as const).map(
                  (subj) => {
                    const chList = sprintState.newChapters.filter(
                      (c) => c.subject === subj
                    );
                    const subjAccent =
                      subj === 'Physics'
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : subj === 'Chemistry'
                        ? 'text-teal-600 dark:text-teal-400'
                        : 'text-violet-600 dark:text-violet-400';
                    const subjBar =
                      subj === 'Physics'
                        ? 'bg-indigo-600'
                        : subj === 'Chemistry'
                        ? 'bg-teal-600'
                        : 'bg-violet-600';

                    return (
                      <div key={subj} className="space-y-2.5">
                        <div className="text-xs font-bold font-display uppercase tracking-wider text-slate-500">
                          {subj} ({chList.length} Chapters)
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {chList.map((ch) => (
                            <div
                              key={ch.id}
                              onClick={() => {
                                setFocusedChapterId(ch.id);
                                safeChangeStudentNav('chapters');
                              }}
                              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                                darkMode
                                  ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                  <span className={`font-semibold ${subjAccent}`}>
                                    {ch.subject}
                                  </span>
                                  <span className="font-mono tabular-nums">
                                    {formatShortIndianDate(ch.targetStartDate)}–
                                    {formatShortIndianDate(ch.targetEndDate)}
                                  </span>
                                </div>

                                <div className="text-sm font-bold font-display leading-snug">
                                  {ch.chapterOrder}. {ch.chapterName}
                                </div>

                                <div className="flex items-center justify-between text-xs pt-1">
                                  <span className="text-slate-500">
                                    Completion
                                  </span>
                                  <span className="font-mono font-bold tabular-nums">
                                    {ch.completionPercentage}% ({ch.completedTasks}
                                    /{ch.totalTasks})
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                  <div
                                    className={`h-full ${subjBar}`}
                                    style={{
                                      width: `${ch.completionPercentage}%`,
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 space-y-1 text-[11px] text-slate-500">
                                <div className="flex items-center justify-between">
                                  <span>One-Shot: {ch.oneShotStatus}</span>
                                  <span>Notes: {ch.shortNotesStatus}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>Revision: {ch.revisionStatus}</span>
                                  <span className="font-mono tabular-nums">
                                    PYQs: {ch.pyqSummary.attemptedCount}/
                                    {ch.pyqSummary.targetCount} (
                                    {ch.pyqSummary.progressPercentage}%)
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] pt-0.5">
                                  <span>
                                    Pending: {ch.pendingTasks} tasks
                                  </span>
                                  <span>
                                    {ch.status === 'completed'
                                      ? 'Completed'
                                      : ch.status === 'in_progress'
                                      ? 'In Progress'
                                      : 'Not Started'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              {/* Today Section: Scheduled Tasks, Carry-Forward, and Old Short Notes */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left 7 Cols: Today's Assigned Tasks & Carry-Forward */}
                <div
                  className={`lg:col-span-7 p-5 rounded-xl border space-y-5 ${
                    darkMode
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="text-base font-bold font-display">
                        Day {selectedDayNumber} ({formatIndianDate(selectedDate)}) — Tasks Due Today
                      </h3>
                      <p className="text-xs text-slate-500">
                        Planned Completion:{' '}
                        <strong className="font-mono tabular-nums">
                          {currentDaySummary.completionPercentage === null
                            ? 'No assigned tasks'
                            : `${currentDaySummary.completionPercentage}% (${currentDaySummary.completedCount}/${currentDaySummary.assignedCount})`}
                        </strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => safeChangeStudentNav('todays_tasks')}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 underline cursor-pointer"
                    >
                      Full Day View
                    </button>
                  </div>

                  <div className="space-y-2">
                    {currentDaySummary.plannedTasksDue.length === 0 ? (
                      <div className="py-4 text-xs text-slate-500">
                        No tasks scheduled with a due date on this day.
                      </div>
                    ) : (
                      currentDaySummary.plannedTasksDue.map((task) => {
                        const isDone = task.status === 'completed';
                        return (
                          <div
                            key={task.id}
                            className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                              darkMode
                                ? 'bg-slate-950/60 border-slate-800'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <button
                                type="button"
                                disabled={taskUpdatingId === task.id}
                                onClick={() =>
                                  handleQuickTaskToggle(
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
                                  className={`text-xs font-semibold ${
                                    isDone ? 'line-through text-slate-400' : ''
                                  }`}
                                >
                                  {task.title}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {task.subject} · {task.chapterName} ·{' '}
                                  {task.taskType}
                                </div>
                              </div>
                            </div>

                            <select
                              value={task.status}
                              disabled={taskUpdatingId === task.id}
                              onChange={(e) =>
                                handleQuickTaskToggle(
                                  task,
                                  e.target.value as
                                    | 'not_started'
                                    | 'in_progress'
                                    | 'completed'
                                )
                              }
                              className={`px-2 py-1 rounded border text-[11px] font-medium ${
                                darkMode
                                  ? 'bg-slate-900 border-slate-700'
                                  : 'bg-white border-slate-300'
                              }`}
                            >
                              <option value="not_started">Not Started</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                            </select>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Carry-Forward Pending Tasks from Earlier Days */}
                  {carryForwardTasksForDay.length > 0 && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-display text-amber-600 dark:text-amber-400">
                          Carry-Forward Pending Tasks from Previous Days (
                          {carryForwardTasksForDay.length})
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Single underlying record · Never double-counted
                        </span>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {carryForwardTasksForDay.map((task) => (
                          <div
                            key={task.id}
                            className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                              darkMode
                                ? 'bg-amber-950/20 border-amber-800/60'
                                : 'bg-amber-50/60 border-amber-200'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <button
                                type="button"
                                disabled={taskUpdatingId === task.id}
                                onClick={() =>
                                  handleQuickTaskToggle(task, 'completed')
                                }
                                className="mt-0.5 cursor-pointer"
                              >
                                <Square className="w-4 h-4 text-amber-600" />
                              </button>
                              <div>
                                <div className="text-xs font-semibold">
                                  {task.title}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  {task.chapterName} · Original Due:{' '}
                                  {formatShortIndianDate(task.dueDate)}
                                </div>
                              </div>
                            </div>
                            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                              Carry Forward
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right 5 Cols: Today's Old Short Notes + Quick Reflection Link */}
                <div className="lg:col-span-5 space-y-6">
                  <div
                    className={`p-5 rounded-xl border space-y-4 ${
                      darkMode
                        ? 'bg-slate-900 border-slate-800'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                      <div>
                        <h3 className="text-base font-bold font-display">
                          Day {selectedDayNumber} Old-Chapter Short Notes
                        </h3>
                        <p className="text-xs text-slate-500">
                          {currentDaySummary.oldNotesTotal > 0
                            ? `${currentDaySummary.oldNotesCompleted} out of ${currentDaySummary.oldNotesTotal} completed (${currentDaySummary.oldNotesPercentage}%)`
                            : 'Scheduled on Days 1–5 (25–29 Oct)'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => safeChangeStudentNav('chapters')}
                        className="text-xs text-blue-600 dark:text-blue-400 underline cursor-pointer"
                      >
                        All 20 Notes
                      </button>
                    </div>

                    {currentDaySummary.oldNotes.length === 0 ? (
                      <p className="text-xs text-slate-500 py-2">
                        No new old-chapter short notes assigned on Day{' '}
                        {selectedDayNumber}. (Days 1–5 cover all 20 revision chapters).
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {currentDaySummary.oldNotes.map((note) => {
                          if (!note.task) return null;
                          const isDone = note.status === 'completed';
                          return (
                            <div
                              key={note.id}
                              className={`p-3 rounded-lg border flex items-center justify-between gap-2 ${
                                darkMode
                                  ? 'bg-slate-950/60 border-slate-800'
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <button
                                  type="button"
                                  disabled={taskUpdatingId === note.task.id}
                                  onClick={() =>
                                    handleQuickTaskToggle(
                                      note.task!,
                                      isDone ? 'not_started' : 'completed'
                                    )
                                  }
                                  className="cursor-pointer"
                                >
                                  {isDone ? (
                                    <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-400" />
                                  )}
                                </button>
                                <div>
                                  <div
                                    className={`text-xs font-semibold ${
                                      isDone ? 'line-through text-slate-400' : ''
                                    }`}
                                  >
                                    {note.chapterName}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {note.subject}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[11px] font-mono text-slate-500">
                                {isDone ? 'Done' : 'Pending'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Night Reflection Summary Card */}
                  <div
                    className={`p-5 rounded-xl border space-y-3 ${
                      darkMode
                        ? 'bg-slate-900 border-slate-800'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold font-display">
                        Day {selectedDayNumber} Night Reflection
                      </h3>
                      <span className="text-xs font-mono text-slate-500">
                        {currentDaySummary.reflectionStatus === 'none'
                          ? 'Not submitted'
                          : currentDaySummary.reflectionStatus === 'draft_saved'
                          ? 'Draft saved'
                          : 'Submitted'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Answer the 4 daily Hinglish accountability questions (Aaj kya kiya? Kal kya karna hai? Aaj ka regret kya raha? Aaj kya achieve kiya?).
                    </p>
                    <button
                      type="button"
                      onClick={() => safeChangeStudentNav('daily_reflection')}
                      className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      {currentDaySummary.reflection
                        ? `Open / Edit Day ${selectedDayNumber} Reflection (v${currentDaySummary.reflection.currentVersion})`
                        : `Write Day ${selectedDayNumber} Reflection`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STUDENT: MY 15-DAY PLAN */}
          {!isMentor && studentNav === 'plan_15' && (
            <div className="space-y-6">
              <div
                className={`p-5 rounded-xl border ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <h2 className="text-lg font-bold font-display">
                  My 15-Day JEE Preparation Plan (25 Oct – 8 Nov 2026)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Click any day card to inspect its scheduled tasks, old-chapter short notes, actual work performed on that date, and daily reflection.
                </p>
              </div>

              <DayNavigatorStrip
                daysSummary={sprintState.daysSummary}
                selectedDate={selectedDate}
                currentDateIst={sprintState.currentDateIst}
                onSelectDate={(d) => {
                  safeSelectDate(d);
                  safeChangeStudentNav('todays_tasks');
                }}
                darkMode={darkMode}
              />
            </div>
          )}

          {/* STUDENT: TODAY'S TASKS (SELECTED DAY WORKSPACE) */}
          {!isMentor && studentNav === 'todays_tasks' && (
            <div className="space-y-6">
              <div
                className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div>
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                    Day {selectedDayNumber} of 15 · Planned vs Actual Execution
                  </div>
                  <h2 className="text-xl font-bold font-display">
                    {formatIndianDate(selectedDate)} — Study Tasks &amp; Carry-Forward
                  </h2>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                  <span>
                    Planned Completion:{' '}
                    <strong>
                      {currentDaySummary.completionPercentage === null
                        ? 'N/A'
                        : `${currentDaySummary.completionPercentage}%`}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Actual Completed on Date:{' '}
                    <strong>
                      {currentDaySummary.actualActivity.tasksCompletedCount}{' '}
                      tasks
                    </strong>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-6">
                  {/* Today's Original / Scheduled Due Assignments */}
                  <div
                    className={`p-5 rounded-xl border space-y-3 ${
                      darkMode
                        ? 'bg-slate-900 border-slate-800'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <h3 className="text-sm font-bold font-display">
                      Tasks Due on {formatIndianDate(selectedDate)} (
                      {currentDaySummary.completedCount} /{' '}
                      {currentDaySummary.assignedCount})
                    </h3>
                    {currentDaySummary.plannedTasksDue.map((task) => {
                      const isDone = task.status === 'completed';
                      return (
                        <div
                          key={task.id}
                          className={`p-3.5 rounded-lg border flex items-center justify-between gap-3 ${
                            darkMode
                              ? 'bg-slate-950/60 border-slate-800'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              disabled={taskUpdatingId === task.id}
                              onClick={() =>
                                handleQuickTaskToggle(
                                  task,
                                  isDone ? 'not_started' : 'completed'
                                )
                              }
                              className="mt-0.5 cursor-pointer"
                            >
                              {isDone ? (
                                <CheckSquare className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-400" />
                              )}
                            </button>
                            <div>
                              <div
                                className={`text-sm font-semibold ${
                                  isDone ? 'line-through text-slate-400' : ''
                                }`}
                              >
                                {task.title}
                              </div>
                              <div className="text-xs text-slate-500">
                                {task.subject} · {task.chapterName} ·{' '}
                                {task.taskType}
                              </div>
                            </div>
                          </div>

                          <select
                            value={task.status}
                            onChange={(e) =>
                              handleQuickTaskToggle(
                                task,
                                e.target.value as
                                  | 'not_started'
                                  | 'in_progress'
                                  | 'completed'
                              )
                            }
                            className={`px-2.5 py-1 rounded border text-xs font-medium ${
                              darkMode
                                ? 'bg-slate-900 border-slate-700'
                                : 'bg-white border-slate-300'
                            }`}
                          >
                            <option value="not_started">Not Started</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>

                  {/* Multi-Day Active Tasks Spanning Today */}
                  {currentDaySummary.activeSpanTasks.length > 0 && (
                    <div
                      className={`p-5 rounded-xl border space-y-3 ${
                        darkMode
                          ? 'bg-slate-900 border-slate-800'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <h3 className="text-sm font-bold font-display">
                        Multi-Day Chapter Tasks Active Today (Due Later in Window)
                      </h3>
                      <div className="space-y-2">
                        {currentDaySummary.activeSpanTasks.map((task) => {
                          const isDone = task.status === 'completed';
                          return (
                            <div
                              key={task.id}
                              className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                                darkMode
                                  ? 'bg-slate-950/50 border-slate-800'
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleQuickTaskToggle(
                                      task,
                                      isDone ? 'not_started' : 'completed'
                                    )
                                  }
                                  className="mt-0.5 cursor-pointer"
                                >
                                  {isDone ? (
                                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-400" />
                                  )}
                                </button>
                                <div>
                                  <div className="text-xs font-semibold">
                                    {task.title}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {task.chapterName} · Due:{' '}
                                    {formatShortIndianDate(task.dueDate)}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[11px] font-mono text-slate-500">
                                {task.status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right 5 Cols: Carry-Forward, Actual Activity on Date & Upcoming */}
                <div className="lg:col-span-5 space-y-6">
                  <div
                    className={`p-5 rounded-xl border space-y-3 ${
                      darkMode
                        ? 'bg-slate-900 border-slate-800'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <h3 className="text-sm font-bold font-display text-amber-600 dark:text-amber-400">
                      Previous Pending Work (Carry-Forward:{' '}
                      {carryForwardTasksForDay.length})
                    </h3>
                    {carryForwardTasksForDay.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Zero carry-forward backlog from earlier days!
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {carryForwardTasksForDay.map((task) => (
                          <div
                            key={task.id}
                            className={`p-3 rounded-lg border flex items-center justify-between gap-2 ${
                              darkMode
                                ? 'bg-amber-950/20 border-amber-800/60'
                                : 'bg-amber-50 border-amber-200'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleQuickTaskToggle(task, 'completed')
                                }
                                className="mt-0.5 cursor-pointer"
                              >
                                <Square className="w-4 h-4 text-amber-600" />
                              </button>
                              <div>
                                <div className="text-xs font-semibold">
                                  {task.title}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {task.chapterName} · Due{' '}
                                  {formatShortIndianDate(task.dueDate)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actual Activity Performed on Selected Date */}
                  <div
                    className={`p-5 rounded-xl border space-y-3 ${
                      darkMode
                        ? 'bg-slate-900 border-slate-800'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <h3 className="text-sm font-bold font-display">
                      Actual Activity Recorded on {formatShortIndianDate(selectedDate)}
                    </h3>
                    <div className="text-xs text-slate-500 space-y-1 font-mono tabular-nums">
                      <div>
                        Tasks Completed on This Date:{' '}
                        <strong>
                          {
                            currentDaySummary.actualActivity
                              .tasksCompletedCount
                          }
                        </strong>
                      </div>
                      <div>
                        PYQ Sessions Practiced on This Date:{' '}
                        <strong>
                          {currentDaySummary.actualActivity.pyqSessionsCount} (
                          {currentDaySummary.actualActivity.pyqsAttemptedCount}{' '}
                          PYQs)
                        </strong>
                      </div>
                      <div>
                        Audit Events Logged on This Date:{' '}
                        <strong>
                          {currentDaySummary.actualActivity.auditEventsCount}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Upcoming Assignments Preview */}
                  <div
                    className={`p-5 rounded-xl border space-y-3 ${
                      darkMode
                        ? 'bg-slate-900 border-slate-800'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <h3 className="text-sm font-bold font-display">
                      Upcoming Assignments
                    </h3>
                    <div className="space-y-2">
                      {upcomingTasksForDay.map((t) => (
                        <div
                          key={t.id}
                          className="text-xs flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800 last:border-0"
                        >
                          <span className="truncate pr-2">
                            {t.chapterName}: {t.title}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500 shrink-0">
                            {formatShortIndianDate(t.dueDate)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STUDENT: CHAPTERS & PYQs */}
          {!isMentor && studentNav === 'chapters' && (
            <ChaptersAndPyqView
              newChapters={sprintState.newChapters}
              oldShortNotes={sprintState.oldShortNotes}
              currentUser={userProfile}
              authToken={authToken}
              selectedDate={selectedDate}
              onStateUpdated={setSprintState}
              darkMode={darkMode}
              initialSelectedChapterId={focusedChapterId}
            />
          )}

          {/* STUDENT: DAILY REFLECTION */}
          {!isMentor && studentNav === 'daily_reflection' && (
            <ReflectionWorkspace
              selectedDate={selectedDate}
              daysSummary={sprintState.daysSummary}
              reflections={sprintState.reflections}
              mentorFeedback={sprintState.mentorFeedback}
              currentUser={userProfile}
              authToken={authToken}
              onSelectDate={safeSelectDate}
              onStateUpdated={setSprintState}
              onDirtyChange={setReflectionDirty}
              darkMode={darkMode}
            />
          )}

          {/* STUDENT: REFLECTION HISTORY */}
          {!isMentor && studentNav === 'reflection_history' && (
            <ReflectionWorkspace
              selectedDate={selectedDate}
              daysSummary={sprintState.daysSummary}
              reflections={sprintState.reflections}
              mentorFeedback={sprintState.mentorFeedback}
              currentUser={userProfile}
              authToken={authToken}
              onSelectDate={safeSelectDate}
              onStateUpdated={setSprintState}
              onDirtyChange={setReflectionDirty}
              darkMode={darkMode}
              historyOnlyMode
            />
          )}

          {/* STUDENT: MY PROGRESS & ANALYTICS */}
          {!isMentor && studentNav === 'my_progress' && (
            <div className="space-y-6">
              <div
                className={`p-6 rounded-xl border space-y-5 ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold font-display">
                      Overall Sprint Completion &amp; Subject Analytics
                    </h2>
                    <p className="text-xs text-slate-500">
                      Calculated live from persisted PostgreSQL task states.
                    </p>
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
                    {sprintState.metrics.overallProgressPercentage}%
                  </div>
                </div>

                <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all"
                    style={{
                      width: `${sprintState.metrics.overallProgressPercentage}%`,
                    }}
                  />
                </div>

                {/* Subject Progress Bars */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {sprintState.subjectProgress.map((sp) => (
                    <div
                      key={sp.subject}
                      className={`p-4 rounded-xl border space-y-2 ${
                        darkMode
                          ? 'bg-slate-950/60 border-slate-800'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold font-display">
                          {sp.subject}
                        </span>
                        <span className="font-mono font-bold tabular-nums">
                          {sp.percentage}% ({sp.completedTasks}/{sp.totalTasks})
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full ${
                            sp.subject === 'Physics'
                              ? 'bg-indigo-600'
                              : sp.subject === 'Chemistry'
                              ? 'bg-teal-600'
                              : 'bg-violet-600'
                          }`}
                          style={{ width: `${sp.percentage}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Chapters Completed: {sp.completedNewChapters} /{' '}
                        {sp.totalNewChapters}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chapter Progress Chart */}
              <div
                className={`p-6 rounded-xl border space-y-4 ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <h3 className="text-base font-bold font-display">
                  10-Chapter Completion &amp; PYQ Accuracy Breakdown
                </h3>
                <div className="space-y-3">
                  {sprintState.newChapters.map((ch) => (
                    <div key={ch.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">
                          {ch.chapterOrder}. {ch.chapterName} ({ch.subject})
                        </span>
                        <span className="font-mono tabular-nums text-slate-500">
                          Tasks: <strong>{ch.completionPercentage}%</strong> ·
                          PYQs:{' '}
                          <strong>
                            {ch.pyqSummary.attemptedCount}/
                            {ch.pyqSummary.targetCount}
                          </strong>{' '}
                          (Acc:{' '}
                          {ch.pyqSummary.accuracyPercentage === null
                            ? 'N/A'
                            : `${ch.pyqSummary.accuracyPercentage}%`}
                          )
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-blue-600"
                          style={{ width: `${ch.completionPercentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <MockTestsView
                sprintState={sprintState}
                currentUser={userProfile}
                authToken={authToken}
                onStateUpdated={setSprintState}
                darkMode={darkMode}
              />
            </div>
          )}

          {/* STUDENT: MENTOR FEEDBACK */}
          {!isMentor && studentNav === 'mentor_feedback' && (
            <div className="space-y-6">
              <div
                className={`p-5 rounded-xl border ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <h2 className="text-lg font-bold font-display">
                  Mentor Feedback from Titanium Nikhil
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  All daily report comments and guidance recorded by your mentor.
                </p>
              </div>

              {sprintState.mentorFeedback.length === 0 ? (
                <div
                  className={`p-8 rounded-xl border text-center text-xs text-slate-500 ${
                    darkMode
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  No mentor feedback has been posted yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {sprintState.mentorFeedback.map((fb) => (
                    <div
                      key={fb.id}
                      className={`p-5 rounded-xl border space-y-2 ${
                        darkMode
                          ? 'bg-slate-900 border-slate-800'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {fb.mentorName} · Day{' '}
                          {getDayNumberForDate(fb.reflectionDate) || '—'} (
                          {formatIndianDate(fb.reflectionDate)})
                        </span>
                        <span className="font-mono tabular-nums">
                          v{fb.versionNumber} · {formatTimestampIst(fb.updatedAt)}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {fb.feedbackText}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STUDENT: PROFILE / LOGOUT */}
          {!isMentor && studentNav === 'profile' && (
            <div className="space-y-6">
              <div
                className={`p-6 rounded-xl border space-y-4 max-w-xl ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <h2 className="text-lg font-bold font-display">
                  Student Profile &amp; Session
                </h2>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500">Display Name</span>
                    <span className="font-semibold">{userProfile.displayName}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500">Assigned Role</span>
                    <span className="font-mono uppercase">{userProfile.role}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500">Linked Mentor</span>
                    <span className="font-semibold">Titanium Nikhil</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500">Sprint Period</span>
                    <span className="font-mono">25 Oct 2026 – 8 Nov 2026</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Log Out of Student Session
                </button>
              </div>

              {/* Data Portability & Google Drive Hub */}
              <ExportsView
                authToken={authToken || ''}
                currentUser={userProfile}
                darkMode={darkMode}
              />
            </div>
          )}

          {/* ============================================================== */}
          {/* MENTOR DASHBOARD EXPERIENCES (TITANIUM NIKHIL)                 */}
          {/* ============================================================== */}
          {isMentor && mentorNav === 'mentor_overview' && (
            <div className="space-y-8">
              {/* Mentor Header */}
              <div
                className={`p-6 rounded-xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="space-y-1">
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    Mentor Console · Titanium Nikhil · Asia/Kolkata (IST)
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold font-display">
                    Janvi&apos;s 15-Day JEE Sprint Overview
                  </h1>
                  <p className="text-xs text-slate-500">
                    Original Fixed Baseline: 25 Oct – 8 Nov 2026 · Mock Test: 9 Nov 2026 · Last Server Sync:{' '}
                    {formatTimestampIst(sprintState.serverTimestampUtc)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => safeChangeMentorNav('task_monitor')}
                    className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Assign / Reschedule Tasks
                  </button>
                  <button
                    type="button"
                    onClick={() => safeChangeMentorNav('edit_history')}
                    className={`px-3.5 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                      darkMode
                        ? 'border-slate-700 hover:bg-slate-800'
                        : 'border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Audit &amp; Reflection Diffs
                  </button>
                  <button
                    type="button"
                    onClick={() => safeChangeMentorNav('settings')}
                    className={`px-3.5 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                      darkMode
                        ? 'border-slate-700 hover:bg-slate-800'
                        : 'border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Export CSVs
                  </button>
                </div>
              </div>

              {/* Mentor KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div
                  className={`p-4 rounded-xl border ${
                    darkMode
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="text-xs text-slate-500">Overall Sprint</div>
                  <div className="text-xl font-bold font-mono tabular-nums mt-1">
                    {sprintState.metrics.overallProgressPercentage}%
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">
                    {sprintState.metrics.completedEligibleTasks}/
                    {sprintState.metrics.totalEligibleTasks} tasks
                  </div>
                </div>

                <div
                  className={`p-4 rounded-xl border ${
                    darkMode
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="text-xs text-slate-500">New Chapters</div>
                  <div className="text-xl font-bold font-mono tabular-nums mt-1">
                    {sprintState.metrics.fullyCompletedNewChaptersCount} / 10
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">
                    {sprintState.metrics.newChaptersTaskPercentage}% tasks done
                  </div>
                </div>

                <div
                  className={`p-4 rounded-xl border ${
                    darkMode
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="text-xs text-slate-500">Old Short Notes</div>
                  <div className="text-xl font-bold font-mono tabular-nums mt-1">
                    {sprintState.metrics.oldNotesCompleted} /{' '}
                    {sprintState.metrics.oldNotesTotal}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">
                    {sprintState.metrics.oldNotesTaskPercentage}% completed
                  </div>
                </div>

                <div
                  className={`p-4 rounded-xl border ${
                    darkMode
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="text-xs text-slate-500">Pending / Overdue</div>
                  <div className="text-xl font-bold font-mono tabular-nums mt-1">
                    {sprintState.metrics.pendingEligibleTasks} /{' '}
                    <span className="text-red-600 dark:text-red-400">
                      {sprintState.metrics.overdueEligibleTasks}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">
                    Rescheduled: {sprintState.metrics.rescheduledEligibleTasks}
                  </div>
                </div>

                <div
                  className={`p-4 rounded-xl border ${
                    darkMode
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="text-xs text-slate-500">PYQs Logged</div>
                  <div className="text-xl font-bold font-mono tabular-nums mt-1">
                    {sprintState.metrics.pyqSummary.totalAttempted} /{' '}
                    {sprintState.metrics.pyqSummary.totalTarget}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">
                    Acc:{' '}
                    {sprintState.metrics.pyqSummary
                      .overallAccuracyPercentage === null
                      ? 'N/A'
                      : `${sprintState.metrics.pyqSummary.overallAccuracyPercentage}%`}
                  </div>
                </div>

                <div
                  className={`p-4 rounded-xl border ${
                    darkMode
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="text-xs text-slate-500">Night Reports</div>
                  <div className="text-xl font-bold font-mono tabular-nums mt-1">
                    {sprintState.metrics.submittedReflectionsCount} / 15
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">
                    Drafts: {sprintState.metrics.draftReflectionsCount}
                  </div>
                </div>
              </div>

              {/* Section A: 15-Day Grid (Planned-Day vs Actual-Date Activity) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold font-display">
                    A. Day-Wise Progress Grid (Planned Schedule vs Actual Daily Execution)
                  </h2>
                  <span className="text-xs text-slate-500">
                    Click any day to inspect its report and tasks
                  </span>
                </div>
                <DayNavigatorStrip
                  daysSummary={sprintState.daysSummary}
                  selectedDate={selectedDate}
                  currentDateIst={sprintState.currentDateIst}
                  onSelectDate={(d) => {
                    safeSelectDate(d);
                    safeChangeMentorNav('daily_reports');
                  }}
                  darkMode={darkMode}
                />
              </div>

              {/* Section B: Chapter-Wise Progress Table */}
              <div
                className={`p-6 rounded-xl border space-y-4 ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold font-display">
                    B. Chapter-Wise Progress Monitor (10 Target Chapters)
                  </h2>
                  <button
                    type="button"
                    onClick={() => safeChangeMentorNav('chapter_progress')}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 underline cursor-pointer"
                  >
                    Open Interactive Chapter Manager
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-2.5 pr-4">Chapter</th>
                        <th className="py-2.5 px-3">Subject</th>
                        <th className="py-2.5 px-3">Target Window</th>
                        <th className="py-2.5 px-3 text-right">Tasks</th>
                        <th className="py-2.5 px-3 text-right">Progress</th>
                        <th className="py-2.5 px-3">One-Shot</th>
                        <th className="py-2.5 px-3 text-right">PYQs</th>
                        <th className="py-2.5 px-3">Notes / Rev</th>
                        <th className="py-2.5 pl-3 text-right">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {sprintState.newChapters.map((ch) => (
                        <tr
                          key={ch.id}
                          onClick={() => {
                            setFocusedChapterId(ch.id);
                            safeChangeMentorNav('chapter_progress');
                          }}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                        >
                          <td className="py-3 pr-4 font-bold font-display">
                            {ch.chapterOrder}. {ch.chapterName}
                          </td>
                          <td className="py-3 px-3">{ch.subject}</td>
                          <td className="py-3 px-3 font-mono tabular-nums text-slate-500">
                            {formatShortIndianDate(ch.targetStartDate)} –{' '}
                            {formatShortIndianDate(ch.targetEndDate)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums">
                            {ch.completedTasks} / {ch.totalTasks}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold tabular-nums">
                            {ch.completionPercentage}%
                          </td>
                          <td className="py-3 px-3">{ch.oneShotStatus}</td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums">
                            {ch.pyqSummary.attemptedCount}/
                            {ch.pyqSummary.targetCount} (
                            {ch.pyqSummary.accuracyPercentage === null
                              ? '—'
                              : `${ch.pyqSummary.accuracyPercentage}%`}
                            )
                          </td>
                          <td className="py-3 px-3">
                            {ch.shortNotesStatus} / {ch.revisionStatus}
                          </td>
                          <td className="py-3 pl-3 text-right font-mono tabular-nums text-slate-500">
                            {formatTimestampIst(ch.updatedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MENTOR: JANVI'S 15-DAY PLAN */}
          {isMentor && mentorNav === 'mentor_plan_15' && (
            <div className="space-y-6">
              <div
                className={`p-5 rounded-xl border ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <h2 className="text-lg font-bold font-display">
                  Janvi&apos;s 15-Day Sprint Schedule &amp; Daily Execution Inspector
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Compare scheduled due tasks on each day with the actual tasks and PYQ sessions Janvi completed on that calendar date.
                </p>
              </div>

              <DayNavigatorStrip
                daysSummary={sprintState.daysSummary}
                selectedDate={selectedDate}
                currentDateIst={sprintState.currentDateIst}
                onSelectDate={safeSelectDate}
                darkMode={darkMode}
              />

              <ReflectionWorkspace
                selectedDate={selectedDate}
                daysSummary={sprintState.daysSummary}
                reflections={sprintState.reflections}
                mentorFeedback={sprintState.mentorFeedback}
                currentUser={userProfile}
                authToken={authToken}
                onSelectDate={safeSelectDate}
                onStateUpdated={setSprintState}
                onDirtyChange={setReflectionDirty}
                darkMode={darkMode}
              />
            </div>
          )}

          {/* MENTOR: TASK MONITOR */}
          {isMentor && mentorNav === 'task_monitor' && (
            <TaskMonitorView
              sprintState={sprintState}
              currentUser={userProfile}
              authToken={authToken}
              onStateUpdated={setSprintState}
              darkMode={darkMode}
            />
          )}

          {/* MENTOR: CHAPTER PROGRESS */}
          {isMentor && mentorNav === 'chapter_progress' && (
            <ChaptersAndPyqView
              newChapters={sprintState.newChapters}
              oldShortNotes={sprintState.oldShortNotes}
              currentUser={userProfile}
              authToken={authToken}
              selectedDate={selectedDate}
              onStateUpdated={setSprintState}
              darkMode={darkMode}
              initialSelectedChapterId={focusedChapterId}
            />
          )}

          {/* MENTOR: DAILY REPORTS */}
          {isMentor && mentorNav === 'daily_reports' && (
            <ReflectionWorkspace
              selectedDate={selectedDate}
              daysSummary={sprintState.daysSummary}
              reflections={sprintState.reflections}
              mentorFeedback={sprintState.mentorFeedback}
              currentUser={userProfile}
              authToken={authToken}
              onSelectDate={safeSelectDate}
              onStateUpdated={setSprintState}
              onDirtyChange={setReflectionDirty}
              darkMode={darkMode}
            />
          )}

          {/* MENTOR: EDIT HISTORY (IMMUTABLE REFLECTION DIFFS + TASK & PYQ AUDIT LOGS) */}
          {isMentor && mentorNav === 'edit_history' && (
            <div className="space-y-8">
              <ReflectionWorkspace
                selectedDate={selectedDate}
                daysSummary={sprintState.daysSummary}
                reflections={sprintState.reflections}
                mentorFeedback={sprintState.mentorFeedback}
                currentUser={userProfile}
                authToken={authToken}
                onSelectDate={safeSelectDate}
                onStateUpdated={setSprintState}
                onDirtyChange={setReflectionDirty}
                darkMode={darkMode}
                historyOnlyMode
              />

              <AuditHistoryView
                sprintState={sprintState}
                darkMode={darkMode}
              />
            </div>
          )}

          {/* MENTOR: PENDING / OVERDUE TASKS */}
          {isMentor && mentorNav === 'pending_overdue' && (
            <TaskMonitorView
              sprintState={sprintState}
              currentUser={userProfile}
              authToken={authToken}
              onStateUpdated={setSprintState}
              darkMode={darkMode}
              overdueOnly
            />
          )}

          {/* MENTOR: MOCK TESTS */}
          {isMentor && mentorNav === 'mock_tests' && (
            <MockTestsView
              sprintState={sprintState}
              currentUser={userProfile}
              authToken={authToken}
              onStateUpdated={setSprintState}
              darkMode={darkMode}
            />
          )}

          {/* MENTOR: FEEDBACK */}
          {isMentor && mentorNav === 'feedback' && (
            <ReflectionWorkspace
              selectedDate={selectedDate}
              daysSummary={sprintState.daysSummary}
              reflections={sprintState.reflections}
              mentorFeedback={sprintState.mentorFeedback}
              currentUser={userProfile}
              authToken={authToken}
              onSelectDate={safeSelectDate}
              onStateUpdated={setSprintState}
              onDirtyChange={setReflectionDirty}
              darkMode={darkMode}
              historyOnlyMode
            />
          )}

          {/* MENTOR: SETTINGS / EXPORT / LOGOUT */}
          {isMentor && mentorNav === 'settings' && (
            <div className="space-y-6">
              <ExportsView
                authToken={authToken}
                currentUser={userProfile}
                darkMode={darkMode}
              />

              <div
                className={`p-6 rounded-xl border space-y-4 max-w-xl ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <h3 className="text-base font-bold font-display">
                  Mentor Session &amp; Security Settings
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500">Administrator Name</span>
                    <span className="font-semibold">
                      {userProfile.displayName}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500">Role</span>
                    <span className="font-mono uppercase">
                      {userProfile.role}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500">Student Monitored</span>
                    <span className="font-semibold">Janvi</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Log Out of Mentor Session
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
