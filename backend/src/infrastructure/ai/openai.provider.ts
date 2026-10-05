/**
 * OpenAI Provider Implementation
 * 
 * Integrates ChatGPT (GPT-4o) for AI-powered grading
 * Handles API calls, response parsing, and error handling
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProvider, AIGradingResponse } from '../../domain/services/ai-provider.interface';

@Injectable()
export class OpenAIProvider implements AIProvider, OnModuleInit {
  private readonly logger = new Logger(OpenAIProvider.name);
  private apiKey: string = '';
  private model: string = 'gpt-4o'; // or 'gpt-4-turbo', 'gpt-3.5-turbo'
  private temperature: number = 0.2; // Low temperature for consistent grading
  private maxTokens: number = 1500;
  private initialized: boolean = false;

  constructor(private configService: ConfigService) {
    this.model = this.configService.get('OPENAI_MODEL') || 'gpt-4o';
    this.temperature = parseFloat(
      this.configService.get('OPENAI_TEMPERATURE') || '0.2',
    );
  }

  /**
   * Initialize - fetch API key from Secrets Manager or environment
   */
  async onModuleInit(): Promise<void> {
    try {
      this.apiKey = await this.getApiKey();
      this.initialized = true;
      if (this.apiKey) {
        this.logger.log('OpenAI provider initialized successfully');
      } else {
        this.logger.warn('OpenAI API key not configured');
      }
    } catch (error) {
      this.logger.error('Failed to initialize OpenAI provider:', error);
    }
  }

  /**
   * Fetch API key from AWS Secrets Manager or environment variable
   */
  private async getApiKey(): Promise<string> {
    // Try environment variable first (for local development)
    const envKey =
      this.configService.get('TECOpenAIAPIKey') ||
      this.configService.get('OPENAI_API_KEY');

    if (envKey) {
      this.logger.debug('Using OpenAI API key from environment variable');
      return envKey;
    }

    // Try AWS Secrets Manager
    try {
      this.logger.debug('Fetching OpenAI API key from AWS Secrets Manager...');
      const secretValue = await this.getSecretFromSecretsManager(
        'TECOpenAIAPIKey',
      );
      if (secretValue) {
        this.logger.log('Successfully fetched API key from Secrets Manager');
        return secretValue;
      }
    } catch (error) {
      this.logger.warn(
        'Failed to fetch from Secrets Manager:',
        error.message,
      );
    }

    // No key found
    return '';
  }

  /**
   * Fetch secret from AWS Secrets Manager
   */
  private async getSecretFromSecretsManager(secretName: string): Promise<string> {
    try {
      // Use native fetch to call Secrets Manager
      const region = this.configService.get('AWS_REGION') || 'us-east-1';
      const endpoint = `https://secretsmanager.${region}.amazonaws.com/`;

      // For simplicity, we'll use AWS SDK v3 if available, otherwise fetch
      // This assumes AWS credentials are available via environment
      try {
        // Try using AWS SDK if installed
        const { SecretsManagerClient, GetSecretValueCommand } = await import(
          '@aws-sdk/client-secrets-manager'
        );

        const client = new SecretsManagerClient({ region });
        const command = new GetSecretValueCommand({ SecretId: secretName });
        const response = await client.send(command);

        if (response.SecretString) {
          // If it's JSON, parse it
          try {
            const secret = JSON.parse(response.SecretString);
            return secret[secretName] || response.SecretString;
          } catch {
            // If not JSON, return as string
            return response.SecretString;
          }
        }
      } catch (sdkError) {
        // SDK not available, try direct API call
        this.logger.debug(
          'AWS SDK not available, trying direct API call...',
        );

        // This requires AWS credentials in environment and would need
        // proper SigV4 signing. For now, we'll just warn and continue.
        this.logger.warn(
          'Direct API call not implemented. Please ensure AWS SDK v3 is installed or set TECOpenAIAPIKey environment variable.',
        );
      }
    } catch (error) {
      this.logger.debug('Secrets Manager error:', error.message);
    }

    return '';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getProviderName(): string {
    return 'openai';
  }

  async gradeSubmission(
    submissionContent: string,
    rubricText: string,
    assignmentDescription: string,
  ): Promise<AIGradingResponse> {
    if (!this.isConfigured()) {
      throw new Error(
        'OpenAI API key not configured. Set TECOpenAIAPIKey or OPENAI_API_KEY environment variable.',
      );
    }

    try {
      this.logger.debug('Calling OpenAI API for grading...');

      // Build the grading prompt
      const prompt = this.buildGradingPrompt(
        submissionContent,
        rubricText,
        assignmentDescription,
      );

      // Call OpenAI API
      const response = await this.callOpenAI(prompt);

      // Parse and validate response
      const gradingResult = this.parseGradingResponse(response);

      this.logger.debug(
        `Grading completed: score=${gradingResult.score}, confidence=${gradingResult.confidence}`,
      );

      return gradingResult;
    } catch (error) {
      this.logger.error('Error calling OpenAI API:', error);
      throw error;
    }
  }

  /**
   * Build the grading prompt for OpenAI
   */
  private buildGradingPrompt(
    submissionContent: string,
    rubricText: string,
    assignmentDescription: string,
  ): string {
    return `You are an expert educator grading student assignments. Your task is to grade the following submission fairly and provide constructive feedback.

ASSIGNMENT INSTRUCTIONS:
${assignmentDescription}

GRADING RUBRIC:
${rubricText}

STUDENT SUBMISSION:
${submissionContent}

Please grade this submission and provide your response in the following JSON format:
{
  "score": <0-100>,
  "confidence": <0-100>,
  "feedback": "Detailed feedback explaining the grade...",
  "strengths": ["Strength 1", "Strength 2", ...],
  "improvements": ["Area for improvement 1", "Area 2", ...],
  "reasoning": "Brief explanation of why this score"
}

Requirements:
1. Score: 0-100 scale based on the rubric
2. Confidence: How confident are you in this grade (0-100%)
3. Feedback: Detailed, actionable feedback (minimum 50 characters)
4. Strengths: At least 2 specific strengths demonstrated
5. Improvements: At least 2 specific areas for improvement
6. Reasoning: Brief explanation connecting rubric to score

Respond ONLY with the JSON object, no additional text.`;
  }

  /**
   * Call OpenAI API using fetch (no SDK dependency)
   */
  private async callOpenAI(prompt: string): Promise<string> {
    const requestBody = {
      model: this.model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      response_format: { type: 'json_object' }, // Ensure JSON response
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as any;
      throw new Error(
        `OpenAI API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`,
      );
    }

    const data = (await response.json()) as any;

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from OpenAI API');
    }

    return data.choices[0].message.content;
  }

  /**
   * Parse and validate OpenAI response
   */
  private parseGradingResponse(responseText: string): AIGradingResponse {
    try {
      const parsed = JSON.parse(responseText);

      // Validate score is in range
      if (parsed.score < 0 || parsed.score > 100) {
        throw new Error(
          `Invalid score: ${parsed.score} (must be 0-100)`,
        );
      }

      // Validate confidence is in range
      if (parsed.confidence < 0 || parsed.confidence > 100) {
        throw new Error(
          `Invalid confidence: ${parsed.confidence} (must be 0-100)`,
        );
      }

      // Validate feedback exists
      if (!parsed.feedback || parsed.feedback.trim().length < 20) {
        throw new Error('Feedback must be at least 20 characters');
      }

      // Validate strengths
      if (!Array.isArray(parsed.strengths) || parsed.strengths.length === 0) {
        throw new Error('Must provide at least one strength');
      }

      // Validate improvements
      if (
        !Array.isArray(parsed.improvements) ||
        parsed.improvements.length === 0
      ) {
        throw new Error('Must provide at least one improvement');
      }

      return {
        score: Math.round(parsed.score * 100) / 100, // Round to 2 decimals
        confidence: Math.round(parsed.confidence * 100) / 100,
        feedback: parsed.feedback.trim(),
        strengths: parsed.strengths.map((s: string) => s.trim()).slice(0, 5), // Max 5
        improvements: parsed.improvements.map((i: string) => i.trim()).slice(0, 5), // Max 5
        reasoning: parsed.reasoning || 'No reasoning provided',
        rubricAlignment: parsed.rubricAlignment,
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Failed to parse OpenAI response as JSON: ${responseText}`);
      }
      throw error;
    }
  }
}
