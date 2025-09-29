import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_PUBLIC_SECRET = process.env.JWT_PUBLIC_SECRET!;

if (!JWT_SECRET || !JWT_PUBLIC_SECRET) {
  throw new Error('JWT secrets must be defined in environment variables');
}

// Admin JWT token interface
export interface AdminTokenPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Public booking token interface
export interface PublicBookingPayload {
  bookingId: string;
  exp: number;
  iat?: number;
}

// Sign admin JWT token (24 hours expiry)
export function signAdminToken(payload: Omit<AdminTokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '24h',
  });
}

// Verify admin JWT token
export function verifyAdminToken(token: string): AdminTokenPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired admin token');
  }
}

// Sign public booking token (expires after booking end time + buffer)
export function signPublicBookingToken(
  bookingId: string,
  expiresAt: Date
): string {
  const payload: PublicBookingPayload = {
    bookingId,
    exp: Math.floor(expiresAt.getTime() / 1000),
  };

  return jwt.sign(payload, JWT_PUBLIC_SECRET);
}

// Verify public booking token
export function verifyPublicBookingToken(token: string): PublicBookingPayload {
  try {
    return jwt.verify(token, JWT_PUBLIC_SECRET) as PublicBookingPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Booking session has expired');
    }
    throw new Error('Invalid booking token');
  }
}

// Extract admin token from request headers
export function extractAdminToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// Middleware helper to verify admin authentication
export function verifyAdminAuth(request: NextRequest): AdminTokenPayload {
  const token = extractAdminToken(request);
  if (!token) {
    throw new Error('No authentication token provided');
  }
  return verifyAdminToken(token);
}

// Generate public booking URL
export function generatePublicBookingUrl(
  bookingId: string,
  expiresAt: Date,
  baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
): string {
  const token = signPublicBookingToken(bookingId, expiresAt);
  return `${baseUrl}/p/${bookingId}?t=${token}`;
}

// Validate public booking access from URL parameters
export function validatePublicBookingAccess(
  bookingId: string,
  token: string
): boolean {
  try {
    const payload = verifyPublicBookingToken(token);
    return payload.bookingId === bookingId;
  } catch (error) {
    return false;
  }
}