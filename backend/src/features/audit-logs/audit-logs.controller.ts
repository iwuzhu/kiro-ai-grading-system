import {
  Controller,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuditLogsService } from '../../domain/services/audit-logs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';

/**
 * AuditLogs Controller
 *
 * Provides REST API endpoints for retrieving audit logs.
 * All endpoints are read-only (audit logs are immutable).
 * Requires 'audit_logs:read' permission (admin only by default).
 *
 * Endpoints (with global prefix 'api/v1'):
 * - GET /api/v1/audit-logs - Get paginated audit logs for tenant
 * - GET /api/v1/audit-logs?eventType=user_login - Filter by event type
 * - GET /api/v1/audit-logs?actor=userId - Filter by actor
 * - GET /api/v1/audit-logs/:id - Get single audit log
 * - GET /api/v1/audit-logs/stats - Get audit statistics
 */
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Permissions('audit_logs:read')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  /**
   * GET /v1/audit-logs
   * Get audit logs for the tenant with optional filtering
   *
   * Query Parameters:
   * - page: number (default: 1) - Page number
   * - limit: number (default: 50) - Records per page
   * - eventType: string - Filter by event type
   * - actor: string - Filter by actor user ID
   * - resource: string - Filter by resource type
   * - resourceId: string - Filter by resource ID
   * - startDate: ISO string - Filter by date range start
   * - endDate: ISO string - Filter by date range end
   *
   * Returns:
   * - data: AuditLog[] - Array of audit logs
   * - total: number - Total count of matching logs
   * - page: number - Current page
   * - limit: number - Records per page
   * - pages: number - Total pages
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAuditLogs(
    @CurrentTenant() tenantId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('eventType') eventType?: string,
    @Query('actor') actor?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));

    let result;

    // Route to appropriate filter method
    if (eventType) {
      result = await this.auditLogsService.getByEventType(tenantId, eventType, pageNum, limitNum);
    } else if (actor) {
      result = await this.auditLogsService.getByActor(tenantId, actor, pageNum, limitNum);
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      result = await this.auditLogsService.getByDateRange(tenantId, start, end, pageNum, limitNum);
    } else {
      // Default: return all audit logs for tenant
      result = await this.auditLogsService.getByTenant(tenantId, pageNum, limitNum);
    }

    // Transform snake_case to camelCase for frontend
    return {
      success: true,
      data: {
        data: result.data.map((log: any) => this.transformAuditLog(log)),
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages,
      },
    };
  }

  private transformAuditLog(log: any) {
    return {
      id: log.id,
      eventType: log.event_type,
      actorUserId: log.actor_user_id,
      resourceType: log.resource_type,
      resourceId: log.resource_id,
      actionDetails: log.action_details,
      ipAddress: log.ip_address,
      createdAt: log.created_at,
      tenantId: log.tenant_id,
    };
  }

  /**
   * GET /v1/audit-logs/stats
   * Get audit statistics for the tenant
   *
   * Returns:
   * - totalEvents: number - Total audit log entries
   * - eventTypes: Array<{eventType, count}> - Breakdown by event type
   * - topActors: Array<{actorUserId, count}> - Most active users
   * - oldestEvent: Date - Timestamp of oldest log
   * - newestEvent: Date - Timestamp of newest log
   */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getStatistics(@CurrentTenant() tenantId: string) {
    const stats = await this.auditLogsService.getStatistics(tenantId);
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * GET /v1/audit-logs/:id
   * Get a single audit log by ID
   *
   * Params:
   * - id: UUID - Audit log ID
   *
   * Returns:
   * - data: AuditLog - The audit log entry
   * - error: null
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getAuditLogById(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const auditLog = await this.auditLogsService.getById(id, tenantId);

    if (!auditLog) {
      return {
        success: false,
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Audit log not found',
        },
      };
    }

    return {
      success: true,
      data: this.transformAuditLog(auditLog),
    };
  }

}
