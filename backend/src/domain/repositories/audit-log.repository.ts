import { Injectable } from '@nestjs/common';
import { DataSource, Repository, Between, In } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

/**
 * AuditLog Repository
 *
 * Handles persistence of audit log entries.
 * Note: This repository supports APPEND-ONLY operations.
 * No update() or delete() methods are exposed to ensure immutability.
 *
 * All queries enforce tenant isolation via filtering on tenant_id.
 */
@Injectable()
export class AuditLogRepository {
  private readonly repository: Repository<AuditLog>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(AuditLog);
  }

  /**
   * Create a new audit log entry (append-only)
   *
   * @param tenantId - Tenant/institution ID for isolation
   * @param eventType - Type of event (e.g., 'grade_created', 'plagiarism_flagged')
   * @param actorUserId - User performing the action (null if system-triggered)
   * @param resourceType - Type of resource affected (e.g., 'grade', 'submission')
   * @param resourceId - ID of the affected resource
   * @param actionDetails - Event-specific details as JSONB
   * @param ipAddress - Client IP address (optional)
   * @returns The created audit log entry
   */
  async logEvent(
    tenantId: string,
    eventType: string,
    actorUserId: string | null,
    resourceType: string | null,
    resourceId: string | null,
    actionDetails: Record<string, any> | null,
    ipAddress: string | null = null,
  ): Promise<AuditLog> {
    const auditLog = this.repository.create({
      tenant_id: tenantId,
      event_type: eventType,
      actor_user_id: actorUserId,
      resource_type: resourceType,
      resource_id: resourceId,
      action_details: actionDetails,
      ip_address: ipAddress,
      created_at: new Date(),
    });

    return this.repository.save(auditLog);
  }

  /**
   * Find all audit logs for a tenant
   *
   * @param tenantId - Tenant/institution ID
   * @param skip - Number of records to skip (pagination)
   * @param take - Number of records to fetch (pagination)
   * @returns Array of audit logs ordered by most recent first
   */
  async findByTenant(
    tenantId: string,
    skip: number = 0,
    take: number = 50,
  ): Promise<[AuditLog[], number]> {
    return this.repository.findAndCount({
      where: { tenant_id: tenantId },
      order: { created_at: 'DESC' },
      skip,
      take,
    });
  }

  /**
   * Find audit logs by event type within a tenant
   *
   * @param tenantId - Tenant/institution ID
   * @param eventType - Type of event to filter by
   * @param skip - Number of records to skip (pagination)
   * @param take - Number of records to fetch (pagination)
   * @returns Array of audit logs matching the criteria
   */
  async findByEventType(
    tenantId: string,
    eventType: string,
    skip: number = 0,
    take: number = 50,
  ): Promise<[AuditLog[], number]> {
    return this.repository.findAndCount({
      where: { tenant_id: tenantId, event_type: eventType },
      order: { created_at: 'DESC' },
      skip,
      take,
    });
  }

  /**
   * Find audit logs by actor (user) within a tenant
   *
   * @param tenantId - Tenant/institution ID
   * @param actorUserId - User ID performing actions
   * @param skip - Number of records to skip (pagination)
   * @param take - Number of records to fetch (pagination)
   * @returns Array of audit logs for the specified actor
   */
  async findByActor(
    tenantId: string,
    actorUserId: string,
    skip: number = 0,
    take: number = 50,
  ): Promise<[AuditLog[], number]> {
    return this.repository.findAndCount({
      where: { tenant_id: tenantId, actor_user_id: actorUserId },
      order: { created_at: 'DESC' },
      skip,
      take,
    });
  }

  /**
   * Find audit logs by resource within a tenant
   *
   * @param tenantId - Tenant/institution ID
   * @param resourceType - Type of resource (e.g., 'grade', 'submission')
   * @param resourceId - ID of the resource
   * @param skip - Number of records to skip (pagination)
   * @param take - Number of records to fetch (pagination)
   * @returns Array of audit logs affecting the specified resource
   */
  async findByResource(
    tenantId: string,
    resourceType: string,
    resourceId: string,
    skip: number = 0,
    take: number = 50,
  ): Promise<[AuditLog[], number]> {
    return this.repository.findAndCount({
      where: { tenant_id: tenantId, resource_type: resourceType, resource_id: resourceId },
      order: { created_at: 'DESC' },
      skip,
      take,
    });
  }

  /**
   * Find audit logs within a date range (for compliance reports)
   *
   * @param tenantId - Tenant/institution ID
   * @param startDate - Start of date range
   * @param endDate - End of date range
   * @param skip - Number of records to skip (pagination)
   * @param take - Number of records to fetch (pagination)
   * @returns Array of audit logs within the date range
   */
  async findByDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    skip: number = 0,
    take: number = 50,
  ): Promise<[AuditLog[], number]> {
    return this.repository.findAndCount({
      where: {
        tenant_id: tenantId,
        created_at: Between(startDate, endDate),
      },
      order: { created_at: 'DESC' },
      skip,
      take,
    });
  }

  /**
   * Get audit log statistics for a tenant
   *
   * @param tenantId - Tenant/institution ID
   * @returns Statistics including total count and event type breakdown
   */
  async getStatistics(tenantId: string): Promise<{
    totalEvents: number;
    eventTypes: Array<{ eventType: string; count: number }>;
    topActors: Array<{ actorUserId: string; count: number }>;
    oldestEvent: Date;
    newestEvent: Date;
  }> {
    const totalEvents = await this.repository.count({ where: { tenant_id: tenantId } });

    const eventTypeStats = await this.repository.query(`
      SELECT event_type, COUNT(*) as count
      FROM grading.audit_logs
      WHERE tenant_id = $1
      GROUP BY event_type
      ORDER BY count DESC
    `, [tenantId]);

    const topActors = await this.repository.query(`
      SELECT actor_user_id, COUNT(*) as count
      FROM grading.audit_logs
      WHERE tenant_id = $1 AND actor_user_id IS NOT NULL
      GROUP BY actor_user_id
      ORDER BY count DESC
      LIMIT 10
    `, [tenantId]);

    const dateRange = await this.repository.query(`
      SELECT MIN(created_at) as oldest, MAX(created_at) as newest
      FROM grading.audit_logs
      WHERE tenant_id = $1
    `, [tenantId]);

    return {
      totalEvents,
      eventTypes: eventTypeStats.map((row: any) => ({
        eventType: row.event_type,
        count: parseInt(row.count),
      })),
      topActors: topActors.map((row: any) => ({
        actorUserId: row.actor_user_id,
        count: parseInt(row.count),
      })),
      oldestEvent: dateRange[0]?.oldest || new Date(),
      newestEvent: dateRange[0]?.newest || new Date(),
    };
  }

  /**
   * Find a single audit log by ID
   * Note: Primarily for read operations; audit logs cannot be modified
   *
   * @param id - Audit log ID
   * @param tenantId - Tenant/institution ID (for isolation verification)
   * @returns The audit log entry or null
   */
  async findById(id: string, tenantId: string): Promise<AuditLog | null> {
    return this.repository.findOne({
      where: { id, tenant_id: tenantId },
    });
  }

  /**
   * Export audit logs for compliance (FERPA/GDPR)
   * Returns audit logs in a standardized format for external reporting
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
    let query = this.repository.createQueryBuilder('audit')
      .where('audit.tenant_id = :tenantId', { tenantId })
      .andWhere('audit.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .orderBy('audit.created_at', 'DESC');

    if (eventTypes && eventTypes.length > 0) {
      query = query.andWhere('audit.event_type IN (:...eventTypes)', { eventTypes });
    }

    return query.getMany();
  }
}
