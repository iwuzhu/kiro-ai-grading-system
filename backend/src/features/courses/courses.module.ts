import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursesController } from './courses.controller';
import { Course } from '../../domain/entities/course.entity';
import { CourseEnrollment } from '../../domain/entities/course-enrollment.entity';
import { Assignment } from '../../domain/entities/assignment.entity';
import { CourseManagementService } from '../../domain/services/course-management.service';
import { CourseEnrollmentService } from '../../domain/services/course-enrollment.service';
import { AssignmentManagementService } from '../../domain/services/assignment-management.service';
import { CourseRepository } from '../../domain/repositories/course.repository';
import { CourseEnrollmentRepository } from '../../domain/repositories/course-enrollment.repository';
import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Course, CourseEnrollment, User, Assignment])],
  controllers: [CoursesController],
  providers: [
    CourseManagementService,
    CourseEnrollmentService,
    AssignmentManagementService,
    CourseRepository,
    CourseEnrollmentRepository,
    UserRepository,
  ],
  exports: [CourseManagementService, CourseEnrollmentService, AssignmentManagementService],
})
export class CoursesModule {}
