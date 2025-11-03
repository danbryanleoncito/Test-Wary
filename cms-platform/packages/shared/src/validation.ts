/**
 * Validation schemas and utilities for the CMS platform
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email) {
    errors.push('Email is required');
  } else if (!emailRegex.test(email)) {
    errors.push('Invalid email format');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];

  if (!password) {
    errors.push('Password is required');
  } else {
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate article title
 */
export function validateTitle(title: string): ValidationResult {
  const errors: string[] = [];

  if (!title || title.trim().length === 0) {
    errors.push('Title is required');
  } else if (title.length < 3) {
    errors.push('Title must be at least 3 characters long');
  } else if (title.length > 200) {
    errors.push('Title must not exceed 200 characters');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate article content
 */
export function validateContent(content: string): ValidationResult {
  const errors: string[] = [];

  if (!content || content.trim().length === 0) {
    errors.push('Content is required');
  } else if (content.length < 10) {
    errors.push('Content must be at least 10 characters long');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate slug format
 */
export function validateSlug(slug: string): ValidationResult {
  const errors: string[] = [];
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  if (!slug) {
    errors.push('Slug is required');
  } else if (!slugRegex.test(slug)) {
    errors.push('Slug must contain only lowercase letters, numbers, and hyphens');
  } else if (slug.length > 100) {
    errors.push('Slug must not exceed 100 characters');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate tags
 */
export function validateTags(tags: string[]): ValidationResult {
  const errors: string[] = [];

  if (tags.length > 10) {
    errors.push('Maximum 10 tags allowed');
  }

  tags.forEach(tag => {
    if (tag.length > 30) {
      errors.push(`Tag "${tag}" exceeds 30 characters`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Sanitize HTML content (basic XSS prevention)
 */
export function sanitizeHtml(html: string): string {
  // Basic sanitization - in production, use a library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/g, '')
    .replace(/on\w+='[^']*'/g, '');
}

/**
 * Validate file upload
 */
export function validateFileUpload(
  file: { size: number; type: string; name: string },
  options: {
    maxSize?: number; // in bytes
    allowedTypes?: string[];
  } = {}
): ValidationResult {
  const errors: string[] = [];
  const maxSize = options.maxSize || 5 * 1024 * 1024; // 5MB default
  const allowedTypes = options.allowedTypes || [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ];

  if (file.size > maxSize) {
    errors.push(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
  }

  if (!allowedTypes.includes(file.type)) {
    errors.push(`File type ${file.type} is not allowed`);
  }

  return { valid: errors.length === 0, errors };
}
