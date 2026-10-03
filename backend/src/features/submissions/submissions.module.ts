import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubmissionsController } from './submissions.controller';
import { Submission } from '../../domain/entities/submission.entity';
import { Assignment } from '../../domain/entities/assignment.entity';
import { Grade } from '../../domain/entities/grade.entity';
import { SubmissionManagementService } from '../../domain/services/submission-management.service';
import { SubmissionRepository } from '../../domain/repositories/submission.repository';
import { AssignmentRepository } from '../../domain/repositories/assignment.repository';
import { GradeRepository } from '../../domain/repositories/grade.repository';
import { S3Service } from '../../infrastructure/storage/s3.service';

@Module({
  imports: [TypeOrmModule.forFeature([Submission, Assignment, Grade])],
  controllers: [SubmissionsController],
  providers: [
    SubmissionManagementService,
    SubmissionRepository,
    AssignmentRepository,
    GradeRepository,
    S3Service,
  ],
  exports: [SubmissionManagementService, SubmissionRepository, GradeRepository],
})
export class SubmissionsModule {}
