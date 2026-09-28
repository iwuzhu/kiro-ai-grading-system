import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAIProvider, AIProviderConfig } from './ai-provider.interface';
import { OpenAIProvider } from './openai-provider';
import { AnthropicProvider } from './anthropic-provider';
import { BedrockProvider } from './bedrock-provider';

/**
 * AI Provider Factory (Task 3.5)
 *
 * Factory pattern for selecting and instantiating AI providers.
 * Supports multiple providers: OpenAI, Anthropic, AWS Bedrock.
 * Configured via institution settings.
 *
 * Requirements Met:
 * ✓ 3.5: AI Provider Factory Pattern
 * ✓ 7: AI Grading Engine support for multiple providers
 * ✓ Pluggable provider architecture
 */
@Injectable()
export class AIProviderFactory {
  private providers: Map<string, IAIProvider> = new Map();
  private defaultProvider: IAIProvider | null = null;

  constructor(private configService: ConfigService) {}

  /**
   * Initialize and get provider for an institution
   *
   * @param institutionId - Institution ID
   * @param providerType - Provider type: 'openai', 'anthropic', 'bedrock'
   * @returns Initialized AI provider
   */
  async getProvider(
    institutionId: string,
    providerType: string = 'openai',
  ): Promise<IAIProvider> {
    const cacheKey = `${institutionId}:${providerType}`;

    // Return cached provider if available
    if (this.providers.has(cacheKey)) {
      return this.providers.get(cacheKey)!;
    }

    // Create and initialize new provider
    const provider = this.createProvider(providerType);
    const config = this.getProviderConfig(providerType);

    await provider.initialize(config);
    this.providers.set(cacheKey, provider);

    return provider;
  }

  /**
   * Get default provider (from config or environment)
   * @returns Default AI provider
   */
  async getDefaultProvider(): Promise<IAIProvider> {
    if (this.defaultProvider) {
      return this.defaultProvider;
    }

    const providerType = this.configService.get('AI_PROVIDER', 'openai');
    this.defaultProvider = await this.getProvider('default', providerType);

    return this.defaultProvider;
  }

  /**
   * Create provider instance without initialization
   * @private
   */
  private createProvider(providerType: string): IAIProvider {
    switch (providerType.toLowerCase()) {
      case 'openai':
        return new OpenAIProvider();
      case 'anthropic':
      case 'claude':
        return new AnthropicProvider();
      case 'bedrock':
      case 'aws':
        return new BedrockProvider();
      default:
        throw new BadRequestException(
          `Unsupported AI provider: ${providerType}. Supported: openai, anthropic, bedrock`,
        );
    }
  }

  /**
   * Get configuration for AI provider from environment/config
   * @private
   */
  private getProviderConfig(providerType: string): AIProviderConfig {
    const normalizedType = providerType.toLowerCase();

    let apiKey = '';
    let model = '';

    // Map provider names to env vars
    if (normalizedType === 'openai') {
      apiKey = this.configService.get('OPENAI_API_KEY', '');
      model = this.configService.get('OPENAI_MODEL', 'gpt-4-turbo-preview');
    } else if (normalizedType === 'anthropic' || normalizedType === 'claude') {
      apiKey = this.configService.get('ANTHROPIC_API_KEY', '');
      model = this.configService.get('ANTHROPIC_MODEL', 'claude-3-opus-20240229');
    } else if (normalizedType === 'bedrock' || normalizedType === 'aws') {
      apiKey = ''; // Bedrock uses AWS credentials
      model = this.configService.get('BEDROCK_MODEL', 'anthropic.claude-3-opus-20240229-v1:0');
    }

    if (!apiKey && normalizedType !== 'bedrock' && normalizedType !== 'aws') {
      throw new BadRequestException(
        `API key not configured for ${providerType} provider`,
      );
    }

    return {
      api_key: apiKey,
      model,
      max_tokens: parseInt(this.configService.get('AI_MAX_TOKENS', '4000')),
      temperature: parseFloat(this.configService.get('AI_TEMPERATURE', '0.7')),
      timeout: parseInt(this.configService.get('AI_TIMEOUT', '60000')),
      max_retries: parseInt(this.configService.get('AI_MAX_RETRIES', '3')),
    };
  }

  /**
   * Get all available providers
   * @returns Array of provider names
   */
  getAvailableProviders(): string[] {
    return ['openai', 'anthropic', 'bedrock'];
  }

  /**
   * Check if provider is available (configured)
   * @param providerType - Provider type
   * @returns true if provider is configured
   */
  isProviderAvailable(providerType: string): boolean {
    try {
      this.getProviderConfig(providerType);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get health status of a provider
   * @param providerType - Provider type
   * @returns true if provider is healthy
   */
  async getProviderHealth(providerType: string): Promise<boolean> {
    try {
      const provider = await this.getProvider('health-check', providerType);
      return provider.isHealthy();
    } catch {
      return false;
    }
  }

  /**
   * Clear provider cache
   * Useful after configuration changes
   */
  clearCache(): void {
    this.providers.clear();
    this.defaultProvider = null;
  }
}
