/**
 * Root Application Module
 *
 * Configures core modules:
 * - Database (PostgreSQL via TypeORM)
 * - Configuration
 * - Authentication & JWT
 * - Features (Audit Logs, etc.)
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Infrastructure modules
import { DatabaseModule } from './infrastructure/database/database.module';
import { AuthModule } from './infrastructure/auth/auth.module';

// Feature modules
import { AuditLogsModule } from './features/audit-logs/audit-logs.module';
import { UsersModule } from './features/users/users.module';
import { InstitutionsModule } from './features/institutions/institutions.module';
import { CoursesModule } from './features/courses/courses.module';
import { AssignmentsModule } from './features/assignments/assignments.module';
import { SubmissionsModule } from './features/submissions/submissions.module';
import { GradingModule } from './features/grading/grading.module';
import { FilesModule } from './features/files/files.module';

// Common (filters, guards, interceptors)
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { APP_FILTER } from '@nestjs/core';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '.env.example'],
    }),

    // Database
    DatabaseModule,

    // Authentication
    AuthModule,

    // Features
    AuditLogsModule,
    UsersModule,
    InstitutionsModule,
    CoursesModule,
    AssignmentsModule,
    SubmissionsModule,
    GradingModule,
    FilesModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
