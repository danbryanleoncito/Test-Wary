import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, extractToken } from '@/lib/auth';
import { rateLimiter } from '@/lib/redis';

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Skip middleware for public routes
  if (
    path.startsWith('/_next') ||
    path.startsWith('/static') ||
    path === '/api/auth/login' ||
    path === '/api/auth/register' ||
    path === '/api/auth/refresh'
  ) {
    return NextResponse.next();
  }

  // Rate limiting
  const identifier = req.ip || 'anonymous';
  const authHeader = req.headers.get('authorization');
  const rateLimitType = authHeader ? 'authenticated' : 'anonymous';

  const rateLimit = await rateLimiter.checkLimit(identifier, rateLimitType);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          statusCode: 429,
          details: {
            remaining: rateLimit.remaining,
            resetAt: rateLimit.resetAt
          }
        },
        timestamp: new Date().toISOString()
      },
      { status: 429 }
    );
  }

  // Authentication for protected routes
  if (path.startsWith('/api')) {
    const token = extractToken(authHeader);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: {
            error: 'Unauthorized',
            message: 'No authentication token provided',
            statusCode: 401
          },
          timestamp: new Date().toISOString()
        },
        { status: 401 }
      );
    }

    try {
      const payload = verifyAccessToken(token);

      // Add user info to request headers
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-user-id', payload.userId);
      requestHeaders.set('x-user-email', payload.email);
      requestHeaders.set('x-user-role', payload.role);

      return NextResponse.next({
        request: {
          headers: requestHeaders
        }
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            error: 'Unauthorized',
            message: 'Invalid or expired token',
            statusCode: 401
          },
          timestamp: new Date().toISOString()
        },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
