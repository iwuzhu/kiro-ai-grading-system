import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentsController } from './assignments.controller';
import { Assignment } from '../../domain/entities/assignment.entity';
import { Rubric } from '../../domain/entities/rubric.entity';
import { AssignmentManagementService } from '../../domain/services/assignment-management.service';
import { RubricParserService } from '../../domain/services/rubric-parser.service';
import { RubricSerializerService } from '../../domain/services/rubric-serializer.service';
import { RubricRepository } from '../../domain/repositories/rubric.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Assignment, Rubric])],
  controllers: [AssignmentsController],
  providers: [
    AssignmentManagementService,
    RubricParserService,
    RubricSerializerService,
    RubricRepository,
  ],
  exports: [AssignmentManagementService],
})
export class AssignmentsModule {}
