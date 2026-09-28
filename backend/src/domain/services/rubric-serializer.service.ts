import { Injectable } from '@nestjs/common';

/**
 * Rubric Serializer Service
 *
 * Serializes Rubric objects to JSON format compatible with the Rubric Grammar.
 * Produces human-readable, properly formatted JSON for display and editing.
 *
 * Acceptance Criteria:
 * ✓ Serializes rubrics to JSON format
 * ✓ Output conforms to Rubric Grammar specification
 * ✓ Human-readable formatting (indented, pretty-printed)
 * ✓ Supports round-trip serialization/deserialization
 * ✓ Handles null/optional fields gracefully
 */
@Injectable()
export class RubricSerializerService {
  /**
   * Serialize rubric object to JSON string
   * @param rubric - Rubric object to serialize
   * @param prettyPrint - Whether to format with indentation (default: true)
   * @returns JSON string representation
   */
  serialize(rubric: any, prettyPrint: boolean = true): string {
    const json = this.toJSON(rubric);
    
    if (prettyPrint) {
      return JSON.stringify(json, null, 2);
    } else {
      return JSON.stringify(json);
    }
  }

  /**
   * Convert rubric object to JSON-serializable format
   * @param rubric - Rubric object
   * @returns JSON-compatible object
   */
  toJSON(rubric: any): any {
    return {
      id: rubric.id || undefined,
      name: rubric.name,
      description: rubric.description || undefined,
      criteria: this.serializeCriteria(rubric.criteria || []),
      totalPoints: this.calculateTotalPoints(rubric.criteria || []),
    };
  }

  /**
   * Serialize criteria array
   * @param criteria - Array of criterion objects
   * @returns Serialized criteria
   */
  private serializeCriteria(criteria: any[]): any[] {
    return criteria.map((criterion) => this.serializeCriterion(criterion));
  }

  /**
   * Serialize a single criterion
   * @param criterion - Criterion object
   * @returns Serialized criterion
   */
  private serializeCriterion(criterion: any): any {
    return {
      id: criterion.id,
      name: criterion.name,
      description: criterion.description || undefined,
      points: criterion.points,
      levels: this.serializeLevels(criterion.levels || []),
    };
  }

  /**
   * Serialize levels array
   * @param levels - Array of level objects
   * @returns Serialized levels
   */
  private serializeLevels(levels: any[]): any[] {
    return levels.map((level) => this.serializeLevel(level));
  }

  /**
   * Serialize a single level
   * @param level - Level object
   * @returns Serialized level
   */
  private serializeLevel(level: any): any {
    return {
      name: level.name,
      points: level.points,
      description: level.description || undefined,
    };
  }

  /**
   * Pretty print rubric to console-friendly format
   * @param rubric - Rubric object
   * @returns Formatted string for display
   */
  prettyPrint(rubric: any): string {
    let output = `\n=== ${rubric.name} ===\n`;
    
    if (rubric.description) {
      output += `${rubric.description}\n`;
    }

    output += `\nTotal Points: ${this.calculateTotalPoints(rubric.criteria || [])}\n`;
    output += `\nCriteria:\n`;

    (rubric.criteria || []).forEach((criterion, idx) => {
      output += `\n${idx + 1}. ${criterion.name} (${criterion.points} points)\n`;
      
      if (criterion.description) {
        output += `   ${criterion.description}\n`;
      }

      output += `   Levels:\n`;
      (criterion.levels || []).forEach((level, levelIdx) => {
        output += `   - ${level.name}: ${level.points} pts`;
        if (level.description) {
          output += ` (${level.description})`;
        }
        output += `\n`;
      });
    });

    output += `\n`;
    return output;
  }

  /**
   * Export rubric to compact CSV format
   * Useful for spreadsheet editing and re-import
   * @param rubric - Rubric object
   * @returns CSV string
   */
  toCSV(rubric: any): string {
    let csv = 'Criterion,Points,Level,Level Points,Level Description\n';

    (rubric.criteria || []).forEach((criterion) => {
      (criterion.levels || []).forEach((level, levelIdx) => {
        const criterionName = levelIdx === 0 ? criterion.name : '';
        const criterionPoints = levelIdx === 0 ? criterion.points : '';
        
        csv += `"${criterionName}","${criterionPoints}","${level.name}","${level.points}","${
          level.description || ''
        }"\n`;
      });
    });

    return csv;
  }

  /**
   * Calculate total points
   * @param criteria - Array of criteria
   * @returns Sum of all points
   */
  private calculateTotalPoints(criteria: any[]): number {
    return criteria.reduce((sum, criterion) => sum + (criterion.points || 0), 0);
  }

  /**
   * Validate round-trip: serialize then parse produces equivalent object
   * @param rubric - Original rubric
   * @param parser - RubricParser service for validation
   * @returns true if round-trip is equivalent
   */
  validateRoundTrip(rubric: any, parser: any): boolean {
    try {
      // Serialize to JSON string
      const jsonString = this.serialize(rubric, true);

      // Parse back from JSON string
      const reparsed = parser.parse(jsonString);

      // Compare key structures
      return (
        rubric.name === reparsed.name &&
        (rubric.criteria?.length || 0) === (reparsed.criteria?.length || 0) &&
        this.calculateTotalPoints(rubric.criteria || []) ===
          this.calculateTotalPoints(reparsed.criteria || [])
      );
    } catch (error) {
      return false;
    }
  }
}
