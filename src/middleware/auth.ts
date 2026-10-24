import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { profiles } from '../db/schema.ts';
import { CANONICAL_MENTOR_UID, CANONICAL_STUDENT_UID } from '../db/seed.ts';
import { eq } from 'drizzle-orm';

export interface AuthenticatedProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'mentor' | 'student';
  authMethod: 'firebase' | 'seat_session';
}

export interface AuthRequest extends Request {
  userProfile?: AuthenticatedProfile;
}

const SERVER_SESSION_SECRET =
  process.env.SESSION_SIGNING_SECRET ||
  crypto
    .createHash('sha256')
    .update(`titanium-sprint-secret-${process.env.SQL_PASSWORD || 'cloudsql-key'}`)
    .digest('hex');

// Server-side access codes for the two invited trial seats (never exposed in client source)
const MENTOR_ACCESS_CODE = process.env.MENTOR_ACCESS_CODE || 'TITANIUM-MENTOR-2027';
const STUDENT_ACCESS_CODE = process.env.STUDENT_ACCESS_CODE || 'JANVI-SPRINT-2027';

export function createSeatSessionToken(role: 'mentor' | 'student'): string {
  const payload = {
    uid: role === 'mentor' ? CANONICAL_MENTOR_UID : CANONICAL_STUDENT_UID,
    email: role === 'mentor' ? 'titaniumoxide26@gmail.com' : 'janvi.student@titanium.study',
    displayName: role === 'mentor' ? 'Titanium Nikhil' : 'Janvi',
    role,
    iat: Date.now(),
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SERVER_SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `seat.${encoded}.${sig}`;
}

export function verifySeatSessionToken(token: string): AuthenticatedProfile | null {
  if (!token.startsWith('seat.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SERVER_SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!decoded.exp || Date.now() > decoded.exp) return null;
    if (decoded.role !== 'mentor' && decoded.role !== 'student') return null;
    return {
      uid: decoded.uid,
      email: decoded.email,
      displayName: decoded.displayName,
      role: decoded.role,
      authMethod: 'seat_session',
    };
  } catch {
    return null;
  }
}

export function verifySeatAccessCode(role: 'mentor' | 'student', code: string): boolean {
  const trimmed = (code || '').trim();
  if (role === 'mentor') {
    return trimmed === MENTOR_ACCESS_CODE;
  }
  if (role === 'student') {
    return trimmed === STUDENT_ACCESS_CODE;
  }
  return false;
}

export async function upsertUserProfile(
  uid: string,
  email: string,
  preferredRole?: 'mentor' | 'student'
) {
  try {
    const normalizedEmail = (email || '').toLowerCase().trim();
    const existing = await db.select().from(profiles).where(eq(profiles.uid, uid));

    if (existing.length > 0) {
      return existing[0];
    }

    // Determine role for new Firebase Google login:
    // titaniumoxide26@gmail.com defaults to Titanium Nikhil (mentor) unless student seat requested
    let assignedRole: 'mentor' | 'student' = 'student';
    let displayName = 'Janvi';

    if (preferredRole === 'mentor' || normalizedEmail === 'titaniumoxide26@gmail.com') {
      if (preferredRole !== 'student') {
        assignedRole = 'mentor';
        displayName = 'Titanium Nikhil';
      }
    }

    const result = await db
      .insert(profiles)
      .values({
        uid,
        email: normalizedEmail || 'user@titanium.study',
        displayName,
        role: assignedRole,
      })
      .onConflictDoUpdate({
        target: profiles.uid,
        set: {
          email: normalizedEmail || 'user@titanium.study',
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database profile upsert failed:', error);
    throw new Error('Failed to synchronize user profile.', { cause: error });
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing authentication token.' });
  }

  const token = authHeader.split('Bearer ')[1].trim();

  // 1. Check if it is a server-signed seat session token
  const seatSession = verifySeatSessionToken(token);
  if (seatSession) {
    req.userProfile = seatSession;
    return next();
  }

  // 2. Otherwise verify as a Firebase ID Token
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const requestedSeatHeader = req.headers['x-trial-seat'] as string | undefined;
    const preferredRole =
      requestedSeatHeader === 'mentor' || requestedSeatHeader === 'student'
        ? requestedSeatHeader
        : undefined;

    const dbProfile = await upsertUserProfile(
      decodedToken.uid,
      decodedToken.email || '',
      preferredRole
    );

    // Allow the verified owner (titaniumoxide26@gmail.com) or bound profile to operate in their selected seat
    // while strictly preventing a student-only profile from escalating to mentor.
    let effectiveRole: 'mentor' | 'student' = dbProfile.role === 'mentor' ? 'mentor' : 'student';
    let effectiveName = dbProfile.displayName;
    let effectiveUid =
      effectiveRole === 'mentor' ? CANONICAL_MENTOR_UID : CANONICAL_STUDENT_UID;

    if (
      dbProfile.role === 'mentor' &&
      requestedSeatHeader === 'student'
    ) {
      effectiveRole = 'student';
      effectiveName = 'Janvi';
      effectiveUid = CANONICAL_STUDENT_UID;
    }

    req.userProfile = {
      uid: effectiveUid,
      email: dbProfile.email,
      displayName: effectiveName,
      role: effectiveRole,
      authMethod: 'firebase',
    };
    return next();
  } catch (error) {
    console.error('Error verifying authentication token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
  }
};

export const requireMentor = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.userProfile) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }
  if (req.userProfile.role !== 'mentor') {
    return res.status(403).json({
      error: 'Forbidden: This action is restricted to Mentor (Titanium Nikhil). Student accounts cannot perform mentor administration.',
    });
  }
  return next();
};
