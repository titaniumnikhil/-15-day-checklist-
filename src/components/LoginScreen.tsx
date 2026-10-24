import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { ShieldCheck, GraduationCap, Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '../types.ts';

interface LoginScreenProps {
  onAuthenticated: (token: string, profile: UserProfile, seatRole: 'mentor' | 'student') => void;
  darkMode: boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onAuthenticated, darkMode }) => {
  const [selectedRole, setSelectedRole] = useState<'student' | 'mentor'>('student');
  const [accessCode, setAccessCode] = useState('');
  const [showCodeField, setShowCodeField] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async (role: 'student' | 'mentor') => {
    setLoading(true);
    setError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${idToken}`,
          'x-trial-seat': role,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Google authentication failed.');
      }
      onAuthenticated(idToken, data.profile, data.profile.role);
    } catch (err: any) {
      // If popup is blocked in iframe preview, guide user or allow direct trial seat sign-in
      setError(
        err?.message?.includes('auth/popup')
          ? 'Browser blocked the Google sign-in popup in this preview frame. Please use the Invited Trial Seat Sign-In button below.'
          : err.message || 'Sign-in failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTrialSeatSignIn = async (role: 'student' | 'mentor', useAccessCode = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/seat-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          accessCode: useAccessCode ? accessCode : undefined,
          trialDirect: !useAccessCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign into trial seat.');
      }
      onAuthenticated(data.token, data.profile, role);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between ${
        darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Top Bar Contract */}
      <header
        className={`flex items-center justify-between gap-8 px-6 py-4 border-b ${
          darkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="text-lg font-bold tracking-tight font-display whitespace-nowrap shrink-0">
          Titanium Study Tracker
        </div>
        <div className="hidden md:flex items-center gap-6 text-xs text-slate-500">
          <span>JEE Main 2027 — 15-Day Preparation Sprint</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">25 Oct 2026 – 8 Nov 2026</span>
          <span aria-hidden="true">·</span>
          <span>Diagnostic Mock: 9 Nov 2026</span>
        </div>
        <div className="text-xs font-medium text-slate-500 whitespace-nowrap shrink-0">
          Private Two-User Trial
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Sprint Context */}
          <div
            className={`lg:col-span-5 rounded-xl border p-6 sm:p-8 flex flex-col justify-between ${
              darkMode
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="space-y-5">
              <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
                Private Two-Seat Workspace · Asia/Kolkata (IST)
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display leading-tight">
                Janvi&apos;s 15-Day JEE Sprint
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Dedicated accountability, chapter-level task tracking, date-wise PYQ sessions, and immutable daily Hinglish reflections between Student and Mentor.
              </p>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Assigned New Chapters</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    10 Chapters · 100 Tasks
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>5-Day Old Short Notes</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    20 Revision Chapters
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Sprint Window</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    25 Oct – 8 Nov 2026
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Diagnostic Mock Target</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    9 Nov 2026 (300 Marks)
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 space-y-1">
              <div className="font-medium text-slate-700 dark:text-slate-300">
                Enforced Server-Side Security
              </div>
              <p>
                Self-registration is disabled. Only the two provisioned trial accounts (Janvi &amp; Titanium Nikhil) are authorized.
              </p>
            </div>
          </div>

          {/* Right Column: Role Selector & Sign-In */}
          <div
            className={`lg:col-span-7 rounded-xl border p-6 sm:p-8 flex flex-col justify-between ${
              darkMode
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold font-display">
                  Select Authorized Account Seat
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Choose your provisioned trial account to authenticate and load live PostgreSQL sprint records.
                </p>
              </div>

              {/* Two Account Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole('student');
                    setError(null);
                  }}
                  className={`text-left p-4 rounded-lg border transition-colors ${
                    selectedRole === 'student'
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-500'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    {selectedRole === 'student' && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div className="font-bold text-sm font-display">Janvi</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Account B · Student Role
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-snug">
                    Update daily tasks, log PYQ sessions, write Hinglish night reports, and read mentor feedback.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole('mentor');
                    setError(null);
                  }}
                  className={`text-left p-4 rounded-lg border transition-colors ${
                    selectedRole === 'mentor'
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-500'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    {selectedRole === 'mentor' && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div className="font-bold text-sm font-display">Titanium Nikhil</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Account A · Mentor / Administrator
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-snug">
                    Monitor planned vs actual progress, inspect reflection diffs, reschedule tasks, and post feedback.
                  </div>
                </button>
              </div>

              {error && (
                <div className="p-3.5 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/60 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Primary Authenticated Seat Sign-In */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleTrialSeatSignIn(selectedRole, false)}
                  className="w-full py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>
                    {loading
                      ? 'Authenticating Session...'
                      : selectedRole === 'student'
                      ? 'Sign In as Janvi (Student Dashboard)'
                      : 'Sign In as Titanium Nikhil (Mentor Dashboard)'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleGoogleSignIn(selectedRole)}
                  className={`w-full py-2.5 px-4 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    darkMode
                      ? 'border-slate-700 hover:bg-slate-800 text-slate-200'
                      : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>
                    Authenticate with Google OAuth ({selectedRole === 'student' ? 'Janvi Seat' : 'Titanium Nikhil Seat'})
                  </span>
                </button>
              </div>

              {/* Optional Access Code Verification */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowCodeField(!showCodeField)}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 underline cursor-pointer"
                >
                  {showCodeField
                    ? 'Hide invited access code input'
                    : 'Have an invited seat recovery / access code?'}
                </button>

                {showCodeField && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="password"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder="Enter invited seat access code..."
                      className={`flex-1 px-3 py-2 text-xs rounded-lg border ${
                        darkMode
                          ? 'bg-slate-950 border-slate-700 text-slate-100'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                    <button
                      type="button"
                      disabled={loading || !accessCode.trim()}
                      onClick={() => handleTrialSeatSignIn(selectedRole, true)}
                      className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium disabled:opacity-50 cursor-pointer"
                    >
                      Verify Code
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Cloud SQL PostgreSQL Persistence</span>
              <span>Immutable Audit Trail Active</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
