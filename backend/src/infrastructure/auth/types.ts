/**
 * JWT & Authentication Types
 * Shared type definitions for JWT payloads, user context, and auth requests/responses
 */

/**
 * User Role enumeration
 * Three primary roles with hierarchical permissions
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  INSTRUCTOR = 'INSTRUCTOR',
  STUDENT = 'STUDENT',
}

/**
 * JWT Payload structure
 * Content encoded in the JWT token (access and refresh)
 */
export interface JwtPayload {
  /** Subject: user ID (UUID) */
  sub: string;

  /** User email address */
  email: string;

  /** Tenant ID (institution UUID) */
  tenant_id: string;

  /** User role (ADMIN, INSTRUCTOR, STUDENT) */
  role: UserRole;

  /** Array of granular permissions (e.g., ['grades:read', 'grades:write']) */
  permissions: string[];

  /** Issued at timestamp (seconds since epoch) */
  iat?: number;

  /** Expiration timestamp (seconds since epoch) */
  exp?: number;
}

/**
 * Authenticated Request context
 * Populated by JWT strategy on successful authentication
 * Attached to Express Request object (req.user)
 */
export interface AuthenticatedUser {
  /** User ID (UUID) */
  id: string;

  /** User email address */
  email: string;

  /** Tenant ID (institution UUID) */
  tenant_id: string;

  /** User role */
  role: UserRole;

  /** User permissions */
  permissions: string[];
}

/**
 * Login Request DTO
 * Email and password for local authentication
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Auth Response DTO
 * Token pair returned after successful login
 */
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: {
    id: string;
    email: string;
    role: UserRole;
    tenant_id: string;
  };
}

/**
 * Token Claims with timing
 * Extended payload including timing info
 */
export interface TokenClaims extends JwtPayload {
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}

/**
 * Refresh Token Request
 * Sent via secure cookie or request body
 */
export interface RefreshTokenRequest {
  refresh_token?: string; // Optional: can be sent in body instead of cookie
}

/**
 * SSO User Info
 * Data returned from OAuth2 provider (Okta, Azure AD, etc.)
 */
export interface SsoUserInfo {
  /** External provider user ID */
  external_id: string;

  /** User email from provider */
  email: string;

  /** User display name from provider */
  name: string;

  /** OAuth2 provider name */
  provider: 'okta' | 'azure_ad' | 'google';

  /** Raw provider response (for debugging) */
  raw_data?: Record<string, any>;
}

/**
 * Permission set per role
 * Default permissions granted to each role
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: [
    'institution:admin',
    'users:manage',
    'settings:write',
    'audit_logs:read',
    'courses:create',
    'assignments:manage',
    'submissions:view',
    'grades:read',
    'grades:write',
    'grades:override',
    'plagiarism:view',
    'plagiarism:investigate',
    'analytics:read',
  ],

  [UserRole.INSTRUCTOR]: [
    'courses:create',
    'courses:read',
    'assignments:manage',
    'submissions:view',
    'grades:read',
    'grades:write',
    'grades:override',
    'plagiarism:view',
    'plagiarism:investigate',
    'analytics:read',
  ],

  [UserRole.STUDENT]: [
    'courses:view',
    'assignments:view',
    'submissions:create',
    'grades:view',
    'plagiarism:view',
  ],
};
