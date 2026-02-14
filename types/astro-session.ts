/**
 * Astro Session Types
 *
 * Complete TypeScript interfaces for Astro-based session management
 * using HTTP-only cookies and Astro DB for authentication.
 */

import type { APIContext } from 'astro';

/**
 * User role types
 */
export type UserRole = 'Owner' | 'Admin' | 'Staff' | 'User';

/**
 * Admin level (is_admin field in database)
 * - 0: Regular user (default)
 * - 1: Owner (has ADMIN_EMAIL)
 * - 2: Staff
 * - 3: Admin
 */
export type AdminLevel = 0 | 1 | 2 | 3;

/**
 * Core user data stored in session
 */
export interface SessionUser {
  /** User UUID */
  id: string;

  /** User email address */
  email: string;

  /** Display username (nullable) */
  username: string | null;

  /** User bio/profile description (nullable) */
  bio: string | null;

  /** Avatar image URL (nullable) */
  avatar_url: string | null;

  /** Admin status: 0=user, 1=owner, 2=staff, 3=admin */
  is_admin: AdminLevel;
}

/**
 * Astro session data stored in HTTP-only cookie
 * Automatically managed by Astro using `context.cookies`
 */
export interface AstroSession {
  /** Authenticated user object (present if logged in) */
  user?: SessionUser;

  /** Session creation timestamp (milliseconds) */
  created_at?: number;

  /** Access token (if using OAuth/external auth) */
  access_token?: string;
}

/**
 * Extended user data for API responses
 */
export interface UserProfile extends SessionUser {
  /** User creation timestamp */
  created_at: number;

  /** User profile metadata */
  user_metadata: {
    name: string | null;
    bio: string | null;
    avatar_url: string | null;
  };

  /** User app metadata */
  app_metadata: {
    provider: 'email' | 'oauth';
    is_admin: AdminLevel;
    role: UserRole;
  };
}

/**
 * Authentication context for API routes
 * Includes both session and HTTP context
 */
export interface AuthContext {
  /** Astro API context */
  context: APIContext;

  /** Current session (may be null) */
  session: AstroSession | null;

  /** Current user (null if not authenticated) */
  user: SessionUser | null;

  /** Is user authenticated */
  isAuthenticated: boolean;

  /** Is user an admin */
  isAdmin: boolean;

  /** User's role */
  role: UserRole;

  /** Client IP address */
  clientIP: string;
}

/**
 * Login credentials for authentication
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Registration credentials
 */
export interface SignupCredentials extends LoginCredentials {
  username: string;
}

/**
 * Profile update data
 */
export interface ProfileUpdate {
  username?: string;
  bio?: string;
  age?: number;
  school?: string;
}

/**
 * Password change request
 */
export interface PasswordChange {
  currentPassword: string;
  newPassword: string;
}

/**
 * Session management function signatures
 */
export interface SessionManager {
  /**
   * Get current session from Astro context
   */
  getSession(context: APIContext): Promise<AstroSession | null>;

  /**
   * Get current authenticated user
   */
  getCurrentUser(context: APIContext): Promise<SessionUser | null>;

  /**
   * Create a new session for user
   */
  createSession(context: APIContext, user: SessionUser): Promise<void>;

  /**
   * Clear/destroy session
   */
  clearSession(context: APIContext): Promise<void>;

  /**
   * Check if user is authenticated
   */
  isAuthenticated(context: APIContext): Promise<boolean>;

  /**
   * Check if user is admin
   */
  isAdmin(context: APIContext): Promise<boolean>;

  /**
   * Get client IP address
   */
  getClientIP(context: APIContext): string;
}

/**
 * API response types
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiAuthResponse {
  user: UserProfile;
  message: string;
}

export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Cookie options for Astro sessions
 */
export interface SessionCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
  maxAge: number; // seconds
  path: string;
}

/**
 * Default session config
 */
export const DEFAULT_SESSION_CONFIG: SessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Lax',
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: '/'
};
