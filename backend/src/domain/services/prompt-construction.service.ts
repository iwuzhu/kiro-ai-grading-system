import { Injectable } from '@nestjs/common';
import { Rubric } from '../entities/rubric.entity';

/**
 * Prompt Construction Service (Task 3.6)
 *
 * Builds structured prompts for AI grading based on assignment type and rubric.
 * Generates prompts optimized for different AI providers (OpenAI, Anthropic, Bedrock).
 *
 * Assignment Types:
 * - ESSAY: Written essays and prose submissions
 * - CODE: Source code submissions with style/correctness focus
 * - QUIZ: Multiple choice and short answer quizzes
 * - SHORT_ANSWER: Brief written responses
 * - FILE: Generic file submissions
 *
 * Requirements Met:
 * ✓ 3.6: Prompt Construction Service
 * ✓ 7: AI Grading Engine support
 * ✓ Build rubric-based prompts for AI grading
 */
@Injectable()
export class PromptConstructionService {
  /**
   * Build a grading prompt for AI provider
   *
   * @param assignmentDescription - Assignment description and context
   * @param assignmentType - Type of assignment (ESSAY, CODE, etc.)
   * @param rubric - Grading rubric with criteria
   * @param submission - Student submission text/code
   * @param submissionFormat - Format of submission (for code: python, javascript, etc.)
   * @returns Constructed prompt optimized for AI grading
   */
  buildGradingPrompt(
    assignmentDescription: string,
    assignmentType: string,
    rubric: Rubric | string,
    submission: string,
    submissionFormat?: string,
  ): string {
    const rubricText = this.formatRubric(rubric);
    const typeSpecificContext = this.getTypeSpecificContext(assignmentType, submissionFormat);

    return `${typeSpecificContext}

ASSIGNMENT DESCRIPTION:
${assignmentDescription}

GRADING RUBRIC:
${rubricText}

STUDENT SUBMISSION:
${submission}

GRADING INSTRUCTIONS:
1. Evaluate the submission against each criterion in the rubric
2. Provide a numerical score from 0-100
3. Assign a confidence level (0-100) indicating your certainty
4. Provide detailed, constructive feedback
5. Identify specific strengths and areas for improvement

RESPONSE FORMAT:
Return a JSON object with this structure:
{
  "score": <number 0-100>,
  "confidence": <number 0-100>,
  "feedback": "<detailed feedback explaining the grade>",
  "strengths": ["<strength1>", "<strength2>", ...],
  "improvements": ["<improvement1>", "<improvement2>", ...]
}

Grade fairly and objectively based on the rubric.`;
  }

  /**
   * Build a code review prompt for code submissions
   * Focuses on code quality, style, and correctness
   * @private
   */
  private buildCodeReviewPrompt(
    assignmentDescription: string,
    rubric: Rubric | string,
    submission: string,
    language: string,
  ): string {
    const rubricText = this.formatRubric(rubric);

    return `You are an experienced software engineer grading a ${language} code submission.

ASSIGNMENT:
${assignmentDescription}

RUBRIC:
${rubricText}

CODE SUBMISSION:
${submission}

Please evaluate the code based on:
1. Functional Correctness - Does it work correctly?
2. Code Quality - Is it well-written and maintainable?
3. Style Compliance - Does it follow language/style conventions?
4. Testing - Is it properly tested (if applicable)?
5. Documentation - Is it well-commented?

RESPONSE FORMAT:
Return a JSON object:
{
  "score": <0-100>,
  "confidence": <0-100>,
  "feedback": "<detailed code review>",
  "strengths": ["<strength1>", ...],
  "improvements": ["<improvement1>", ...],
  "code_comments": [
    {
      "line_number": <line>,
      "code": "<code snippet>",
      "comment": "<comment>",
      "severity": "error|warning|info",
      "suggested_fix": "<optional fix>"
    }
  ]
}

Focus on being constructive and educational.`;
  }

  /**
   * Build an essay/short answer evaluation prompt
   * @private
   */
  private buildEssayPrompt(
    assignmentDescription: string,
    rubric: Rubric | string,
    submission: string,
  ): string {
    const rubricText = this.formatRubric(rubric);

    return `You are an experienced educator grading a student essay.

ASSIGNMENT:
${assignmentDescription}

RUBRIC:
${rubricText}

STUDENT ESSAY:
${submission}

Evaluate this submission based on:
1. Thesis Clarity - Is the main argument clear and focused?
2. Evidence Quality - Are claims supported by strong evidence?
3. Organization - Is the essay well-structured?
4. Writing Quality - Is the writing clear and grammatically sound?
5. Conclusion - Does it effectively summarize key points?

RESPONSE FORMAT:
{
  "score": <0-100>,
  "confidence": <0-100>,
  "feedback": "<detailed evaluation>",
  "strengths": ["<strength1>", ...],
  "improvements": ["<improvement1>", ...]
}

Provide constructive feedback that helps the student improve.`;
  }

