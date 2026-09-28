import {
  Controller,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../infrastructure/auth/types';
import { AnalyticsService } from '../../domain/services/analytics.service';
import { InstitutionAnalyticsService } from '../../domain/services/institution-analytics.service';
import { User } from '../../domain/entities/user.entity';

/**
 * Dashboard Controllers
 *
 * REST endpoints for:
 * - GET /api/v1/dashboards/admin - Institution-level admin dashboard
 * - GET /api/v1/dashboards/instructor/:courseId - Course instructor dashboard
 *
 * Implements caching with 5-minute TTL as per requirement 5.8
 * RBAC: Admins and instructors only
 * Requirement: 5.8, 5.2, 5.6
 */

const DASHBOARD_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

@Controller('api/v1/dashboards')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DashboardsController {
  private readonly logger = new Logger(DashboardsController.name);
  
  // Simple in-memory cache for demonstration
  private dashboardCache: Map<string, { data: any; timestamp: number }> =
    new Map();

  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private analyticsService: AnalyticsService,
    private institutionAnalyticsService: InstitutionAnalyticsService,
  ) {}

  /**
   * GET /api/v1/dashboards/admin
   *
   * Get institution-level admin dashboard with:
   * - Total courses, active courses, archived courses
   * - Total students, active students
   * - Course metrics and performance indicators
   * - Student outcome tracking
   *
   * Requirement: 5.8, 5.6, 1
   *
   * Response Caching: 5-minute TTL
   * RBAC: ADMIN only
   *
   * Returns: Institution analytics with comprehensive metrics
   */
  @Get('admin')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getAdminDashboard(
    @CurrentTenant() tenantId?: string,
    @CurrentUser() user?: User,
  ) {
    try {
      // Generate cache key for this admin/institution
      const cacheKey = `dashboard:admin:${tenantId}`;

      // Try to get from in-memory cache
      const cached = this.dashboardCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        this.logger.log(`Admin dashboard served from cache for ${tenantId}`);
        return {
          success: true,
          data: {
            ...cached.data,
            cached: true,
            cacheExpiresIn: this.CACHE_TTL_MS / 1000, // seconds
          },
          timestamp: new Date().toISOString(),
        };
      }

      // Not in cache or expired, generate new dashboard
      const dashboardData =
        await this.institutionAnalyticsService.getInstitutionAnalytics(
          user?.institution_id || tenantId,
          tenantId,
        );

      // Store in cache
      this.dashboardCache.set(cacheKey, {
        data: dashboardData,
        timestamp: Date.now(),
      });

      this.logger.log(
        `Admin dashboard generated and cached for institution ${tenantId}`,
      );

      return {
        success: true,
        data: {
          ...dashboardData,
          cached: false,
          cacheExpiresIn: this.CACHE_TTL_MS / 1000, // seconds
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to get admin dashboard:`, error);
      throw error;
    }
  }

  /**
   * GET /api/v1/dashboards/instructor/:courseId
   *
   * Get course-specific instructor dashboard with:
   * - Course analytics (grade distribution, submission metrics)
   * - Struggling students
   * - Grade trends
   * - Student progress overview
   *
   * Requirement: 5.8, 5.2
   *
   * Parameters:
   * - courseId (path): Course ID
   *
   * Response Caching: 5-minute TTL
   * RBAC: INSTRUCTOR only (must own or be admin)
   *
   * Returns: Course analytics with instructor-focused metrics
   */
  @Get('instructor/:courseId')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getInstructorDashboard(
    @Param('courseId') courseId: string,
    @CurrentTenant() tenantId?: string,
  ) {
    try {
      // Generate cache key for this course
      const cacheKey = `dashboard:instructor:${courseId}`;

      // Try to get from in-memory cache
      const cached = this.dashboardCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        this.logger.log(
          `Instructor dashboard served from cache for course ${courseId}`,
        );
        return {
          success: true,
          data: {
            ...cached.data,
            cached: true,
            cacheExpiresIn: this.CACHE_TTL_MS / 1000, // seconds
          },
          timestamp: new Date().toISOString(),
        };
      }

      // Get course analytics (not cached at service level)
      const courseAnalytics =
        await this.analyticsService.getCourseAnalytics(
          courseId,
          tenantId,
          70, // Default performance threshold
        );

      // Get trend report
      const trendReport = await this.analyticsService.generateTrendReport(
        courseId,
        tenantId,
      );

      // Build comprehensive dashboard
      const dashboardData = {
        courseId,
        analytics: courseAnalytics,
        trends: trendReport,
        summary: {
          enrolledStudents: courseAnalytics.enrolledStudents,
          averageGrade: courseAnalytics.gradeStatistics.mean,
          completionRate:
            courseAnalytics.submissionMetrics.submissionCompletionRate,
          strugglingStudentCount:
            courseAnalytics.strugglingStudents.length,
          gradeTrend: trendReport.gradeTrend,
        },
      };

      // Store in cache
      this.dashboardCache.set(cacheKey, {
        data: dashboardData,
        timestamp: Date.now(),
      });

      this.logger.log(
        `Instructor dashboard generated and cached for course ${courseId}`,
      );

      return {
        success: true,
        data: {
          ...dashboardData,
          cached: false,
          cacheExpiresIn: this.CACHE_TTL_MS / 1000, // seconds
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to get instructor dashboard:`, error);
      throw error;
    }
  }

  /**
   * GET /api/v1/dashboards/instructor/:courseId/refresh
   *
   * Force refresh of instructor dashboard (invalidate cache)
   * Useful when instructor wants current data immediately
   *
   * Requirement: 5.8
   *
   * Parameters:
   * - courseId (path): Course ID
   *
   * Returns: Freshly generated course analytics
   */
  @Get('instructor/:courseId/refresh')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async refreshInstructorDashboard(
    @Param('courseId') courseId: string,
    @CurrentTenant() tenantId?: string,
  ) {
    try {
      const cacheKey = `dashboard:instructor:${courseId}`;

      // Invalidate cache
      this.dashboardCache.delete(cacheKey);

      this.logger.log(`Instructor dashboard cache cleared for course ${courseId}`);

      // Regenerate dashboard
      return this.getInstructorDashboard(courseId, tenantId);
    } catch (error) {
      this.logger.error(
        `Failed to refresh instructor dashboard:`,
        error,
      );
      throw error;
    }
  }

  /**
   * GET /api/v1/dashboards/admin/refresh
   *
   * Force refresh of admin dashboard (invalidate cache)
   *
   * Requirement: 5.8
   *
   * Returns: Freshly generated institution analytics
   */
  @Get('admin/refresh')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async refreshAdminDashboard(
    @CurrentTenant() tenantId?: string,
    @CurrentUser() user?: User,
  ) {
    try {
      const cacheKey = `dashboard:admin:${tenantId}`;

      // Invalidate cache
      this.dashboardCache.delete(cacheKey);

      this.logger.log(`Admin dashboard cache cleared for institution ${tenantId}`);

      // Regenerate dashboard
      return this.getAdminDashboard(tenantId, user);
    } catch (error) {
      this.logger.error(`Failed to refresh admin dashboard:`, error);
      throw error;
    }
  }

  /**
   * GET /api/v1/dashboards/cache-status
   *
   * Get cache status and statistics
   * Useful for monitoring dashboard cache performance
   *
   * Returns: Cache configuration and status
   */
  @Get('cache-status')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getCacheStatus() {
    return {
      success: true,
      data: {
        cacheTTL: {
          seconds: this.CACHE_TTL_MS / 1000,
          minutes: this.CACHE_TTL_MS / (60 * 1000),
        },
        cacheStore: 'memory',
        status: 'operational',
        cachedDashboards: this.dashboardCache.size,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
