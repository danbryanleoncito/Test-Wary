// User and Authentication Types
export type UserRole = 'admin' | 'editor' | 'author' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthPayload {
  user: {
    id: string;
    email: string;
    role: UserRole;
    permissions: string[];
  };
  accessToken: string;
  refreshToken: string;
}

export const permissions = {
  admin: ['*'],
  editor: ['content:*', 'media:*', 'comments:moderate'],
  author: ['content:create', 'content:edit:own', 'media:upload'],
  viewer: ['content:read', 'comments:create']
} as const;

// Content Types
export type ContentStatus = 'draft' | 'published' | 'archived';
export type ContentType = 'article' | 'page' | 'media';

export interface SEOMetadata {
  title: string;
  description: string;
  keywords: string[];
  ogImage?: string;
  canonicalUrl?: string;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  author: User;
  authorId: string;
  status: ContentStatus;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  seo: SEOMetadata;
  featuredImage?: string;
  viewCount: number;
  version: number;
}

export interface ContentVersion {
  id: string;
  contentId: string;
  version: number;
  data: Record<string, any>;
  createdBy: string;
  createdById: string;
  createdAt: Date;
  publishedAt?: Date;
  changeLog?: string;
}

// Media Types
export interface Media {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  uploadedBy: string;
  uploadedById: string;
  createdAt: Date;
  alt?: string;
  caption?: string;
}

// Comment Types
export interface Comment {
  id: string;
  text: string;
  author: User;
  authorId: string;
  articleId: string;
  parentId?: string;
  replies: Comment[];
  createdAt: Date;
  updatedAt: Date;
  reactions: CommentReaction[];
  isModerated: boolean;
}

export interface CommentReaction {
  id: string;
  type: 'like' | 'love' | 'insightful';
  userId: string;
  commentId: string;
}

// API Response Types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  details?: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: string;
}

// Search Types
export interface SearchFilters {
  query?: string;
  type?: ContentType;
  author?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  status?: ContentStatus;
}

export interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  type: ContentType;
  author: string;
  publishedAt?: Date;
  score: number;
}

// Real-time Update Types
export interface RealtimeMessage {
  type: 'content_updated' | 'content_created' | 'content_deleted' | 'comment_added';
  data: any;
  timestamp: string;
}

// Dashboard Analytics Types
export interface DashboardMetrics {
  totalArticles: number;
  publishedArticles: number;
  draftArticles: number;
  totalViews: number;
  totalComments: number;
  liveVisitors: number;
  viewsToday: number;
  popularArticles: Array<{
    id: string;
    title: string;
    views: number;
  }>;
}

export interface AnalyticsEvent {
  type: 'page_view' | 'article_read' | 'comment_posted' | 'search';
  userId?: string;
  articleId?: string;
  metadata: Record<string, any>;
  timestamp: Date;
}
