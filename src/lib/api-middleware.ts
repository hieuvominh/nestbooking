import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/jwt';

export interface AuthenticatedRequest extends NextRequest {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

// Middleware function to protect admin routes
export function withAuth<T = any>(
  handler: (request: AuthenticatedRequest, context?: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: T): Promise<NextResponse> => {
    try {
      const payload = verifyAdminAuth(request);
      
      // Add user info to request
      const authenticatedRequest = request as AuthenticatedRequest;
      authenticatedRequest.user = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      };

      return await handler(authenticatedRequest, context);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Authentication failed' },
        { status: 401 }
      );
    }
  };
}

// Role-based access control
export function requireRole<T = any>(roles: string[]) {
  return function (
    handler: (request: AuthenticatedRequest, context?: T) => Promise<NextResponse>
  ) {
    return withAuth<T>(async (request: AuthenticatedRequest, context?: T) => {
      if (!roles.includes(request.user.role)) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
      return await handler(request, context);
    });
  };
}

// Standard error responses
export const ApiResponses = {
  success: (data: any, message?: string) => 
    NextResponse.json({ success: true, data, message }, { status: 200 }),
  
  created: (data: any, message?: string) => 
    NextResponse.json({ success: true, data, message }, { status: 201 }),
  
  badRequest: (message: string) => 
    NextResponse.json({ error: message }, { status: 400 }),
  
  unauthorized: (message: string = 'Unauthorized') => 
    NextResponse.json({ error: message }, { status: 401 }),
  
  forbidden: (message: string = 'Forbidden') => 
    NextResponse.json({ error: message }, { status: 403 }),
  
  notFound: (message: string = 'Not found') => 
    NextResponse.json({ error: message }, { status: 404 }),
  
  conflict: (message: string) => 
    NextResponse.json({ error: message }, { status: 409 }),
  
  serverError: (message: string = 'Internal server error', error?: any) => {
    const payload: any = { error: message };
    // Include details in non-production to aid debugging
    if (process.env.NODE_ENV !== 'production' && error) {
      payload.details = error?.stack || String(error);
    }
    return NextResponse.json(payload, { status: 500 });
  },
};