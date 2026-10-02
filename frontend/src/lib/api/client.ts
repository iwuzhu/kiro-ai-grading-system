import { API_BASE_URL, AUTH_ENDPOINTS } from './endpoints';
import { ApiResponse, ApiErrorResponse } from './types';

export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

let refreshTokenPromise: Promise<string | null> | null = null;

export class ApiClient {
  private baseUrl: string;
  private tokenRefreshCallback: (() => Promise<{ access_token: string; refresh_token: string } | null>) | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setTokenRefreshCallback(callback: () => Promise<{ access_token: string; refresh_token: string } | null>) {
    this.tokenRefreshCallback = callback;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async refreshAccessToken(): Promise<string | null> {
    // Prevent multiple refresh attempts simultaneously
    if (refreshTokenPromise) {
      return refreshTokenPromise;
    }

    refreshTokenPromise = (async () => {
      try {
        if (!this.tokenRefreshCallback) {
          return null;
        }

        const result = await this.tokenRefreshCallback();
        if (result) {
          localStorage.setItem('access_token', result.access_token);
          localStorage.setItem('refresh_token', result.refresh_token);
          return result.access_token;
        }
        return null;
      } finally {
        refreshTokenPromise = null;
      }
    })();

    return refreshTokenPromise;
  }

  private async request<T = unknown>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<T> {
    const {
      method = 'GET',
      headers: customHeaders = {},
      body,
      timeout = 30000,
    } = config;

    const url = `${this.baseUrl}${endpoint}`;
    const authHeaders = await this.getAuthHeaders();
    const headers = {
      ...authHeaders,
      ...customHeaders,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle token expiration
      if (response.status === 401 && method !== 'POST' && !endpoint.includes('/auth/')) {
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          // Retry the request with the new token
          headers['Authorization'] = `Bearer ${newToken}`;
          return this.request<T>(endpoint, { ...config, headers });
        }
      }

      // Handle response
      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw error;
      }

      if (response.status === 204) {
        return null as unknown as T;
      }

      const rawData = await response.json();
      console.log('[API] Response:', { endpoint, method, status: response.status, data: rawData });

      // Handle wrapped responses from ResponseInterceptor
      // If response has { success: true, data: {...} } structure, extract the data
      if (rawData && typeof rawData === 'object' && 'success' in rawData && 'data' in rawData) {
        return rawData.data as T;
      }

      return rawData as T;
    } catch (error) {
      console.error('[API] Request error:', { endpoint, method, error });
      if (error instanceof TypeError && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async parseErrorResponse(response: Response): Promise<Error> {
    try {
      const data: any = await response.json();
      console.error('[API] Error response:', data);
      
      // Handle standardized error format from GlobalExceptionFilter
      if (data && typeof data === 'object' && data.error) {
        const errorMessage = data.error.message || data.error.code || 'Unknown error';
        return new Error(errorMessage);
      }
      
      // Fallback for legacy error format
      if (data && data.error && typeof data.error === 'string') {
        return new Error(data.error);
      }
      
      // Final fallback
      return new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch {
      const message = `HTTP ${response.status}: ${response.statusText}`;
      console.error('[API] Parse error response failed:', message);
      return new Error(message);
    }
  }

  async get<T = unknown>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body });
  }

  async put<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body });
  }

  async delete<T = unknown>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async patch<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
