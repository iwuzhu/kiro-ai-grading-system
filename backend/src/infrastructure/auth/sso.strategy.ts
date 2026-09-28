/**
 * SSO/OAuth2 Strategy (Scaffolding)
 *
 * This file provides the scaffolding and interfaces for OAuth2 SSO integration
 * with providers like Okta and Azure AD. The actual implementation will be
 * completed during deployment when specific provider details are available.
 *
 * Integration Points:
 * - Okta OAuth2 integration
 * - Azure AD (Microsoft Entra) integration
 * - Google OAuth2 (optional)
 *
 * Configuration required (in .env):
 * - OKTA_DOMAIN (e.g., dev-12345.okta.com)
 * - OKTA_CLIENT_ID
 * - OKTA_CLIENT_SECRET
 * - OKTA_CALLBACK_URL (e.g., https://app.example.com/auth/sso/okta/callback)
 * - AZURE_AD_TENANT_ID
 * - AZURE_AD_CLIENT_ID
 * - AZURE_AD_CLIENT_SECRET
 * - AZURE_AD_CALLBACK_URL
 */

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

/**
 * OAuth2 Provider Interface
 * Abstract base for provider-specific implementations
 */
export interface OAuth2Provider {
  /** Provider name (okta, azure_ad, google) */
  name: 'okta' | 'azure_ad' | 'google';

  /** Strategy name for Passport */
  strategyName: string;

  /** Configuration required */
  getConfig(): Record<string, any>;
}

/**
 * Okta OAuth2 Provider Configuration
 *
 * Configuration example:
 * ```
 * OKTA_DOMAIN=dev-12345.okta.com
 * OKTA_CLIENT_ID=0oa...
 * OKTA_CLIENT_SECRET=secret...
 * OKTA_CALLBACK_URL=https://app.example.com/auth/sso/okta/callback
 * ```
 *
 * Okta provides:
 * - id: External user ID
 * - email: User email
 * - name: User display name
 * - roles: User roles (custom claims in Okta)
 */
@Injectable()
export class OktaOAuth2Provider implements OAuth2Provider {
  name: 'okta' = 'okta';
  strategyName = 'oauth2-okta';

  constructor(private readonly configService: ConfigService) {}

  getConfig() {
    const domain = this.configService.get('OKTA_DOMAIN');
    const clientId = this.configService.get('OKTA_CLIENT_ID');
    const clientSecret = this.configService.get('OKTA_CLIENT_SECRET');
    const callbackUrl = this.configService.get('OKTA_CALLBACK_URL');

    if (!domain || !clientId || !clientSecret || !callbackUrl) {
      throw new Error(
        'Okta OAuth2 configuration missing. Set OKTA_DOMAIN, OKTA_CLIENT_ID, OKTA_CLIENT_SECRET, OKTA_CALLBACK_URL',
      );
    }

    return {
      authorizationURL: `https://${domain}/oauth2/v1/authorize`,
      tokenURL: `https://${domain}/oauth2/v1/token`,
      userProfileURL: `https://${domain}/oauth2/v1/userinfo`,
      clientID: clientId,
      clientSecret,
      callbackURL: callbackUrl,
      scope: ['openid', 'profile', 'email'],
    };
  }
}

/**
 * Azure AD OAuth2 Provider Configuration
 *
 * Configuration example:
 * ```
 * AZURE_AD_TENANT_ID=12345678-1234-1234-1234-123456789012
 * AZURE_AD_CLIENT_ID=87654321-4321-4321-4321-210987654321
 * AZURE_AD_CLIENT_SECRET=secret...
 * AZURE_AD_CALLBACK_URL=https://app.example.com/auth/sso/azure/callback
 * ```
 *
 * Azure AD provides:
 * - oid: Object ID (Azure AD unique ID)
 * - email: User email
 * - name: User display name
 * - groups: User's Azure AD groups (requires additional config)
 */
@Injectable()
export class AzureAdOAuth2Provider implements OAuth2Provider {
  name: 'azure_ad' = 'azure_ad';
  strategyName = 'oauth2-azure';

  constructor(private readonly configService: ConfigService) {}

