import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateAccessToken, generateRefreshToken, getPermissions } from '@/lib/auth';
import { validateRegistration } from '@/lib/validation';
import type { ApiResponse, AuthPayload } from '@repo/shared';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, role = 'viewer' } = body;

    // Validate input
    const validation = validateRegistration({ email, password, name });
    if (!validation.valid) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            error: 'Validation Error',
            message: 'Invalid input data',
            statusCode: 400,
            details: validation.errors
          },
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            error: 'Conflict',
            message: 'User with this email already exists',
            statusCode: 409
          },
          timestamp: new Date().toISOString()
        },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role.toUpperCase() as any
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        createdAt: true
      }
    });

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
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          error: 'Internal Server Error',
          message: 'Failed to register user',
          statusCode: 500,
          details: error.message
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
