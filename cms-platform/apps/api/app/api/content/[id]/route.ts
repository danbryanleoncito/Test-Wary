import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateArticle } from '@/lib/validation';
import { slugify } from '@repo/shared';
import type { ApiResponse } from '@repo/shared';

// GET /api/content/[id] - Get single article
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const article = await prisma.article.findUnique({
      where: { id: params.id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true
          }
        },
        tags: true,
        comments: {
          where: { parentId: null },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                avatar: true
              }
            },
            replies: {
              include: {
                author: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true
                  }
                }
              }
            },
            reactions: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
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

    // Increment view count
    await prisma.article.update({
      where: { id: params.id },
      data: { viewCount: { increment: 1 } }
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
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Get article error:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          error: 'Internal Server Error',
          message: 'Failed to fetch article',
          statusCode: 500,
          details: error.message
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// PUT /api/content/[id] - Update article
export async function PUT(
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

    // Check if article exists
    const existingArticle = await prisma.article.findUnique({
      where: { id: params.id }
    });

    if (!existingArticle) {
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

    // Check permissions
    if (
      userRole !== 'admin' &&
      userRole !== 'editor' &&
      existingArticle.authorId !== userId
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            error: 'Forbidden',
            message: 'You do not have permission to edit this article',
            statusCode: 403
          },
          timestamp: new Date().toISOString()
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { title, content, excerpt, tags, status, featuredImage, seo, changeLog } = body;

    // Validate if title or content changed
    if (title || content) {
      const validation = validateArticle({
        title: title || existingArticle.title,
        content: content || existingArticle.content
      });

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
    }

    // Handle tags if provided
    let tagData: any = undefined;
    if (tags) {
      tagData = await Promise.all(
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
    }

    // Update article
    const updateData: any = {};
    if (title) updateData.title = title;
    if (content) updateData.content = content;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (status) updateData.status = status.toUpperCase();
    if (featuredImage !== undefined) updateData.featuredImage = featuredImage;
    if (seo) {
      updateData.seoTitle = seo.title;
      updateData.seoDescription = seo.description;
      updateData.seoKeywords = seo.keywords || [];
      updateData.ogImage = seo.ogImage;
      updateData.canonicalUrl = seo.canonicalUrl;
    }

    if (tagData) {
      updateData.tags = {
        set: [],
        connect: tagData
      };
    }

    const article = await prisma.article.update({
      where: { id: params.id },
      data: {
        ...updateData,
        version: { increment: 1 }
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

    // Create version snapshot
    await prisma.contentVersion.create({
      data: {
        contentId: article.id,
        version: article.version,
        data: {
          title: article.title,
          content: article.content,
          excerpt: article.excerpt,
          seo: {
            title: article.seoTitle,
            description: article.seoDescription,
            keywords: article.seoKeywords
          }
        },
        createdById: userId,
        changeLog: changeLog || 'Updated article'
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
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Update article error:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          error: 'Internal Server Error',
          message: 'Failed to update article',
          statusCode: 500,
          details: error.message
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// DELETE /api/content/[id] - Delete article
export async function DELETE(
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

    // Check permissions
    if (
      userRole !== 'admin' &&
      userRole !== 'editor' &&
      article.authorId !== userId
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            error: 'Forbidden',
            message: 'You do not have permission to delete this article',
            statusCode: 403
          },
          timestamp: new Date().toISOString()
        },
        { status: 403 }
      );
    }

    await prisma.article.delete({
      where: { id: params.id }
    });

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: { message: 'Article deleted successfully' },
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Delete article error:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          error: 'Internal Server Error',
          message: 'Failed to delete article',
          statusCode: 500,
          details: error.message
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
