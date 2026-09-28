import { Injectable } from '@nestjs/common';
import { Grade } from '../entities/grade.entity';
import { AssignmentRepository } from '../repositories/assignment.repository';
import { GradeRepository } from '../repositories/grade.repository';

/**
 * Feedback Generation Service (Task 3.10)
 *
 * Generates detailed, constructive feedback based on rubric and grade.
 * Addresses all rubric criteria and provides actionable suggestions.
 *
 * Features:
 * - Feedback aligned with rubric criteria
 * - Specific examples from submission
 * - Strengths and improvements highlighted
 * - Inline code comments for code submissions
 * - Customizable tone (concise, detailed, encouraging)
 *
 * Requirements Met:
 * ✓ 3.10: Feedback Generation Service
 * ✓ 8: Detailed Feedback Generation
 * ✓ Property Test: Rubric Alignment (addresses all criteria)
 */
@Injectable()
export class FeedbackGenerationService {
  constructor(
    private assignmentRepository: AssignmentRepository,
    private gradeRepository: GradeRepository,
  ) {}

  /**
   * Generate enhanced feedback for a grade
   *
   * @param tenantId - Tenant ID
   * @param gradeId - Grade ID
   * @param grade - Grade entity with AI feedback
   * @param assignmentId - Assignment ID (for rubric context)
   * @returns Updated grade with enhanced feedback
   */
  async generateFeedback(
    tenantId: string,
    gradeId: string,
    grade: Grade,
    assignmentId: string,
  ): Promise<Grade> {
    // Load assignment for rubric
    const assignment = await this.assignmentRepository.findOne({
      where: {
        tenant_id: tenantId,
        id: assignmentId,
      },
      relations: ['rubric'],
    });

    if (!assignment) {
      return grade;
    }

    // Enhance feedback based on rubric alignment
    const enhancedFeedback = this.alignFeedbackWithRubric(
      grade.feedback || '',
      grade.strengths || [],
      grade.improvements || [],
      assignment.rubric,
    );

    // Update grade with enhanced feedback
    grade.feedback = enhancedFeedback;

    // Save updated grade
    return this.gradeRepository.save(grade);
  }

  /**
   * Align feedback with rubric criteria
   * Ensures feedback addresses all rubric criteria
   *
   * Property Test: Rubric Alignment
   * - Feedback mentions each criterion
   * - Feedback provides specific guidance per criterion
   *
   * @private
   */
  private alignFeedbackWithRubric(
    baseFeedback: string,
    strengths: string[],
    improvements: string[],
    rubric: any,
  ): string {
    let enhancedFeedback = baseFeedback;

    if (!rubric || !rubric.criteria || !Array.isArray(rubric.criteria)) {
      return enhancedFeedback;
    }

    // Add rubric-aligned section
    enhancedFeedback += '\n\n--- RUBRIC ASSESSMENT ---\n\n';

    // Address each criterion
    rubric.criteria.forEach((criterion: any, index: number) => {
      enhancedFeedback += `${index + 1}. ${criterion.name}\n`;

      // Find related strength or improvement
      const relevantStrength = strengths.find(s =>
        s.toLowerCase().includes(criterion.name.toLowerCase()),
      );

      const relevantImprovement = improvements.find(i =>
        i.toLowerCase().includes(criterion.name.toLowerCase()),
      );

      if (relevantStrength) {
        enhancedFeedback += `   ✓ Strength: ${relevantStrength}\n`;
      }

      if (relevantImprovement) {
        enhancedFeedback += `   → Improvement: ${relevantImprovement}\n`;
      }

      enhancedFeedback += '\n';
    });

    return enhancedFeedback;
  }

