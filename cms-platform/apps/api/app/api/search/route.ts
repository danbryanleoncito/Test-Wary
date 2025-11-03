import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ApiResponse, SearchResult } from '@repo/shared';

// GET /api/search - Full-text search across articles
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const type = searchParams.get('type');
    const author = searchParams.get('author');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const status = searchParams.get('status') || 'published';

    if (!query || query.length < 2) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            error: 'Bad Request',
            message: 'Search query must be at least 2 characters',
            statusCode: 400
          },
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    const where: any = {
      status: status.toUpperCase(),
      OR: [
        {
          title: {
            contains: query,
            mode: 'insensitive'
          }
        },
        {
          content: {
            contains: query,
            mode: 'insensitive'
          }
        },
        {
          excerpt: {
            contains: query,
            mode: 'insensitive'
          }
        }
      ]
    };

    if (author) {
      where.author = {
        name: {
          contains: author,
          mode: 'insensitive'
        }
      };
    }

    if (tags && tags.length > 0) {
      where.tags = {
        some: {
          slug: {
            in: tags
          }
        }
      };
    }

    if (dateFrom || dateTo) {
      where.publishedAt = {};
      if (dateFrom) {
        where.publishedAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.publishedAt.lte = new Date(dateTo);
      }
    }

    const articles = await prisma.article.findMany({
      where,
      take: 20,
      orderBy: [
        { viewCount: 'desc' },
        { publishedAt: 'desc' }
      ],
      include: {
        author: {
          select: {
            id: true,
            name: true
          }
        },
        tags: true
      }
    });

    // Calculate simple relevance score based on query matches
    const results: SearchResult[] = articles.map(article => {
      const titleMatches = (article.title.toLowerCase().match(new RegExp(query.toLowerCase(), 'g')) || []).length;
      const contentMatches = (article.content.toLowerCase().match(new RegExp(query.toLowerCase(), 'g')) || []).length;
      const score = titleMatches * 3 + contentMatches;

      return {
        id: article.id,
        title: article.title,
        excerpt: article.excerpt || article.content.substring(0, 200) + '...',
        type: 'article' as const,
        author: article.author.name,
        publishedAt: article.publishedAt || undefined,
        score
      };
    }).sort((a, b) => b.score - a.score);

    return NextResponse.json<ApiResponse<SearchResult[]>>(
      {
        success: true,
        data: results,
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          error: 'Internal Server Error',
          message: 'Search failed',
          statusCode: 500,
          details: error.message
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