  /**
   * Get type-specific grading context
   * @private
   */
  private getTypeSpecificContext(
    assignmentType: string,
    submissionFormat?: string,
  ): string {
    const type = assignmentType.toUpperCase();

    switch (type) {
      case 'ESSAY':
        return 'You are an experienced educator grading an essay submission.';

      case 'CODE':
        const language = submissionFormat || 'code';
        return `You are an experienced software engineer grading a ${language} submission. Focus on correctness, code quality, style, and best practices.`;

      case 'QUIZ':
        return 'You are an educator grading a quiz/test response. Grade based on accuracy and completeness.';

      case 'SHORT_ANSWER':
        return 'You are an educator grading a short answer response. Grade based on accuracy, completeness, and clarity.';

      case 'FILE':
      default:
        return 'You are an experienced educator grading a student submission.';
    }
  }

  /**
   * Format rubric for inclusion in prompt
   * Converts Rubric entity to readable text
   * @private
   */
  private formatRubric(rubric: Rubric | string): string {
    if (typeof rubric === 'string') {
      return rubric;
    }

    // Format Rubric entity
    let rubricText = `${rubric.name}\n`;
    if (rubric.description) {
      rubricText += `${rubric.description}\n\n`;
    }

    if (rubric.criteria && Array.isArray(rubric.criteria)) {
      rubricText += 'CRITERIA:\n';
      rubric.criteria.forEach((criterion: any, index: number) => {
        rubricText += `\n${index + 1}. ${criterion.name} (${criterion.points} points)\n`;
        if (criterion.description) {
          rubricText += `   ${criterion.description}\n`;
        }
        if (criterion.levels && Array.isArray(criterion.levels)) {
          rubricText += '   Levels:\n';
          criterion.levels.forEach((level: any) => {
            rubricText += `   - ${level.name} (${level.points} pts): ${level.description}\n`;
          });
        }
      });
    }

    return rubricText;
  }

  /**
   * Calculate prompt statistics (for optimization)
   * @private
   */
  private calculatePromptStats(prompt: string): {
    word_count: number;
    character_count: number;
    line_count: number;
  } {
    const words = prompt.split(/\s+/).filter(w => w.length > 0);
    const lines = prompt.split('\n');

    return {
      word_count: words.length,
      character_count: prompt.length,
      line_count: lines.length,
    };
  }

  /**
   * Validate prompt is within size constraints
   * Most AI providers have token limits
   * @private
   */
  private validatePromptSize(prompt: string, maxWords: number = 8000): boolean {
    const stats = this.calculatePromptStats(prompt);
    return stats.word_count <= maxWords;
  }

  /**
   * Build a comparative feedback prompt (for incremental submissions)
   * Compares new submission to previous versions
   */
  buildComparativePrompt(
    currentSubmission: string,
    previousFeedback: string,
    rubric: Rubric | string,
  ): string {
    const rubricText = this.formatRubric(rubric);

    return `You are grading an incremental submission. Compare it to previous feedback.

PREVIOUS FEEDBACK:
${previousFeedback}

CURRENT SUBMISSION:
${currentSubmission}

RUBRIC:
${rubricText}

Please evaluate:
1. How has the submission improved since the previous version?
2. What areas have been addressed?
3. What areas still need improvement?

Provide feedback that acknowledges progress while identifying remaining gaps.`;
  }

  /**
   * Build a quick rubric adherence check prompt
   * Used to verify AI grading aligns with rubric before finalizing
   */
  buildRubricAlignmentCheckPrompt(
    rubric: Rubric | string,
    proposedScore: number,
    feedback: string,
  ): string {
    const rubricText = this.formatRubric(rubric);

    return `Review this grading for alignment with the rubric.

RUBRIC:
${rubricText}

PROPOSED SCORE: ${proposedScore}
FEEDBACK: ${feedback}

Is the score justified by the rubric criteria? Does the feedback address all criteria?
Return: {"aligned": true/false, "issues": ["issue1", "issue2"]}`;
  }
}
