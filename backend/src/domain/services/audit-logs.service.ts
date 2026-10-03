import { Injectable, Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditLogRepository } from '../repositories/audit-log.repository';

/**
 * AuditLogs Service
 *
 * Handles business logic for audit logging and compliance queries.
 * Provides a high-level interface for:
 * - Logging events (append-only)
 * - Retrieving audit logs for compliance
 * - Generating audit reports
 * - Ensuring immutability
 */
@Injectable()
export class AuditLogsService {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  /**
   * Log an audit event (append-only operation)
   *
   * @param tenantId - Tenant/institution ID
   * @param eventType - Type of event
   * @param actorUserId - User performing the action (null for system events)
   * @param resourceType - Type of resource affected
   * @param resourceId - ID of affected resource
   * @param actionDetails - Event-specific details
   * @param ipAddress - Client IP address
   * @returns Created audit log entry
   */
  async logEvent(
    tenantId: string,
    eventType: string,
    actorUserId: string | null = null,
    resourceType: string | null = null,
    resourceId: string | null = null,
    actionDetails: Record<string, any> | null = null,
    ipAddress: string | null = null,
  ): Promise<AuditLog> {
    return this.auditLogRepository.logEvent(
      tenantId,
      eventType,
      actorUserId,
      resourceType,
      resourceId,
      actionDetails,
      ipAddress,
    );
  }

  /**
   * Get all audit logs for a tenant with pagination
   *
   * @param tenantId - Tenant/institution ID
   * @param page - Page number (1-indexed)
   * @param limit - Records per page
   * @returns Paginated audit logs
   */
  async getByTenant(
    tenantId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{
    data: AuditLog[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.auditLogRepository.findByTenant(tenantId, skip, limit);

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get audit logs filtered by event type
   *
   * @param tenantId - Tenant/institution ID
   * @param eventType - Type of event to filter by
   * @param page - Page number (1-indexed)
   * @param limit - Records per page
   * @returns Filtered audit logs
   */
  async getByEventType(
    tenantId: string,
    eventType: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{
    data: AuditLog[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.auditLogRepository.findByEventType(
      tenantId,
      eventType,
      skip,
      limit,
    );

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get audit logs for a specific actor (user)
   *
   * @param tenantId - Tenant/institution ID
   * @param actorUserId - User ID to filter by
   * @param page - Page number (1-indexed)
   * @param limit - Records per page
   * @returns Actor's audit logs
   */
  async getByActor(
    tenantId: string,
    actorUserId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{
    data: AuditLog[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.auditLogRepository.findByActor(
      tenantId,
      actorUserId,
      skip,
      limit,
    );

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get audit logs for a specific resource
   *
   * @param tenantId - Tenant/institution ID
   * @param resourceType - Type of resource
   * @param resourceId - ID of resource
   * @param page - Page number (1-indexed)
   * @param limit - Records per page
   * @returns Resource's audit trail
   */
  async getByResource(
    tenantId: string,
    resourceType: string,
    resourceId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{
    data: AuditLog[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.auditLogRepository.findByResource(
      tenantId,
      resourceType,
      resourceId,
      skip,
      limit,
    );

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get audit logs within a date range (for compliance reports)
   *
   * @param tenantId - Tenant/institution ID
   * @param startDate - Start of date range
   * @param endDate - End of date range
   * @param page - Page number (1-indexed)
   * @param limit - Records per page
   * @returns Audit logs in date range
   */
  async getByDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    page: number = 1,
    limit: number = 50,
  ): Promise<{
    data: AuditLog[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.auditLogRepository.findByDateRange(
      tenantId,
      startDate,
      endDate,
      skip,
      limit,
    );

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get audit log statistics for compliance reporting
   *
   * @param tenantId - Tenant/institution ID
   * @returns Statistics including event type breakdown and actor activity
   */
  async getStatistics(tenantId: string): Promise<any> {
    return this.auditLogRepository.getStatistics(tenantId);
  }

  /**
   * Get a single audit log entry
   *
   * @param id - Audit log ID
   * @param tenantId - Tenant/institution ID (for isolation verification)
   * @returns The audit log entry
   */
  async getById(id: string, tenantId: string): Promise<AuditLog | null> {
    return this.auditLogRepository.findById(id, tenantId);
  }

  /**
   * Export audit logs for compliance (FERPA/GDPR)
   *
   * @param tenantId - Tenant/institution ID
   * @param startDate - Start of export range
   * @param endDate - End of export range
   * @param eventTypes - Optional filter by event types
   * @returns Array of audit logs formatted for export
   */
  async exportForCompliance(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    eventTypes?: string[],
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.exportForCompliance(
      tenantId,
      startDate,
      endDate,
      eventTypes,
    );
  }
}
