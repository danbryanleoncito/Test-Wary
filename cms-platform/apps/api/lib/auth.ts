import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { UserRole } from '@repo/shared';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'access-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret';
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRY,
  });
}

/**
 * Generate JWT refresh token
 */
export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRY,
  });
}

/**
 * Verify and decode access token
 */
export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_ACCESS_SECRET) as TokenPayload;
}

/**
 * Verify and decode refresh token
 */
export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Get permissions for a user role
 */
export function getPermissions(role: UserRole): string[] {
  const permissions = {
    admin: ['*'],
    editor: ['content:*', 'media:*', 'comments:moderate'],
    author: ['content:create', 'content:edit:own', 'media:upload'],
    viewer: ['content:read', 'comments:create']
  };
  return permissions[role.toLowerCase() as keyof typeof permissions] || [];
}
