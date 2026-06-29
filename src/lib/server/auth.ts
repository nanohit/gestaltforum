import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { sqlite } from '$lib/server/db';
import { config } from '$lib/server/config';
import type { Role } from '$lib/types';

export const SESSION_COOKIE = 'gestalt_session';

export type PublicUser = {
  id: number;
  email: string | null;
  phone: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: 'active' | 'banned';
  mutedUntil: string | null;
};

type UserRow = {
  id: number;
  email: string | null;
  phone: string;
  first_name: string;
  last_name: string;
  role: Role;
  status: 'active' | 'banned';
  muted_until: string | null;
};

const findUserBySession = sqlite.prepare(`
  SELECT u.id, u.email, u.phone, u.first_name, u.last_name, u.role, u.status, u.muted_until
  FROM sessions s
  JOIN users u ON u.id = s.user_id
  WHERE s.id = ? AND datetime(s.expires_at) > datetime('now')
`);

const sessionHash = (token: string) => createHash('sha256').update(token).digest('hex');

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    status: row.status,
    mutedUntil: row.muted_until
  };
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function createSession(userId: number, cookies: Cookies): string {
  const token = randomBytes(32).toString('base64url');
  const id = sessionHash(token);
  const expires = new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000);
  sqlite
    .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .run(id, userId, expires.toISOString());
  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    expires,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  return id;
}

export function clearSession(cookies: Cookies, token?: string | null): void {
  if (token) sqlite.prepare('DELETE FROM sessions WHERE id = ?').run(sessionHash(token));
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function getUserFromToken(token: string | undefined): { user: PublicUser; sessionId: string } | null {
  if (!token) return null;
  const id = sessionHash(token);
  const row = findUserBySession.get(id) as UserRow | undefined;
  if (!row || row.status === 'banned') return null;
  return { user: toPublicUser(row), sessionId: id };
}

export function getUserByEmail(email: string): (UserRow & { pwd_hash: string }) | undefined {
  return sqlite
    .prepare(`
      SELECT id, email, phone, first_name, last_name, role, status, muted_until, pwd_hash
      FROM users WHERE email = ?
    `)
    .get(email.toLowerCase()) as (UserRow & { pwd_hash: string }) | undefined;
}

export function isMuted(user: PublicUser): boolean {
  return Boolean(user.mutedUntil && new Date(user.mutedUntil).getTime() > Date.now());
}
