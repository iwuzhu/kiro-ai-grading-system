import { Injectable } from '@nestjs/common';

/**
 * Rubric Serializer Service
 * Serializes rubric data for API responses
 */
@Injectable()
export class RubricSerializerService {
  /**
   * Serialize rubric data for response
   */
  serialize(rubric: any): any {
    return rubric;
  }

  /**
   * Serialize multiple rubrics
   */
  serializeMany(rubrics: any[]): any[] {
    return rubrics.map(r => this.serialize(r));
  }
}
