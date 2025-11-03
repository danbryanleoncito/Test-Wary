import { NextRequest, NextResponse } from 'next/server';
import { validateEmail, validatePassword, validateTitle, validateContent, validateSlug } from '@repo/shared';

/**
 * Validation middleware wrapper
 */
export function withValidation<T>(
  schema: (data: T) => { valid: boolean; errors: string[] },
  handler: (req: NextRequest, data: T) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      const data = await req.json() as T;
      const validation = schema(data);

      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: {
              error: 'Validation Error',
              message: 'Invalid input data',
              statusCode: 400,
              details: validation.errors
            }
          },
          { status: 400 }
        );
      }

      return handler(req, data);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            error: 'Bad Request',
            message: 'Invalid JSON data',
            statusCode: 400
          }
        },
        { status: 400 }
      );
    }
  };
}

/**
 * Registration data validator
 */
export function validateRegistration(data: any) {
  const errors: string[] = [];

  const emailValidation = validateEmail(data.email);
  if (!emailValidation.valid) {
    errors.push(...emailValidation.errors);
  }

  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.valid) {
    errors.push(...passwordValidation.errors);
  }

  if (!data.name || data.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Article creation/update validator
 */
export function validateArticle(data: any) {
  const errors: string[] = [];

  const titleValidation = validateTitle(data.title);
  if (!titleValidation.valid) {
    errors.push(...titleValidation.errors);
  }

  const contentValidation = validateContent(data.content);
  if (!contentValidation.valid) {
    errors.push(...contentValidation.errors);
  }

  if (data.slug) {
    const slugValidation = validateSlug(data.slug);
    if (!slugValidation.valid) {
      errors.push(...slugValidation.errors);
    }
  }

  return { valid: errors.length === 0, errors };
}