  getConfig() {
    const tenantId = this.configService.get('AZURE_AD_TENANT_ID');
    const clientId = this.configService.get('AZURE_AD_CLIENT_ID');
    const clientSecret = this.configService.get('AZURE_AD_CLIENT_SECRET');
    const callbackUrl = this.configService.get('AZURE_AD_CALLBACK_URL');

    if (!tenantId || !clientId || !clientSecret || !callbackUrl) {
      throw new Error(
        'Azure AD OAuth2 configuration missing. Set AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_CALLBACK_URL',
      );
    }

    return {
      authorizationURL: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
      tokenURL: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      userProfileURL: 'https://graph.microsoft.com/v1.0/me',
      clientID: clientId,
      clientSecret,
      callbackURL: callbackUrl,
      scope: ['openid', 'profile', 'email'],
    };
  }
}

/**
 * Google OAuth2 Provider Configuration (Optional)
 *
 * Configuration example:
 * ```
 * GOOGLE_CLIENT_ID=...apps.googleusercontent.com
 * GOOGLE_CLIENT_SECRET=secret...
 * GOOGLE_CALLBACK_URL=https://app.example.com/auth/sso/google/callback
 * ```
 */
@Injectable()
export class GoogleOAuth2Provider implements OAuth2Provider {
  name: 'google';
  strategyName = 'oauth2-google';

  constructor(private readonly configService: ConfigService) {}

  getConfig() {
    const clientId = this.configService.get('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get('GOOGLE_CLIENT_SECRET');
    const callbackUrl = this.configService.get('GOOGLE_CALLBACK_URL');

    if (!clientId || !clientSecret || !callbackUrl) {
      throw new Error(
        'Google OAuth2 configuration missing. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL',
      );
    }

    return {
      authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenURL: 'https://www.googleapis.com/oauth2/v4/token',
      userProfileURL: 'https://www.googleapis.com/oauth2/v2/userinfo',
      clientID: clientId,
      clientSecret,
      callbackURL: callbackUrl,
      scope: ['openid', 'profile', 'email'],
    };
  }
}

/**
 * OAuth2 Strategy Factory
 *
 * Factory to create and manage OAuth2 strategies for different providers.
 * This scaffolding is ready for implementation of actual Passport strategies.
 */
@Injectable()
export class OAuth2StrategyFactory {
  constructor(
    private readonly oktaProvider: OktaOAuth2Provider,
    private readonly azureProvider: AzureAdOAuth2Provider,
    private readonly googleProvider: GoogleOAuth2Provider,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get enabled OAuth2 providers
   * Returns configuration for providers that are configured
   */
  getEnabledProviders(): OAuth2Provider[] {
    const providers: OAuth2Provider[] = [];

    if (this.configService.get('OKTA_DOMAIN')) {
      providers.push(this.oktaProvider);
    }

    if (this.configService.get('AZURE_AD_TENANT_ID')) {
      providers.push(this.azureProvider);
    }

    if (this.configService.get('GOOGLE_CLIENT_ID')) {
      providers.push(this.googleProvider);
    }

    return providers;
  }

  /**
   * Get provider by name
   */
  getProvider(name: string): OAuth2Provider | null {
    switch (name) {
      case 'okta':
        return this.oktaProvider;
      case 'azure_ad':
        return this.azureProvider;
      case 'google':
        return this.googleProvider;
      default:
        return null;
    }
  }
}

/**
 * NOTE: Full Strategy Implementation
 *
 * When integrating with actual OAuth2 providers, implement strategies like:
 *
 * ```typescript
 * @Injectable()
 * export class OktaStrategy extends PassportStrategy(Strategy, 'oauth2-okta') {
 *   constructor(
 *     private readonly oktaProvider: OktaOAuth2Provider,
 *     private readonly userService: UserService,
 *   ) {
 *     super(oktaProvider.getConfig());
 *   }
 *
 *   async validate(accessToken: string, refreshToken: string, profile: any) {
 *     // Extract user info from Okta profile
 *     const user = await this.userService.findOrCreateSsoUser({
 *       external_id: profile.id,
 *       email: profile.emails[0].value,
 *       name: profile.displayName,
 *       provider: 'okta',
 *     });
 *
 *     return {
 *       id: user.id,
 *       email: user.email,
 *       tenant_id: user.tenant_id,
 *       role: user.role,
 *       permissions: user.permissions,
 *     };
 *   }
 * }
 * ```
 */
