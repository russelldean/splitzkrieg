/**
 * JWT authentication helpers for admin and captain sessions.
 * Uses the jose library for HS256 signing/verification.
 */

import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';
import type { TokenPayload } from './types';

const SECRET = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!);

/**
 * Sign a JWT token with the given payload.
 * Defaults to 30-day expiration.
 */
export async function signToken(
  payload: TokenPayload,
  expiresIn = '30d',
): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(SECRET);
}

/**
 * Verify a JWT token and return the payload.
 * Returns null on any error (expired, invalid signature, malformed, etc.)
 */
export async function verifyToken(
  token: string,
): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Require an authenticated admin user for an API route.
 * Reads the 'admin-token' cookie, verifies the JWT, and checks for admin role.
 * Throws an Error if not authenticated or not an admin.
 */
export async function requireAdmin(
  request: NextRequest,
): Promise<TokenPayload> {
  const token = request.cookies.get('admin-token')?.value;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const payload = await verifyToken(token);
  if (!payload || payload.role !== 'admin') {
    throw new Error('Not authorized');
  }

  return payload;
}

/**
 * Require an authenticated admin or writer user for an API route.
 * Used for blog-related endpoints that writers can access.
 */
export async function requireAdminOrWriter(
  request: NextRequest,
): Promise<TokenPayload> {
  const token = request.cookies.get('admin-token')?.value;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const payload = await verifyToken(token);
  if (!payload || (payload.role !== 'admin' && payload.role !== 'writer')) {
    throw new Error('Not authorized');
  }

  return payload;
}

/**
 * Require an authenticated captain user for an API route.
 * Reads the 'lineup-token' cookie, verifies the JWT, and checks for captain role.
 * Throws an Error if not authenticated or not a captain.
 */
export async function requireCaptain(
  request: NextRequest,
): Promise<TokenPayload> {
  const token = request.cookies.get('lineup-token')?.value;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const payload = await verifyToken(token);
  if (!payload || payload.role !== 'captain') {
    throw new Error('Not authorized');
  }

  return payload;
}
