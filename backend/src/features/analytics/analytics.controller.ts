import {
  Controller,
  Get,
  Query,
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
import { GradebookQueryService, GradebookEntry } from '../../domain/services/gradebook-query.service';
import { AnalyticsService, CourseAnalytics } from '../../domain/services/analytics.service';
import { ExportService, ExportOptions } from '../../domain/services/export.service';
import { User } from '../../domain/entities/user.entity';

/**
 * Analytics Controller
 *
 * REST endpoints for:
 * - GET /api/v1/gradebook - Display gradebook with filtering/sorting
 * - GET /api/v1/analytics/course/:courseId - Course analytics
 * - GET /api/v1/analytics/export - Export gradebook (CSV/Excel/PDF)
 * - GET /api/v1/analytics/trends/:courseId - Grade trend reports
 *
 * RBAC: Instructors and admins only
 * Requirement: 5.4, 10.2, 10.6, 18.4
 */

@Controller('api/v1/analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(
    private gradebookQueryService: GradebookQueryService,
    private analyticsService: AnalyticsService,
    private exportService: ExportService,
  ) {}

  /**
   * GET /api/v1/analytics/gradebook?courseId=...&sortBy=name&filterByStatus=all
   *
   * Get gradebook for a course with filtering and sorting
   * Requirement: 10.2, 10.6, 18.1, 18.2, 18.6
   *
   * Query Parameters:
   * - courseId (required): Course ID
   * - sortBy: 'name' | 'grade' | 'completion' (default: 'name')
   * - sortOrder: 'ASC' | 'DESC' (default: 'ASC')
   * - filterByStatus: 'complete' | 'incomplete' | 'all' (default: 'all')
   * - skip: Number of entries to skip (default: 0)
   * - take: Number of entries to return (default: 50)
   *
   * Returns: Standard response with gradebook entries
   */
  @Get('gradebook')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getGradebook(
    @Query('courseId') courseId: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('filterByStatus') filterByStatus?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    try {
      const result = await this.gradebookQueryService.getGradebook({
        courseId,
        tenantId,
        sortBy: (sortBy as any) || 'name',
        sortOrder: (sortOrder as any) || 'ASC',
        filterByStatus: (filterByStatus as any) || 'all',
        skipCount: skip ? parseInt(skip, 10) : 0,
        takeCount: take ? parseInt(take, 10) : 50,
      });

      return {
        success: true,
        data: {
          gradebook: result.entries,
          pagination: {
            total: result.total,
            skip: skip ? parseInt(skip, 10) : 0,
            take: take ? parseInt(take, 10) : 50,
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to get gradebook:`, error);
      throw error;
    }
  }

  /**
   * GET /api/v1/analytics/course/:courseId
   *
   * Get comprehensive course analytics
   * Requirement: 10.3, 10.5, 10.6
   *
   * Parameters:
   * - courseId (path): Course ID
   * - performanceThreshold (query): Optional threshold for struggling students (default: 70)
   *
   * Returns: Course analytics with grade distribution, submission metrics, struggling students
   */
  @Get('course/:courseId')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getCourseAnalytics(
    @Param('courseId') courseId: string,
    @Query('threshold') threshold?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    try {
      const performanceThreshold = threshold ? parseInt(threshold, 10) : 70;

      const analytics = await this.analyticsService.getCourseAnalytics(
        courseId,
        tenantId,
        performanceThreshold,
      );

      return {
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to get course analytics:`, error);
      throw error;
    }
  }

  /**
   * GET /api/v1/analytics/trends/:courseId
   *
   * Get grade trend report for a course
   * Requirement: 10.6
   *
   * Parameters:
   * - courseId (path): Course ID
   *
   * Returns: Trend report with weekly grade progression
   */
  @Get('trends/:courseId')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getTrendReport(
    @Param('courseId') courseId: string,
    @CurrentTenant() tenantId?: string,
  ) {
    try {
      const report = await this.analyticsService.generateTrendReport(
        courseId,
        tenantId,
      );

      return {
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to get trend report:`, error);
      throw error;
    }
  }

  /**
   * GET /api/v1/analytics/export?courseId=...&format=csv&anonymize=false
   *
   * Export gradebook to CSV, Excel, or PDF
   * Requirement: 10.7, 18.4, 18.7, 19.6
   *
   * Query Parameters:
   * - courseId (required): Course ID
   * - format: 'csv' | 'excel' | 'pdf' (default: 'csv')
   * - includeStudentNames: 'true' | 'false' (default: 'true')
   * - gradeFormat: 'percentage' | 'letter' | 'gpa' (default: 'percentage')
   *
   * Returns: File buffer (CSV/Excel/PDF)
   */
  @Get('export')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async exportGradebook(
    @Query('courseId') courseId: string,
    @Query('format') format: string = 'csv',
    @Query('includeStudentNames') includeNames: string = 'true',
    @Query('gradeFormat') gradeFormat: string = 'percentage',
    @CurrentTenant() tenantId?: string,
  ) {
    try {
      const options: ExportOptions = {
        courseId,
        tenantId,
        format: (format as any) || 'csv',
        includeStudentNames: includeNames === 'true',
        gradeFormat: (gradeFormat as any) || 'percentage',
      };

      const buffer = await this.exportService.exportGradebook(options);

      // Return file with appropriate content type
      const contentType =
        format === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : format === 'pdf'
            ? 'application/pdf'
            : 'text/csv';

      const filename =
        format === 'excel'
          ? 'gradebook.xlsx'
          : format === 'pdf'
            ? 'gradebook.pdf'
            : 'gradebook.csv';

      return {
        success: true,
        data: {
          file: buffer.toString('base64'),
          contentType,
          filename,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to export gradebook:`, error);
      throw error;
    }
  }

  /**
   * GET /api/v1/analytics/student-progress/:courseId/:studentId
   *
   * Get detailed progress data for a specific student
   * Requirement: 10.1, 10.4
   *
   * Parameters:
   * - courseId (path): Course ID
   * - studentId (path): Student ID
   *
   * Returns: Student progress with grade trend
   */
  @Get('student-progress/:courseId/:studentId')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getStudentProgress(
    @Param('courseId') courseId: string,
    @Param('studentId') studentId: string,
    @CurrentTenant() tenantId?: string,
  ) {
    try {
      const progress = await this.gradebookQueryService.getStudentProgress(
        courseId,
        studentId,
        tenantId,
      );

      return {
        success: true,
        data: progress,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to get student progress:`, error);
      throw error;
    }
  }

  /**
   * GET /api/v1/analytics/struggling-students/:courseId
   *
   * Get list of struggling students for a course
   * Requirement: 10.5
   *
   * Parameters:
   * - courseId (path): Course ID
   * - threshold (query): Performance threshold (default: 70)
   *
   * Returns: List of students below threshold
   */
  @Get('struggling-students/:courseId')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getStrugglingStudents(
    @Param('courseId') courseId: string,
    @Query('threshold') threshold?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    try {
      const performanceThreshold = threshold ? parseInt(threshold, 10) : 70;

      const students =
        await this.gradebookQueryService.getStrugglingStudents(
          courseId,
          tenantId,
          performanceThreshold,
        );

      return {
        success: true,
        data: {
          students,
          count: students.length,
          threshold: performanceThreshold,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to get struggling students:`, error);
      throw error;
    }
  }

  /**
   * GET /api/v1/analytics/grade-distribution/:courseId
   *
   * Get grade distribution statistics for a course
   * Requirement: 10.3, 18.2
   *
   * Parameters:
   * - courseId (path): Course ID
   * - assignmentId (query): Optional specific assignment
   *
   * Returns: Distribution statistics (mean, median, quartiles, etc.)
   */
  @Get('grade-distribution/:courseId')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getGradeDistribution(
    @Param('courseId') courseId: string,
    @Query('assignmentId') assignmentId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    try {
      const distribution =
        await this.gradebookQueryService.getGradeDistribution(
          courseId,
          tenantId,
          assignmentId,
        );

      return {
        success: true,
        data: distribution,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to get grade distribution:`, error);
      throw error;
    }
  }

  /**
   * GET /api/v1/analytics/export-formats
   *
   * Get available export formats and grade formats
   *
   * Returns: List of supported formats
   */
  @Get('export-formats')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  getExportFormats() {
    return {
      success: true,
      data: {
        exportFormats: this.exportService.getAvailableExportFormats(),
        gradeFormats: this.exportService.getAvailableGradeFormats(),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