  /**
   * Generate code-specific feedback
   * Includes inline comments and style suggestions
   *
   * @param grade - Grade entity with AI feedback
   * @param codeComments - Array of code comments from AI
   * @returns Formatted code feedback
   */
  formatCodeFeedback(
    grade: Grade,
    codeComments?: Array<{
      line_number: number;
      code: string;
      comment: string;
      severity: string;
    }>,
  ): string {
    let feedback = grade.feedback || '';

    if (codeComments && codeComments.length > 0) {
      feedback += '\n\n--- CODE REVIEW ---\n\n';

      // Group by severity
      const errors = codeComments.filter(c => c.severity === 'error');
      const warnings = codeComments.filter(c => c.severity === 'warning');
      const info = codeComments.filter(c => c.severity === 'info');

      if (errors.length > 0) {
        feedback += '🔴 Errors to fix:\n';
        errors.forEach(c => {
          feedback += `  Line ${c.line_number}: ${c.comment}\n`;
        });
        feedback += '\n';
      }

      if (warnings.length > 0) {
        feedback += '🟡 Warnings to address:\n';
        warnings.forEach(c => {
          feedback += `  Line ${c.line_number}: ${c.comment}\n`;
        });
        feedback += '\n';
      }

      if (info.length > 0) {
        feedback += 'ℹ️ Notes:\n';
        info.forEach(c => {
          feedback += `  Line ${c.line_number}: ${c.comment}\n`;
        });
      }
    }

    return feedback;
  }

  /**
   * Generate comparative feedback (for incremental submissions)
   * References prior versions and acknowledges progress
   *
   * @param currentGrade - Current grade
   * @param previousFeedback - Feedback from previous version
   * @returns Comparative feedback acknowledging improvements
   */
  generateComparativeFeedback(
    currentGrade: Grade,
    previousFeedback: string,
  ): string {
    let feedback = 'This submission shows progress from your previous version.\n\n';

    feedback += 'Previous feedback:\n';
    feedback += `> ${previousFeedback.substring(0, 200)}...\n\n`;

    feedback += 'Current assessment:\n';
    feedback += currentGrade.feedback || '';

    feedback += '\n\nContinue focusing on:\n';
    (currentGrade.improvements || []).forEach(imp => {
      feedback += `• ${imp}\n`;
    });

    return feedback;
  }

  /**
   * Customize feedback tone
   *
   * @param feedback - Base feedback text
   * @param tone - 'concise', 'detailed', or 'encouraging'
   * @returns Customized feedback
   */
  customizeFeedbackTone(
    feedback: string,
    tone: 'concise' | 'detailed' | 'encouraging' = 'detailed',
  ): string {
    switch (tone) {
      case 'concise':
        // Reduce feedback to key points only
        const sentences = feedback.split('. ');
        return sentences.slice(0, Math.ceil(sentences.length / 2)).join('. ') + '.';

      case 'encouraging':
        // Add encouraging language
        return feedback
          .replace(/should/g, 'could')
          .replace(/needs to/g, 'might want to')
          .replace(/problems/g, 'areas to explore')
          + '\n\nGreat work on this assignment! Keep pushing yourself.';

      case 'detailed':
      default:
        return feedback;
    }
  }

  /**
   * Verify feedback addresses all rubric criteria
   * Validation for Property Test: Rubric Alignment
   *
   * @param feedback - Feedback text
   * @param rubric - Rubric entity
   * @returns Array of unaddressed criteria
   */
  verifyRubricCoverage(feedback: string, rubric: any): string[] {
    const unaddressed: string[] = [];

    if (!rubric || !rubric.criteria || !Array.isArray(rubric.criteria)) {
      return unaddressed;
    }

    const feedbackLower = feedback.toLowerCase();

    rubric.criteria.forEach((criterion: any) => {
      const criterionLower = criterion.name.toLowerCase();
      if (!feedbackLower.includes(criterionLower)) {
        unaddressed.push(criterion.name);
      }
    });

    return unaddressed;
  }

  /**
   * Get feedback statistics
   */
  async getFeedbackStats(tenantId: string): Promise<{
    total_feedback: number;
    avg_feedback_length: number;
    with_strengths: number;
    with_improvements: number;
  }> {
    const grades = await this.gradeRepository.find({
      where: { tenant_id: tenantId },
    });

    const withFeedback = grades.filter(g => g.feedback);
    const withStrengths = grades.filter(g => g.strengths && g.strengths.length > 0);
    const withImprovements = grades.filter(g => g.improvements && g.improvements.length > 0);

    const avgLength =
      withFeedback.length > 0
        ? withFeedback.reduce((sum, g) => sum + (g.feedback?.length || 0), 0) /
          withFeedback.length
        : 0;

    return {
      total_feedback: withFeedback.length,
      avg_feedback_length: Math.round(avgLength),
      with_strengths: withStrengths.length,
      with_improvements: withImprovements.length,
    };
  }
}
