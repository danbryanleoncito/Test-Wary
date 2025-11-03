import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateArticle } from '@/lib/validation';
import { slugify } from '@repo/shared';
import type { ApiResponse, Article, PaginatedResponse } from '@repo/shared';

// GET /api/content - Get all articles with pagination and filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const status = searchParams.get('status');
    const author = searchParams.get('author');
    const tag = searchParams.get('tag');

    const where: any = {};

    if (status) {
      where.status = status.toUpperCase();
    }

    if (author) {
      where.author = {
        name: {
          contains: author,
          mode: 'insensitive'
        }
      };
    }

    if (tag) {
      where.tags = {
        some: {
          name: {
            contains: tag,
            mode: 'insensitive'
          }
        }
      };
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: {
          createdAt: 'desc'
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
      }),
      prisma.article.count({ where })
    ]);

    const response: PaginatedResponse<any> = {
      data: articles.map(article => ({
        ...article,
        seo: {
          title: article.seoTitle || article.title,
          description: article.seoDescription || article.excerpt || '',
          keywords: article.seoKeywords,
          ogImage: article.ogImage,
          canonicalUrl: article.canonicalUrl
        }
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<any>>>(
      {
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Get articles error:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          error: 'Internal Server Error',
          message: 'Failed to fetch articles',
          statusCode: 500,
          details: error.message
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// POST /api/content - Create new article
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { title, content, excerpt, tags = [], status = 'draft', featuredImage, seo } = body;

    // Validate
    const validation = validateArticle({ title, content });
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

    // Generate slug
    const baseSlug = body.slug || slugify(title);
    let slug = baseSlug;
    let counter = 1;

    // Ensure slug is unique
    while (await prisma.article.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create or connect tags
    const tagData = await Promise.all(
      tags.map(async (tagName: string) => {
        const tagSlug = slugify(tagName);
        const existingTag = await prisma.tag.findUnique({
          where: { slug: tagSlug }
        });

        if (existingTag) {
          return { id: existingTag.id };
        }

        const newTag = await prisma.tag.create({
          data: {
            name: tagName,
            slug: tagSlug
          }
        });

        return { id: newTag.id };
      })
    );

    // Create article
    const article = await prisma.article.create({
      data: {
        title,
        slug,
        content,
        excerpt,
        status: status.toUpperCase(),
        featuredImage,
        seoTitle: seo?.title,
        seoDescription: seo?.description,
        seoKeywords: seo?.keywords || [],
        ogImage: seo?.ogImage,
        canonicalUrl: seo?.canonicalUrl,
        authorId: userId,
        tags: {
          connect: tagData
        }
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

    // Create initial version
    await prisma.contentVersion.create({
      data: {
        contentId: article.id,
        version: 1,
        data: {
          title,
          content,
          excerpt,
          seo
        },
        createdById: userId,
        changeLog: 'Initial version'
      }
    });

    return NextResponse.json<ApiResponse<any>>(
      {
        success: true,
        data: {
          ...article,
          seo: {
            title: article.seoTitle || article.title,
            description: article.seoDescription || article.excerpt || '',
            keywords: article.seoKeywords,
            ogImage: article.ogImage,
            canonicalUrl: article.canonicalUrl
          }
        },
        timestamp: new Date().toISOString()
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create article error:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          error: 'Internal Server Error',
          message: 'Failed to create article',
          statusCode: 500,
          details: error.message
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
