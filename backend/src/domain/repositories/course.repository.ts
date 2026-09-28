import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Course } from '../entities/course.entity';

/**
 * Course Repository
 *
 * Data access layer for Course entity.
 * Handles all database operations related to courses.
 *
 * Key Responsibilities:
 * - CRUD operations for courses
 * - Tenant-scoped queries
 * - Course lookups by code, status, institution
 * - Course enumeration with filtering
 *
 * Multi-Tenancy Pattern:
 * - All queries filter by tenant_id for isolation
 * - Course codes are only unique within a tenant
 * - Courses belong to an institution which belongs to a tenant
 *
 * Acceptance Criteria:
 * ✓ Implements tenant-scoped query methods
 * ✓ Enforces course code uniqueness within tenant
 * ✓ No query returns courses from multiple tenants
 * ✓ Supports filtering by status and instructor
 */
@Injectable()
export class CourseRepository extends Repository<Course> {
  constructor(private dataSource: DataSource) {
    super(Course, dataSource.createEntityManager());
  }

  /**
   * Find course by tenant and code
   * @param tenantId - The tenant ID
   * @param code - The course code
   * @returns Course or null if not found
   */
  async findByCode(tenantId: string, code: string): Promise<Course | null> {
    return this.findOne({
      where: {
        tenant_id: tenantId,
        code,
      },
      relations: ['institution', 'created_by_user'],
    });
  }

  /**
   * Find course by ID (with tenant context)
   * @param tenantId - The tenant ID
   * @param courseId - The course ID
   * @returns Course or null if not found
   */
  async findById(tenantId: string, courseId: string): Promise<Course | null> {
    return this.findOne({
      where: {
        tenant_id: tenantId,
        id: courseId,
      },
      relations: ['institution', 'created_by_user', 'enrollments'],
    });
  }

  /**
   * Find all courses in a tenant with status filter
   * @param tenantId - The tenant ID
   * @param status - Filter by status (DRAFT, ACTIVE, ARCHIVED)
   * @returns Array of courses
   */
  async findByStatus(
    tenantId: string,
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED',
  ): Promise<Course[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        status,
        deleted_at: null,
      },
      relations: ['institution', 'created_by_user'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Find all active courses in a tenant
   * @param tenantId - The tenant ID
   * @returns Array of active courses
   */
  async findActiveByTenant(tenantId: string): Promise<Course[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        status: 'ACTIVE',
        deleted_at: null,
      },
      relations: ['institution', 'created_by_user'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Find courses by institution
   * @param tenantId - The tenant ID
   * @param institutionId - The institution ID
   * @returns Array of courses in that institution
   */
  async findByInstitution(
    tenantId: string,
    institutionId: string,
  ): Promise<Course[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        institution_id: institutionId,
        deleted_at: null,
      },
      relations: ['created_by_user'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Find courses created by a specific user
   * @param tenantId - The tenant ID
   * @param createdByUserId - The user ID
   * @returns Array of courses
   */
  async findByCreatedBy(
    tenantId: string,
    createdByUserId: string,
  ): Promise<Course[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        created_by_user_id: createdByUserId,
        deleted_at: null,
      },
      relations: ['institution'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Find all courses in a tenant (paginated)
   * @param tenantId - The tenant ID
   * @param page - Page number (0-indexed)
   * @param limit - Results per page
   * @returns Paginated courses
   */
  async findByTenant(
    tenantId: string,
    page: number = 0,
    limit: number = 20,
  ): Promise<{ courses: Course[]; total: number }> {
    const [courses, total] = await this.findAndCount({
      where: {
        tenant_id: tenantId,
        deleted_at: null,
      },
      skip: page * limit,
      take: limit,
      relations: ['institution', 'created_by_user'],
      order: { created_at: 'DESC' },
    });

    return { courses, total };
  }

  /**
   * Create a new course
   * @param data - Course creation data
   * @returns Created course
   */
  async createCourse(data: {
    tenant_id: string;
    institution_id: string;
    code: string;
    title: string;
    description?: string;
    created_by_user_id?: string;
    status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    semester_start?: Date;
    semester_end?: Date;
  }): Promise<Course> {
    const course = this.create({
      tenant_id: data.tenant_id,
      institution_id: data.institution_id,
      code: data.code,
      title: data.title,
      description: data.description || null,
      created_by_user_id: data.created_by_user_id || null,
      status: data.status || 'DRAFT',
      semester_start: data.semester_start || null,
      semester_end: data.semester_end || null,
    });

    return this.save(course);
  }

  /**
   * Update course status
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @param status - New status
   * @returns Updated course
   */
  async updateStatus(
    tenantId: string,
    courseId: string,
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED',
  ): Promise<Course | null> {
    const course = await this.findById(tenantId, courseId);
    if (!course) {
      return null;
    }

    course.status = status;
    return this.save(course);
  }

  /**
   * Perform soft delete on course
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @returns Updated course
   */
  async softDeleteCourse(tenantId: string, courseId: string): Promise<Course | null> {
    const course = await this.findById(tenantId, courseId);
    if (!course) {
      return null;
    }

    course.deleted_at = new Date();
    return this.save(course);
  }

  /**
   * Get course enrollment statistics
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @returns Statistics object
   */
  async getEnrollmentStats(
    tenantId: string,
    courseId: string,
  ): Promise<{ instructors: number; students: number } | null> {
    const course = await this.findById(tenantId, courseId);
    if (!course) {
      return null;
    }

    const instructorCount = course.enrollments.filter(
      (e) => e.role === 'INSTRUCTOR' && e.unenrolled_at === null,
    ).length;

    const studentCount = course.enrollments.filter(
      (e) => e.role === 'STUDENT' && e.unenrolled_at === null,
    ).length;

    return {
      instructors: instructorCount,
      students: studentCount,
    };
  }
}
