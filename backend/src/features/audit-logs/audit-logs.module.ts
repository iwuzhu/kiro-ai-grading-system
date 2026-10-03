import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../../domain/entities/audit-log.entity';
import { AuditLogsService } from '../../domain/services/audit-logs.service';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogRepository } from '../../domain/repositories/audit-log.repository';

/**
 * AuditLogs Module
 *
 * Provides REST API endpoints for reading audit logs.
 * All operations are read-only (audit logs are immutable).
 *
 * Exports:
 * - AuditLogsService: For logging events from other services
 * - AuditLogRepository: For querying audit logs
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditLogsController],
  providers: [AuditLogsService, AuditLogRepository],
  exports: [AuditLogsService, AuditLogRepository],
})
export class AuditLogsModule {}
