import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyRefreshToken, generateAccessToken, generateRefreshToken, getPermissions } from '@/lib/auth';
import type { ApiResponse, AuthPayload } from '@repo/shared';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            error: 'Bad Request',
            message: 'Refresh token is required',
            statusCode: 400
          },
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    // Verify refresh token
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            error: 'Unauthorized',
            message: 'Invalid or expired refresh token',
            statusCode: 401
          },
          timestamp: new Date().toISOString()
        },
        { status: 401 }
      );
    }

    // Check if refresh token exists in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            error: 'Unauthorized',
            message: 'Invalid or expired refresh token',
            statusCode: 401
          },
          timestamp: new Date().toISOString()
        },
        { status: 401 }
      );
    }

    // Generate new tokens
    const tokenPayload = {
      userId: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role.toLowerCase() as any
    };

    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    // Delete old refresh token and create new one
    await prisma.refreshToken.delete({
      where: { id: storedToken.id }
    });

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: storedToken.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    const authPayload: AuthPayload = {
      user: {
        id: storedToken.user.id,
        email: storedToken.user.email,
        role: storedToken.user.role.toLowerCase() as any,
        permissions: getPermissions(storedToken.user.role.toLowerCase() as any)
      },
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
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
    console.error('Refresh token error:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          error: 'Internal Server Error',
          message: 'Failed to refresh token',
          statusCode: 500,
          details: error.message
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
