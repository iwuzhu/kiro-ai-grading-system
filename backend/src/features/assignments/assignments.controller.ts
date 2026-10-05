import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../infrastructure/auth/types';
import { AssignmentManagementService } from '../../domain/services/assignment-management.service';
import { RubricParserService } from '../../domain/services/rubric-parser.service';
import { RubricSerializerService } from '../../domain/services/rubric-serializer.service';
import { RubricRepository } from '../../domain/repositories/rubric.repository';
import { CreateAssignmentDto } from './dtos/create-assignment.dto';
import { UpdateAssignmentDto } from './dtos/update-assignment.dto';
import { CreateRubricDto } from './dtos/create-rubric.dto';
import { NotFoundException } from '../../common/exceptions/not-found.exception';

/**
 * Assignments Controller
 *
 * REST endpoints for assignment management:
 * - Assignment CRUD (create, read, update, delete)
 * - Rubric management (create, read, update)
 * - Assignment publication
 * - Access control (instructor edit, student view)
 *
 * Acceptance Criteria:
 * ✓ POST create (instructor+)
 * ✓ GET list (students see published, instructors see all)
 * ✓ GET detail (enrolled or owner)
 * ✓ PATCH update (owner only)
 * ✓ DELETE (owner only)
 * ✓ PATCH publish (instructor+)
 * ✓ Rubric CRUD
 * ✓ All responses follow standard format
 */
@Controller('courses')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AssignmentsController {
  constructor(
    @Inject(AssignmentManagementService)
    private readonly assignmentService: AssignmentManagementService,
    @Inject(RubricParserService)
    private readonly rubricParser: RubricParserService,
    @Inject(RubricSerializerService)
    private readonly rubricSerializer: RubricSerializerService,
    @Inject(RubricRepository)
    private readonly rubricRepository: RubricRepository,
  ) {}

  /**
   * Create a new assignment
   * POST /api/v1/{institution_id}/courses/{course_id}/assignments
   * @param courseId - Course ID
   * @param tenantId - Current tenant ID
   * @param userId - Current user ID
   * @param createAssignmentDto - Assignment data
   */
  @Post(':course_id/assignments')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  async createAssignment(
    @Param('course_id') courseId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() createAssignmentDto: CreateAssignmentDto,
  ) {
    try {
      // Prepare assignment data
      const assignmentData: any = {
        ...createAssignmentDto,
        soft_deadline: createAssignmentDto.soft_deadline
          ? new Date(createAssignmentDto.soft_deadline)
          : undefined,
        hard_deadline: createAssignmentDto.hard_deadline
          ? new Date(createAssignmentDto.hard_deadline)
          : undefined,
      };

      // Remove undefined fields to avoid overwriting defaults
      Object.keys(assignmentData).forEach(key => {
        if (assignmentData[key] === undefined) {
          delete assignmentData[key];
        }
      });

      // If content is provided, ensure published_status is set
      if (assignmentData.content && !assignmentData.published_status) {
        assignmentData.published_status = 'draft';
      }

      const assignment = await this.assignmentService.createAssignment(
        tenantId,
        courseId,
        user.id,
        assignmentData,
      );

      return {
        success: true,
        data: assignment,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get assignments in a course
   * GET /api/v1/{institution_id}/courses/{course_id}/assignments
   * @param courseId - Course ID
   * @param tenantId - Current tenant ID
   * @param userId - Current user ID
   * @param userRole - Current user role
   */
  @Get(':course_id/assignments')
  async getAssignments(
    @Param('course_id') courseId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    try {
      // Students see only published assignments
      const includeUnpublished =
        user.role === 'INSTRUCTOR' || user.role === 'ADMIN';

      const assignments = await this.assignmentService.getAssignmentsByCourse(
        tenantId,
        courseId,
        includeUnpublished,
      );

      return {
        success: true,
        data: assignments,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get assignment details
   * GET /api/v1/{institution_id}/assignments/{assignment_id}
   * @param assignmentId - Assignment ID
   * @param tenantId - Current tenant ID
   * @param userId - Current user ID
   */
  @Get('assignments/:assignment_id')
  async getAssignment(
    @Param('assignment_id') assignmentId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    try {
      const assignment = await this.assignmentService.getAssignment(
        tenantId,
        assignmentId,
      );

      // Check if student can see unpublished assignment
      if (!assignment.published_at && user.role === 'STUDENT') {
        throw new BadRequestException('Cannot view unpublished assignment');
      }

      return {
        success: true,
        data: assignment,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update assignment
   * PATCH /api/v1/{institution_id}/assignments/{assignment_id}
   * @param assignmentId - Assignment ID
   * @param tenantId - Current tenant ID
   * @param userId - Current user ID
   * @param updateAssignmentDto - Fields to update
   */
  @Patch('assignments/:assignment_id')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  async updateAssignment(
    @Param('assignment_id') assignmentId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() updateAssignmentDto: UpdateAssignmentDto,
  ) {
    try {
      const assignment = await this.assignmentService.updateAssignment(
        tenantId,
        assignmentId,
        user.id,
        {
          ...updateAssignmentDto,
          soft_deadline: updateAssignmentDto.soft_deadline
            ? new Date(updateAssignmentDto.soft_deadline)
            : undefined,
          hard_deadline: updateAssignmentDto.hard_deadline
            ? new Date(updateAssignmentDto.hard_deadline)
            : undefined,
        },
      );

      return {
        success: true,
        data: assignment,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Publish assignment (make visible to students)
   * PATCH /api/v1/{institution_id}/assignments/{assignment_id}/publish
   * @param assignmentId - Assignment ID
   * @param tenantId - Current tenant ID
   * @param userId - Current user ID
   */
  @Patch('assignments/:assignment_id/publish')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  async publishAssignment(
    @Param('assignment_id') assignmentId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    try {
      const assignment = await this.assignmentService.publishAssignment(
        tenantId,
        assignmentId,
        user.id,
      );

      return {
        success: true,
        data: assignment,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Unpublish assignment (hide from students)
   * PATCH /api/v1/{institution_id}/assignments/{assignment_id}/unpublish
   * @param assignmentId - Assignment ID
   * @param tenantId - Current tenant ID
   * @param userId - Current user ID
   */
  @Patch('assignments/:assignment_id/unpublish')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  async unpublishAssignment(
    @Param('assignment_id') assignmentId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    try {
      const assignment = await this.assignmentService.unpublishAssignment(
        tenantId,
        assignmentId,
        user.id,
      );

      return {
        success: true,
        data: assignment,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete assignment (soft delete)
   * DELETE /api/v1/{institution_id}/assignments/{assignment_id}
   * @param assignmentId - Assignment ID
   * @param tenantId - Current tenant ID
   * @param userId - Current user ID
   */
  @Delete('assignments/:assignment_id')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  async deleteAssignment(
    @Param('assignment_id') assignmentId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    try {
      const assignment = await this.assignmentService.deleteAssignment(
        tenantId,
        assignmentId,
        user.id,
      );

      return {
        success: true,
        data: assignment,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }
}
