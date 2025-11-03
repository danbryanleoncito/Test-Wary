/**
 * API Client for communicating with the Next.js backend
 */
import type { Article, PaginatedResponse, ApiResponse, AuthPayload, SearchResult } from '@repo/shared';

const API_BASE_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3000';

class APIClient {
  private baseURL: string;
  private cache: Map<string, { data: any; timestamp: number }>;
  private cacheTTL: number = 60000; // 1 minute

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.cache = new Map();
  }

  private isStale(cached: { data: any; timestamp: number }): boolean {
    return Date.now() - cached.timestamp > this.cacheTTL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const result: ApiResponse<T> = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || 'API request failed');
    }

    return result.data as T;
  }

  async getArticles(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    author?: string;
    tag?: string;
  }): Promise<PaginatedResponse<Article>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.pageSize) queryParams.set('pageSize', params.pageSize.toString());
    if (params?.status) queryParams.set('status', params.status);
    if (params?.author) queryParams.set('author', params.author);
    if (params?.tag) queryParams.set('tag', params.tag);

    const cacheKey = `/api/content?${queryParams.toString()}`;
    const cached = this.cache.get(cacheKey);

    if (cached && !this.isStale(cached)) {
      return cached.data;
    }

    const data = await this.request<PaginatedResponse<Article>>(
      `/api/content?${queryParams.toString()}`
    );

    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  async getArticle(id: string): Promise<Article> {
    const cacheKey = `/api/content/${id}`;
    const cached = this.cache.get(cacheKey);

    if (cached && !this.isStale(cached)) {
      return cached.data;
    }

    const data = await this.request<Article>(`/api/content/${id}`);
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  async getArticleBySlug(slug: string): Promise<Article | null> {
    const articles = await this.getArticles({ status: 'published' });
    return articles.data.find((article) => article.slug === slug) || null;
  }

  async search(query: string, filters?: {
    type?: string;
    author?: string;
    tags?: string[];
    dateFrom?: string;
    dateTo?: string;
  }): Promise<SearchResult[]> {
    const queryParams = new URLSearchParams({ q: query });
    if (filters?.type) queryParams.set('type', filters.type);
    if (filters?.author) queryParams.set('author', filters.author);
    if (filters?.tags) queryParams.set('tags', filters.tags.join(','));
    if (filters?.dateFrom) queryParams.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) queryParams.set('dateTo', filters.dateTo);

    return this.request<SearchResult[]>(`/api/search?${queryParams.toString()}`);
  }

  async login(email: string, password: string): Promise<AuthPayload> {
    return this.request<AuthPayload>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(email: string, password: string, name: string): Promise<AuthPayload> {
    return this.request<AuthPayload>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  clearCache() {
    this.cache.clear();
  }

  setCacheTTL(ttl: number) {
    this.cacheTTL = ttl;
  }
}

export const apiClient = new APIClient(API_BASE_URL);
export default apiClient;
