import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentsController } from './assignments.controller';
import { Assignment } from '../../domain/entities/assignment.entity';
import { AssignmentManagementService } from '../../domain/services/assignment-management.service';
import { RubricParserService } from '../../domain/services/rubric-parser.service';
import { RubricSerializerService } from '../../domain/services/rubric-serializer.service';

@Module({
  imports: [TypeOrmModule.forFeature([Assignment])],
  controllers: [AssignmentsController],
  providers: [
    AssignmentManagementService,
    RubricParserService,
    RubricSerializerService,
  ],
  exports: [AssignmentManagementService],
})
export class AssignmentsModule {}
