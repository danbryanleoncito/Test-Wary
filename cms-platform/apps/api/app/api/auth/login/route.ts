import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, generateAccessToken, generateRefreshToken, getPermissions } from '@/lib/auth';
import type { ApiResponse, AuthPayload } from '@repo/shared';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            error: 'Bad Request',
            message: 'Email and password are required',
            statusCode: 400
          },
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            error: 'Unauthorized',
            message: 'Invalid credentials',
            statusCode: 401
          },
          timestamp: new Date().toISOString()
        },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);

    if (!isValidPassword) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            error: 'Unauthorized',
            message: 'Invalid credentials',
            statusCode: 401
          },
          timestamp: new Date().toISOString()
        },
        { status: 401 }
      );
    }

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role.toLowerCase() as any
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    const authPayload: AuthPayload = {
      user: {
        id: user.id,
        email: user.email,
        role: user.role.toLowerCase() as any,
        permissions: getPermissions(user.role.toLowerCase() as any)
      },
      accessToken,
      refreshToken
    };

    return NextResponse.json<ApiResponse<AuthPayload>>(
      {
        success: true,
        data: authPayload,
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          error: 'Internal Server Error',
          message: 'Failed to login',
          statusCode: 500,
          details: error.message
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
