/**
 * Common Module - Shared utilities, decorators, guards, filters, and exceptions
 *
 * This module contains cross-cutting concerns that are used throughout the application:
 * - Custom exceptions for error handling
 * - Filters for standardizing error responses
 * - Decorators for route protection and metadata
 * - Guards for authorization and authentication
 * - Interceptors for request/response transformation
 * - Pipes for data validation and transformation
 */

export * from './exceptions';
export * from './filters';
export * from './decorators';
export * from './guards';
