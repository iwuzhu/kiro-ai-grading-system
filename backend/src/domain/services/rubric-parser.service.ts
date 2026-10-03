import { Injectable } from '@nestjs/common';

/**
 * Rubric Parser Service
 * Parses and validates rubric criteria structures
 */
@Injectable()
export class RubricParserService {
  /**
   * Parse rubric criteria from various formats
   */
  parseObject(criteria: any): any {
    if (typeof criteria === 'string') {
      try {
        return JSON.parse(criteria);
      } catch (e) {
        return criteria;
      }
    }
    return criteria;
  }

  /**
   * Parse rubric criteria from JSON string
   */
  parseJson(json: string): any {
    try {
      return JSON.parse(json);
    } catch (e) {
      throw new Error(`Invalid rubric JSON: ${e.message}`);
    }
  }
}
