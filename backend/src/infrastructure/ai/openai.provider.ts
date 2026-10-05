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

  constructor(private configService: ConfigService) {
    this.model = this.configService.get('OPENAI_MODEL') || 'gpt-4o';
    this.temperature = parseFloat(
      this.configService.get('OPENAI_TEMPERATURE') || '0.2',
    );
  }

  /**
   * Initialize - log that provider is ready
   * Note: API key is fetched dynamically on each request, not cached here
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('OpenAI provider initialized (key fetched per-request)');
  }

  /**
   * Fetch API key from AWS Secrets Manager or environment variable
   * Priority:
   * 1. AWS Secrets Manager (TECOpenAIAPIKeyDeepGrader) - PRODUCTION
   * 2. Environment variable (TECOpenAIAPIKeyDeepGrader) - LOCAL DEV
   * 3. Environment variable (OPENAI_API_KEY) - FALLBACK
   */
  private async getApiKey(): Promise<string> {
    this.logger.log(`🔑 Fetching OpenAI API key...`);

    // Try AWS Secrets Manager FIRST (most reliable for production)
    try {
      this.logger.log('🔐 Step 1: Trying AWS Secrets Manager...');
      const secretValue = await this.getSecretFromSecretsManager(
        'TECOpenAIAPIKeyDeepGrader',
      );
      if (secretValue) {
        this.logger.log('✓ SUCCESS: API key from Secrets Manager');
        this.logger.log(`  Key starts with: ${secretValue.substring(0, 20)}...`);
        return secretValue;
      } else {
        this.logger.warn('⚠ Secrets Manager returned empty string');
      }
    } catch (error) {
      this.logger.warn(
        '⚠ Secrets Manager fetch failed (expected in local dev):',
        error instanceof Error ? error.message : String(error),
      );
    }

    // Fallback to environment variables (local development)
    this.logger.log('📋 Step 2: Trying environment variables...');
    
    const envKeyDeepGrader = this.configService.get('TECOpenAIAPIKeyDeepGrader');
    const envKey = this.configService.get('OPENAI_API_KEY');

    this.logger.log(`  TECOpenAIAPIKeyDeepGrader: ${envKeyDeepGrader ? `(${envKeyDeepGrader.length} chars)` : '(not set)'}`);
    this.logger.log(`  OPENAI_API_KEY: ${envKey ? `(${envKey.length} chars)` : '(not set)'}`);
    
    if (envKeyDeepGrader && !envKeyDeepGrader.includes('placeholder')) {
      this.logger.log('✓ SUCCESS: API key from TECOpenAIAPIKeyDeepGrader env var');
      return envKeyDeepGrader;
    }

    if (envKey && !envKey.includes('placeholder')) {
      this.logger.log('✓ SUCCESS: API key from OPENAI_API_KEY env var');
      return envKey;
    }

    // No valid key found
    this.logger.error('❌ FAILED: No valid OpenAI API key found in Secrets Manager or environment variables');
    return '';
  }

  /**
   * Fetch secret from AWS Secrets Manager
   */
  private async getSecretFromSecretsManager(secretName: string): Promise<string> {
    try {
      // Use AWS SDK v3
      const { SecretsManagerClient, GetSecretValueCommand } = await import(
        '@aws-sdk/client-secrets-manager'
      );

      const region = this.configService.get('AWS_REGION') || 'us-east-1';
      this.logger.debug(`📍 AWS Region: ${region}`);
      
      const client = new SecretsManagerClient({ region });
      const command = new GetSecretValueCommand({ SecretId: secretName });
      
      this.logger.debug(`🔐 Fetching secret "${secretName}" from AWS Secrets Manager...`);
      const response = await client.send(command);

      if (!response.SecretString) {
        this.logger.warn(`⚠ Secret "${secretName}" has no SecretString value`);
        return '';
      }

      this.logger.debug(`✓ Secret retrieved, parsing...`);

      // Try to parse as JSON
      try {
        const secret = JSON.parse(response.SecretString);
        this.logger.debug(`📝 Secret is JSON with keys: ${Object.keys(secret).join(', ')}`);
        
        // Check if the secret is a JSON object with the key matching the secret name
        if (secret[secretName]) {
          this.logger.log(`✓ Found API key at: ${secretName}`);
          return secret[secretName];
        }
        
        // Check for common key names
        const commonKeys = ['value', 'secret', 'key', 'apiKey', 'api_key', 'OPENAI_API_KEY'];
        for (const key of commonKeys) {
          if (secret[key]) {
            this.logger.log(`✓ Found API key at: ${key}`);
            return secret[key];
          }
        }
        
        // If we can't find a recognizable key, log what we found
        this.logger.warn(`⚠ Could not find API key in secret JSON. Available keys: ${Object.keys(secret).join(', ')}`);
        return '';
      } catch (parseError) {
        // Not JSON, return as plain string
        this.logger.log(`📝 Secret is plain text (not JSON)`);
        return response.SecretString;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`✗ Secrets Manager error: ${errorMsg}`);
      
      // Log specific error types for debugging
      if (error instanceof Error && error.name === 'ResourceNotFoundException') {
        this.logger.error(`  → Secret "${secretName}" not found in Secrets Manager`);
      } else if (error instanceof Error && error.name === 'InvalidRequestException') {
        this.logger.error(`  → Invalid request (check secret name and format)`);
      } else if (error instanceof Error && error.name === 'AccessDeniedException') {
        this.logger.error(`  → Access denied (check IAM permissions)`);
      }
      
      return '';
    }
  }

  isConfigured(): boolean {
    // Check if we can get an API key (don't cache it)
    const envKeyDeepGrader = this.configService.get('TECOpenAIAPIKeyDeepGrader');
    const envKey =
      this.configService.get('TECOpenAIAPIKey') ||
      this.configService.get('OPENAI_API_KEY');
    
    // If env has a non-placeholder key, it's configured
    if (envKeyDeepGrader && !envKeyDeepGrader.includes('placeholder')) {
      return true;
    }

    if (envKey && !envKey.includes('placeholder')) {
      return true;
    }
    
    // Otherwise, assume Secrets Manager might have it (we'll try to fetch it)
    return true; // Optimistic: we'll try to fetch from Secrets Manager
  }

  getProviderName(): string {
    return 'openai';
  }

  async gradeSubmission(
    submissionContent: string,
    rubricText: string,
    assignmentDescription: string,
    files?: any[], // SubmissionFile[]
  ): Promise<AIGradingResponse> {
    this.logger.log('[gradeSubmission] Starting AI grading...');
    
    // Fetch API key dynamically on each call (not cached)
    this.logger.log('[gradeSubmission] Fetching API key...');
    const apiKey = await this.getApiKey();
    this.logger.log(`[gradeSubmission] API key fetch completed. Key exists: ${!!apiKey}, Key length: ${apiKey?.length || 0}`);
    
    if (!apiKey) {
      const errorMsg = 'OpenAI API key not configured. Set TECOpenAIAPIKeyDeepGrader or OPENAI_API_KEY environment variable.';
      this.logger.error(`[gradeSubmission] ✗ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    try {
      this.logger.debug(`[gradeSubmission] Grading submission with ${files?.length || 0} file(s)`);

      // Build the grading prompt
      const prompt = this.buildGradingPrompt(
        submissionContent,
        rubricText,
        assignmentDescription,
      );

      // Call OpenAI API with dynamic key and files
      const response = await this.callOpenAI(prompt, apiKey, files);

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
  private async callOpenAI(prompt: string, apiKey: string, files?: any[]): Promise<string> {
    // Build message content with text and files
    const messageContent: any[] = [
      {
        type: 'text',
        text: prompt,
      },
    ];

    // Add files to the message if provided
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          // Convert buffer to base64
          const base64Data = file.buffer.toString('base64');
          
          // Determine media type
          const mimeType = this.getMimeType(file.fileType);
          
          this.logger.debug(`[callOpenAI] Adding file: ${file.fileName} (${mimeType})`);

          // For PDFs and documents, use document format
          if (mimeType.includes('pdf') || mimeType.includes('document')) {
            messageContent.push({
              type: 'document',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Data,
              },
            });
          }
          // For images
          else if (mimeType.startsWith('image/')) {
            messageContent.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Data,
              },
            });
          }
          // For other text-based files, embed as base64
          else {
            messageContent.push({
              type: 'text',
              text: `\n\n[File: ${file.fileName}]\n[Type: ${file.fileType}]\n\nFile content (base64):\n${base64Data.substring(0, 1000)}${base64Data.length > 1000 ? '...[truncated]' : ''}`,
            });
          }
        } catch (error) {
          this.logger.warn(`[callOpenAI] Could not process file ${file.fileName}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    const requestBody = {
      model: this.model,
      messages: [
        {
          role: 'user',
          content: messageContent,
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
        Authorization: `Bearer ${apiKey}`,
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

    let responseContent = data.choices[0].message.content;

    // Extract JSON if wrapped in tags (OpenAI sometimes wraps JSON in <json> tags)
    const jsonMatch = responseContent.match(/<json>([\s\S]*)<\/json>/);
    if (jsonMatch) {
      responseContent = jsonMatch[1];
    }

    // Trim whitespace and ensure it's valid JSON
    responseContent = responseContent.trim();
    
    this.logger.debug(`[callOpenAI] Raw response: ${responseContent.substring(0, 200)}...`);

    return responseContent;
  }

  /**
   * Get MIME type for file type
   */
  private getMimeType(fileType: string): string {
    const mimeMap: Record<string, string> = {
      'application/pdf': 'application/pdf',
      'pdf': 'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'application/pdf', // DOCX
      'docx': 'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'application/pdf', // XLSX
      'xlsx': 'application/pdf',
      'image/jpeg': 'image/jpeg',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'image/png': 'image/png',
      'png': 'image/png',
      'image/gif': 'image/gif',
      'gif': 'image/gif',
      'image/webp': 'image/webp',
      'webp': 'image/webp',
      'text/plain': 'text/plain',
      'txt': 'text/plain',
      'text/python': 'text/plain',
      'py': 'text/plain',
      'application/json': 'application/json',
      'json': 'application/json',
    };

    return mimeMap[fileType.toLowerCase()] || 'application/octet-stream';
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

      // Ensure strengths is an array with at least 1 item
      const strengths = Array.isArray(parsed.strengths) 
        ? parsed.strengths 
        : (parsed.strengths ? [parsed.strengths] : []);
      
      if (strengths.length === 0) {
        this.logger.warn('[parseGradingResponse] No strengths provided, using default');
        strengths.push('Submission demonstrates competence in the subject matter');
      }

      // Ensure improvements is an array with at least 1 item
      const improvements = Array.isArray(parsed.improvements)
        ? parsed.improvements
        : (parsed.improvements ? [parsed.improvements] : []);
      
      if (improvements.length === 0) {
        this.logger.warn('[parseGradingResponse] No improvements provided, using default');
        improvements.push('Consider reviewing the rubric for additional areas to strengthen');
      }

      return {
        score: Math.round(parsed.score * 100) / 100, // Round to 2 decimals
        confidence: Math.round(parsed.confidence * 100) / 100,
        feedback: parsed.feedback.trim(),
        strengths: strengths
          .filter((s: any) => s && typeof s === 'string')
          .map((s: string) => s.trim())
          .filter(s => s.length > 0)
          .slice(0, 5), // Max 5
        improvements: improvements
          .filter((i: any) => i && typeof i === 'string')
          .map((i: string) => i.trim())
          .filter(i => i.length > 0)
          .slice(0, 5), // Max 5
        reasoning: parsed.reasoning || 'No reasoning provided',
        rubricAlignment: parsed.rubricAlignment,
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.logger.error(`[parseGradingResponse] JSON parse error. Response: ${responseText.substring(0, 500)}`);
        throw new Error(`Failed to parse OpenAI response as JSON: ${responseText.substring(0, 200)}`);
      }
      throw error;
    }
  }
}
