import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ApiResponse } from '@repo/shared';

// GET /api/content/[id]/versions - Get all versions of an article
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const versions = await prisma.contentVersion.findMany({
      where: {
        contentId: params.id
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        }
      },
      orderBy: {
        version: 'desc'
      }
    });

    return NextResponse.json<ApiResponse<any>>(
      {
        success: true,
        data: versions,
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Get versions error:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          error: 'Internal Server Error',
          message: 'Failed to fetch versions',
          statusCode: 500,
          details: error.message
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
