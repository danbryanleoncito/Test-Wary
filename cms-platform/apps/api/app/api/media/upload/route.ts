import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { ApiResponse, Media } from '@repo/shared';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_FILE_SIZE = parseInt(process.env.UPLOAD_MAX_SIZE || '5242880', 10); // 5MB

// POST /api/media/upload - Upload media files
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            error: 'Unauthorized',
            message: 'User not authenticated',
            statusCode: 401
          },
          timestamp: new Date().toISOString()
        },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const alt = formData.get('alt') as string;
    const caption = formData.get('caption') as string;

    if (!file) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            error: 'Bad Request',
            message: 'No file provided',
            statusCode: 400
          },
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            error: 'Bad Request',
            message: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
            statusCode: 400
          },
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            error: 'Bad Request',
            message: 'File type not allowed. Only JPEG, PNG, GIF, and WebP images are supported.',
            statusCode: 400
          },
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}-${originalName}`;

    // Create upload directory if it doesn't exist
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = join(UPLOAD_DIR, filename);
    await writeFile(filePath, buffer);

    // Get image dimensions (simplified - in production use a library like sharp)
    let width: number | undefined;
    let height: number | undefined;

    // For now, we'll skip dimension detection in this environment
    // In production, use: const metadata = await sharp(buffer).metadata();

    // Create media record in database
    const media = await prisma.media.create({
      data: {
        url: `/uploads/${filename}`,
        filename,
        mimeType: file.type,
        size: file.size,
        width,
        height,
        alt,
        caption,
        uploadedById: userId
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json<ApiResponse<any>>(
      {
        success: true,
        data: media,
        timestamp: new Date().toISOString()
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          error: 'Internal Server Error',
          message: 'File upload failed',
          statusCode: 500,
          details: error.message
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// GET /api/media/upload - List uploaded media
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    const [media, total] = await Promise.all([
      prisma.media.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          uploadedBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }),
      prisma.media.count()
    ]);

    return NextResponse.json<ApiResponse<any>>(
      {
        success: true,
        data: {
          data: media,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        },
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Get media error:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          error: 'Internal Server Error',
          message: 'Failed to fetch media',
          statusCode: 500,
          details: error.message
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
