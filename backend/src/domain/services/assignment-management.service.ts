import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Assignment } from '../entities/assignment.entity';

/**
 * Assignment Management Service
 * Handles business logic for assignment operations
 */
@Injectable()
export class AssignmentManagementService {
  constructor(
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>,
  ) {}

  /**
   * Create a new assignment
   */
  async createAssignment(
    tenantId: string,
    courseId: string,
    userId: string,
    assignmentData: any,
  ): Promise<Assignment> {
    const assignment = this.assignmentRepository.create({
      tenant_id: tenantId,
      course_id: courseId,
      created_by_user_id: userId,
      ...assignmentData,
    });
    const saved = await this.assignmentRepository.save(assignment);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  /**
   * Get assignments for a specific course
   */
  async getAssignmentsByCourse(
    tenantId: string,
    courseId: string,
    includeUnpublished: boolean = false,
  ): Promise<Assignment[]> {
    let query = this.assignmentRepository
      .createQueryBuilder('assignment')
      .where('assignment.tenant_id = :tenantId', { tenantId })
      .andWhere('assignment.course_id = :courseId', { courseId })
      .andWhere('assignment.deleted_at IS NULL');

    if (!includeUnpublished) {
      query = query.andWhere('assignment.published_at IS NOT NULL');
    }

    return query.orderBy('assignment.soft_deadline', 'ASC').getMany();
  }

  /**
   * Get assignment by ID
   */
  async getAssignment(tenantId: string, assignmentId: string): Promise<Assignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: {
        id: assignmentId,
        tenant_id: tenantId,
        deleted_at: null,
      },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment ${assignmentId} not found`);
    }

    return assignment;
  }

  /**
   * Update an assignment
   */
  async updateAssignment(
    tenantId: string,
    assignmentId: string,
    userId: string,
    updateData: any,
  ): Promise<Assignment> {
    const assignment = await this.getAssignment(tenantId, assignmentId);

    // Check if user is the creator or admin
    // (For now, just update - proper authorization should be in controller/guard)
    Object.assign(assignment, updateData);
    assignment.updated_at = new Date();

    const saved = await this.assignmentRepository.save(assignment);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  /**
   * Publish an assignment (make visible to students)
   */
  async publishAssignment(
    tenantId: string,
    assignmentId: string,
    userId: string,
  ): Promise<Assignment> {
    const assignment = await this.getAssignment(tenantId, assignmentId);

    assignment.published_at = new Date();
    assignment.published_by_user_id = userId;
    assignment.updated_at = new Date();

    const saved = await this.assignmentRepository.save(assignment);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  /**
   * Unpublish an assignment (hide from students)
   */
  async unpublishAssignment(
    tenantId: string,
    assignmentId: string,
    userId: string,
  ): Promise<Assignment> {
    const assignment = await this.getAssignment(tenantId, assignmentId);

    assignment.published_at = null;
    assignment.published_by_user_id = null;
    assignment.updated_at = new Date();

    const saved = await this.assignmentRepository.save(assignment);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  /**
   * Delete an assignment (soft delete)
   */
  async deleteAssignment(
    tenantId: string,
    assignmentId: string,
    userId: string,
  ): Promise<Assignment> {
    const assignment = await this.getAssignment(tenantId, assignmentId);

    assignment.deleted_at = new Date();
    assignment.updated_at = new Date();

    const saved = await this.assignmentRepository.save(assignment);
    return Array.isArray(saved) ? saved[0] : saved;
  }
}
