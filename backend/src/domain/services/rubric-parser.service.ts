import { Injectable, BadRequestException } from '@nestjs/common';

/**
 * Rubric Parser Service
 *
 * Parses JSON rubric files into Rubric objects according to the Rubric Grammar.
 * Validates rubric structure and provides detailed error messages for invalid files.
 *
 * Rubric Grammar:
 * - id: UUID
 * - name: string (required)
 * - criteria: array of criterion objects
 *   - id: string (required)
 *   - name: string (required)
 *   - description: string (optional)
 *   - points: number (required, > 0)
 *   - levels: array of level objects
 *     - name: string (required)
 *     - points: number (required, <= criterion.points)
 *     - description: string (optional)
 *
 * Acceptance Criteria:
 * ✓ Parses valid JSON rubrics
 * ✓ Returns descriptive error messages for invalid rubrics
 * ✓ Validates required fields
 * ✓ Validates field types
 * ✓ Validates numeric constraints
 * ✓ Supports round-trip serialization/deserialization
 */
@Injectable()
export class RubricParserService {
  /**
   * Parse JSON string into rubric object
   * @param jsonString - JSON string representation of rubric
   * @returns Parsed rubric object
   * @throws BadRequestException if JSON is invalid
   */
  parse(jsonString: string): any {
    try {
      const json = JSON.parse(jsonString);
      return this.validateRubric(json);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new BadRequestException(
          `Invalid JSON: ${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Parse JSON object into rubric object
   * @param json - JSON object representation of rubric
   * @returns Parsed and validated rubric object
   * @throws BadRequestException if rubric is invalid
   */
  parseObject(json: any): any {
    return this.validateRubric(json);
  }

  /**
   * Validate rubric structure and content
   * @param rubric - Rubric object to validate
   * @returns Validated rubric object
   * @throws BadRequestException if validation fails
   */
  private validateRubric(rubric: any): any {
    // Validate rubric is an object
    if (!rubric || typeof rubric !== 'object') {
      throw new BadRequestException('Rubric must be a JSON object');
    }

    // Validate name
    if (!rubric.name || typeof rubric.name !== 'string') {
      throw new BadRequestException('Rubric name is required and must be a string');
    }

    if (rubric.name.trim().length === 0) {
      throw new BadRequestException('Rubric name cannot be empty');
    }

    // Validate description (optional)
    if (rubric.description && typeof rubric.description !== 'string') {
      throw new BadRequestException('Rubric description must be a string if provided');
    }

    // Validate criteria
    if (!Array.isArray(rubric.criteria)) {
      throw new BadRequestException('Criteria must be an array');
    }

    if (rubric.criteria.length === 0) {
      throw new BadRequestException('Rubric must have at least one criterion');
    }

    // Validate each criterion
    const validatedCriteria = rubric.criteria.map((criterion, index) => {
      return this.validateCriterion(criterion, index);
    });

    return {
      id: rubric.id || null,
      name: rubric.name.trim(),
      description: rubric.description?.trim() || null,
      criteria: validatedCriteria,
      totalPoints: this.calculateTotalPoints(validatedCriteria),
    };
  }

  /**
   * Validate a single criterion
   * @param criterion - Criterion object
   * @param index - Index in criteria array (for error messages)
   * @returns Validated criterion
   * @throws BadRequestException if invalid
   */
  private validateCriterion(criterion: any, index: number): any {
    const prefix = `Criterion ${index + 1}:`;

    // Validate criterion is an object
    if (!criterion || typeof criterion !== 'object') {
      throw new BadRequestException(`${prefix} must be an object`);
    }

    // Validate id
    if (!criterion.id || typeof criterion.id !== 'string') {
      throw new BadRequestException(`${prefix} id is required and must be a string`);
    }

    // Validate name
    if (!criterion.name || typeof criterion.name !== 'string') {
      throw new BadRequestException(`${prefix} name is required and must be a string`);
    }

    if (criterion.name.trim().length === 0) {
      throw new BadRequestException(`${prefix} name cannot be empty`);
    }

    // Validate points
    if (typeof criterion.points !== 'number' || criterion.points <= 0) {
      throw new BadRequestException(
        `${prefix} points must be a positive number`,
      );
    }

    // Validate description (optional)
    if (criterion.description && typeof criterion.description !== 'string') {
      throw new BadRequestException(`${prefix} description must be a string if provided`);
    }

    // Validate levels
    if (!Array.isArray(criterion.levels)) {
      throw new BadRequestException(`${prefix} levels must be an array`);
    }

    if (criterion.levels.length === 0) {
      throw new BadRequestException(`${prefix} must have at least one level`);
    }

    const validatedLevels = criterion.levels.map((level, levelIndex) => {
      return this.validateLevel(level, index, levelIndex, criterion.points);
    });

    return {
      id: criterion.id,
      name: criterion.name.trim(),
      description: criterion.description?.trim() || null,
      points: criterion.points,
      levels: validatedLevels,
    };
  }

  /**
   * Validate a single performance level
   * @param level - Level object
   * @param criterionIndex - Index of parent criterion (for error messages)
   * @param levelIndex - Index in levels array (for error messages)
   * @param maxPoints - Maximum points for this criterion
   * @returns Validated level
   * @throws BadRequestException if invalid
   */
  private validateLevel(
    level: any,
    criterionIndex: number,
    levelIndex: number,
    maxPoints: number,
  ): any {
    const prefix = `Criterion ${criterionIndex + 1}, Level ${levelIndex + 1}:`;

    // Validate level is an object
    if (!level || typeof level !== 'object') {
      throw new BadRequestException(`${prefix} must be an object`);
    }

    // Validate name
    if (!level.name || typeof level.name !== 'string') {
      throw new BadRequestException(`${prefix} name is required and must be a string`);
    }

    if (level.name.trim().length === 0) {
      throw new BadRequestException(`${prefix} name cannot be empty`);
    }

    // Validate points
    if (typeof level.points !== 'number' || level.points < 0) {
      throw new BadRequestException(
        `${prefix} points must be a non-negative number`,
      );
    }

    if (level.points > maxPoints) {
      throw new BadRequestException(
        `${prefix} points (${level.points}) cannot exceed criterion points (${maxPoints})`,
      );
    }

    // Validate description (optional)
    if (level.description && typeof level.description !== 'string') {
      throw new BadRequestException(`${prefix} description must be a string if provided`);
    }

    return {
      name: level.name.trim(),
      points: level.points,
      description: level.description?.trim() || null,
    };
  }

  /**
   * Calculate total points across all criteria
   * @param criteria - Array of validated criteria
   * @returns Sum of all criterion points
   */
  private calculateTotalPoints(criteria: any[]): number {
    return criteria.reduce((sum, criterion) => sum + criterion.points, 0);
  }
}
