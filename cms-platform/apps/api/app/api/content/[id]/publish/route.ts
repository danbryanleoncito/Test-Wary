import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ApiResponse } from '@repo/shared';

// POST /api/content/[id]/publish - Publish an article
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = req.headers.get('x-user-id');
    const userRole = req.headers.get('x-user-role');

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

    // Check permissions (only editors and admins can publish)
    if (userRole !== 'admin' && userRole !== 'editor') {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            error: 'Forbidden',
            message: 'You do not have permission to publish articles',
            statusCode: 403
          },
          timestamp: new Date().toISOString()
        },
        { status: 403 }
      );
    }

    // Check if article exists
    const article = await prisma.article.findUnique({
      where: { id: params.id }
    });

    if (!article) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            error: 'Not Found',
            message: 'Article not found',
            statusCode: 404
          },
          timestamp: new Date().toISOString()
        },
        { status: 404 }
      );
    }

    // Publish article
    const publishedArticle = await prisma.article.update({
      where: { id: params.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date()
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        },
        tags: true
      }
    });

    // Update latest version with publish timestamp
    await prisma.contentVersion.updateMany({
      where: {
        contentId: params.id,
        version: publishedArticle.version
      },
      data: {
        publishedAt: new Date()
      }
    });

    return NextResponse.json<ApiResponse<any>>(
      {
        success: true,
        data: {
          ...publishedArticle,
          seo: {
            title: publishedArticle.seoTitle || publishedArticle.title,
            description: publishedArticle.seoDescription || publishedArticle.excerpt || '',
            keywords: publishedArticle.seoKeywords,
            ogImage: publishedArticle.ogImage,
            canonicalUrl: publishedArticle.canonicalUrl
          }
        },
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Publish article error:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          error: 'Internal Server Error',
          message: 'Failed to publish article',
          statusCode: 500,
          details: error.message
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
