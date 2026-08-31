import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export const ROLES = ['admin', 'staff', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export interface PublicUser {
  id: number;
  username: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      auth?: PublicUser;
    }
  }
}

const SESSION_COOKIE = 'wms_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const DUMMY_PASSWORD_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

const userSelect = {
  id: true,
  username: true,
  email: true,
  role: true,
  sessionVersion: true,
} as const;

const sessionSecret = (): string => {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) {
    if (process.env.NODE_ENV === 'production' && secret.length < 32) {
      throw new Error('SESSION_SECRET must contain at least 32 characters in production');
    }
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be configured in production');
  }
  return 'local-development-session-secret-change-me';
};

const encode = (value: string): string => Buffer.from(value, 'utf8').toString('base64url');
const decode = (value: string): string => Buffer.from(value, 'base64url').toString('utf8');

const signatureFor = (payload: string): string =>
  createHmac('sha256', sessionSecret()).update(payload).digest('base64url');

const roleOf = (value: string): Role | null =>
  (ROLES as readonly string[]).includes(value) ? (value as Role) : null;

export const publicUser = (user: { id: number; username: string; email: string; role: string }): PublicUser | null => {
  const role = roleOf(user.role);
  return role ? { id: user.id, username: user.username, email: user.email, role } : null;
};

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, 12);

export const verifyPassword = (password: string, passwordHash: string | undefined): Promise<boolean> =>
  bcrypt.compare(password, passwordHash ?? DUMMY_PASSWORD_HASH);

export interface SessionClaims {
  userId: number;
  sessionVersion: number;
}

export const createSessionToken = (user: PublicUser, sessionVersion: number): string => {
  const payload = encode(JSON.stringify({
    sub: user.id,
    sv: sessionVersion,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  }));
  return `${payload}.${signatureFor(payload)}`;
};

export const verifySessionToken = (token: string): SessionClaims | null => {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = signatureFor(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const parsed: unknown = JSON.parse(decode(payload));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('sub' in parsed) ||
      !('sv' in parsed) ||
      !('exp' in parsed) ||
      typeof parsed.sub !== 'number' ||
      !Number.isInteger(parsed.sub) ||
      typeof parsed.sv !== 'number' ||
      !Number.isInteger(parsed.sv) ||
      parsed.sv < 0 ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < Math.floor(Date.now() / 1000)
    ) return null;
    return { userId: parsed.sub, sessionVersion: parsed.sv };
  } catch {
    return null;
  }
};

const cookieValue = (request: Request): string | undefined => {
  const header = request.headers.cookie;
  if (!header) return undefined;
  const pair = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!pair) return undefined;
  return decodeURIComponent(pair.slice(SESSION_COOKIE.length + 1));
};

const bearerValue = (request: Request): string | undefined => {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  const token = header.slice(7).trim();
  return token || undefined;
};

export const tokenFromRequest = (request: Request): string | undefined => bearerValue(request) ?? cookieValue(request);

export const claimsFromRequest = (request: Request): SessionClaims | null => {
  const token = tokenFromRequest(request);
  return token ? verifySessionToken(token) : null;
};

export const setSessionCookie = (response: Response, token: string): void => {
  const secure = process.env.COOKIE_SECURE === 'true';
  const sameSite = (process.env.COOKIE_SAME_SITE ?? 'lax').toLowerCase();
  const sameSiteValue = sameSite === 'none' || sameSite === 'strict' ? sameSite : 'lax';
  const securePart = secure ? '; Secure' : '';
  response.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; SameSite=${sameSiteValue}${securePart}`,
  );
};

export const clearSessionCookie = (response: Response): void => {
  const secure = process.env.COOKIE_SECURE === 'true';
  const sameSite = (process.env.COOKIE_SAME_SITE ?? 'lax').toLowerCase();
  const sameSiteValue = sameSite === 'none' || sameSite === 'strict' ? sameSite : 'lax';
  const securePart = secure ? '; Secure' : '';
  response.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=${sameSiteValue}${securePart}`,
  );
};

export const requireAuth = (prisma: PrismaClient): RequestHandler => (request, _response, next) => {
  const claims = claimsFromRequest(request);
  if (!claims) {
    next(Object.assign(new Error('Authentication required'), { statusCode: 401, code: 'AUTH_REQUIRED' }));
    return;
  }
  void prisma.user.findUnique({ where: { id: claims.userId }, select: userSelect }).then((user) => {
    const publicValue = user && user.sessionVersion === claims.sessionVersion ? publicUser(user) : null;
    if (!publicValue) {
      next(Object.assign(new Error('Authentication required'), { statusCode: 401, code: 'AUTH_REQUIRED' }));
      return;
    }
    request.auth = publicValue;
    next();
  }).catch(next);
};

export const requireRole = (...allowedRoles: Role[]): RequestHandler => (request, _response, next) => {
  if (!request.auth) {
    next(Object.assign(new Error('Authentication required'), { statusCode: 401, code: 'AUTH_REQUIRED' }));
    return;
  }
  if (!allowedRoles.includes(request.auth.role)) {
    next(Object.assign(new Error('You do not have permission to perform this action'), { statusCode: 403, code: 'FORBIDDEN' }));
    return;
  }
  next();
};

export const currentUser = (request: Request): PublicUser => {
  if (!request.auth) throw new Error('Authentication required');
  return request.auth;
};

export const authCookieName = SESSION_COOKIE;

export const handleAuthError = (error: unknown, _request: Request, response: Response, next: NextFunction): void => {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    next(error);
    return;
  }
  next(error);
};
