import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CopyLeaksService } from './copyleaks.service';

// Mock axios
jest.mock('axios');

describe('CopyLeaksService', () => {
  let service: CopyLeaksService;
  let configService: ConfigService;
  const mockAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CopyLeaksService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                COPYLEAKS_API_KEY: 'test-api-key',
                COPYLEAKS_API_URL: 'https://api.copyleaks.com/v3',
                COPYLEAKS_TIMEOUT_MS: 120000,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CopyLeaksService>(CopyLeaksService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  describe('getName', () => {
    it('should return service name', () => {
      expect(service.getName()).toBe('CopyLeaks');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API is available', async () => {
      mockAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ status: 200 }),
      } as any);

      const result = await service.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when API key is missing', async () => {
      const moduleWithoutKey = await Test.createTestingModule({
        providers: [
          CopyLeaksService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      }).compile();

      const serviceWithoutKey =
        moduleWithoutKey.get<CopyLeaksService>(CopyLeaksService);
      const result = await serviceWithoutKey.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false on connection error', async () => {
      mockAxios.create.mockReturnValue({
        get: jest
          .fn()
          .mockRejectedValue(new Error('Connection refused')),
      } as any);

      const result = await service.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false on auth error', async () => {
      mockAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue({
          response: { status: 401 },
        }),
      } as any);

      const result = await service.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('detect', () => {
    it('should successfully detect plagiarism', async () => {
      const mockApiClient = {
        post: jest.fn().mockResolvedValue({
          status: 201,
          data: { id: 'submission-123' },
        }),
        get: jest
          .fn()
          .mockResolvedValueOnce({
            data: { status: 'completed' },
          })
          .mockResolvedValueOnce({
            data: {
              statistics: { percentMatched: 45.2 },
              results: {
                aiScore: 12.5,
                sources: [
                  {
                    title: 'Example Article',
                    percentMatched: 0.452,
                    url: 'https://example.com',
                  },
                ],
              },
            },
          }),
      };

      mockAxios.create.mockReturnValue(mockApiClient as any);

      const result = await service.detect(
        'Sample submission content',
        'sub-123',
        'assign-123',
        'tenant-123',
      );

      expect(result.isComplete).toBe(true);
      expect(result.plagiarismScore).toBe(45.2);
      expect(result.aiGenerationScore).toBe(12.5);
      expect(result.sourceMatches.length).toBeGreaterThan(0);
      expect(result.externalScanId).toBe('submission-123');
    });

    it('should handle timeout', async () => {
      const mockApiClient = {
        post: jest.fn().mockResolvedValue({
          status: 201,
          data: { id: 'submission-123' },
        }),
        get: jest.fn().mockImplementation(() => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({ data: { status: 'processing' } });
            }, 150000); // Longer than 120s timeout
          });
        }),
      };

      mockAxios.create.mockReturnValue(mockApiClient as any);

      const result = await service.detect(
        'Sample submission content',
        'sub-123',
        'assign-123',
        'tenant-123',
      );

      expect(result.isComplete).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle submission errors', async () => {
      const mockApiClient = {
        post: jest.fn().mockRejectedValue({
          response: { status: 400, data: { error: 'Invalid document' } },
        }),
      };

      mockAxios.create.mockReturnValue(mockApiClient as any);

      const result = await service.detect(
        'Invalid content',
        'sub-123',
        'assign-123',
        'tenant-123',
      );

      expect(result.isComplete).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should extract scores correctly', async () => {
      const mockApiClient = {
        post: jest.fn().mockResolvedValue({
          status: 201,
          data: { id: 'submission-123' },
        }),
        get: jest
          .fn()
          .mockResolvedValueOnce({ data: { status: 'completed' } })
          .mockResolvedValueOnce({
            data: {
              statistics: { percentMatched: 0.785 }, // 78.5%
              results: {
                aiScore: 0.234, // 23.4%
                sources: [],
              },
            },
          }),
      };

      mockAxios.create.mockReturnValue(mockApiClient as any);

      const result = await service.detect(
        'Test content',
        'sub-123',
        'assign-123',
        'tenant-123',
      );

      // Scores should be rounded to 2 decimal places
      expect(result.plagiarismScore).toBe(78.5);
      expect(result.aiGenerationScore).toBe(23.4);
    });

    it('should cap scores at 100', async () => {
      const mockApiClient = {
        post: jest.fn().mockResolvedValue({
          status: 201,
          data: { id: 'submission-123' },
        }),
        get: jest
          .fn()
          .mockResolvedValueOnce({ data: { status: 'completed' } })
          .mockResolvedValueOnce({
            data: {
              statistics: { percentMatched: 1.5 }, // Over 100%
              results: { aiScore: 1.2, sources: [] },
            },
          }),
      };

      mockAxios.create.mockReturnValue(mockApiClient as any);

      const result = await service.detect(
        'Test content',
        'sub-123',
        'assign-123',
        'tenant-123',
      );

      expect(result.plagiarismScore).toBe(100);
      expect(result.aiGenerationScore).toBe(100);
    });

    it('should handle rate limiting with exponential backoff', async () => {
      const mockApiClient = {
        post: jest.fn().mockResolvedValue({
          status: 201,
          data: { id: 'submission-123' },
        }),
        get: jest
          .fn()
          .mockRejectedValueOnce({ response: { status: 429 } })
          .mockResolvedValueOnce({ data: { status: 'completed' } })
          .mockResolvedValueOnce({
            data: {
              statistics: { percentMatched: 25 },
              results: { aiScore: 15, sources: [] },
            },
          }),
      };

      mockAxios.create.mockReturnValue(mockApiClient as any);

      const result = await service.detect(
        'Test content',
        'sub-123',
        'assign-123',
        'tenant-123',
      );

      expect(result.isComplete).toBe(true);
      expect(result.plagiarismScore).toBe(25);
    });

    it('should extract source matches with correct format', async () => {
      const mockApiClient = {
        post: jest.fn().mockResolvedValue({
          status: 201,
          data: { id: 'submission-123' },
        }),
        get: jest
          .fn()
          .mockResolvedValueOnce({ data: { status: 'completed' } })
          .mockResolvedValueOnce({
            data: {
              statistics: { percentMatched: 45 },
              results: {
                aiScore: 10,
                sources: [
                  {
                    title: 'Source 1',
                    percentMatched: 0.30,
                    url: 'https://example1.com',
                    type: 'online',
                  },
                  {
                    title: 'Source 2',
                    percentMatched: 0.15,
                    url: 'https://example2.com',
                    type: 'database',
                  },
                ],
              },
            },
          }),
      };

      mockAxios.create.mockReturnValue(mockApiClient as any);

      const result = await service.detect(
        'Test content',
        'sub-123',
        'assign-123',
        'tenant-123',
      );

      expect(result.sourceMatches).toHaveLength(2);
      expect(result.sourceMatches[0]).toEqual(
        expect.objectContaining({
          id: 'copyleaks-0',
          title: 'Source 1',
          url: 'https://example1.com',
          matchPercentage: 30,
          sourceType: 'online',
          excerpts: expect.any(Array),
        }),
      );
      expect(result.sourceMatches[1]).toEqual(
        expect.objectContaining({
          id: 'copyleaks-1',
          title: 'Source 2',
          matchPercentage: 15,
        }),
      );
    });
  });

  describe('error scenarios', () => {
    it('should handle auth errors gracefully', async () => {
      const mockApiClient = {
        post: jest.fn().mockRejectedValue({
          response: { status: 401 },
        }),
      };

      mockAxios.create.mockReturnValue(mockApiClient as any);

      const result = await service.detect(
        'Test content',
        'sub-123',
        'assign-123',
        'tenant-123',
      );

      expect(result.isComplete).toBe(false);
      expect(result.error).toContain('error');
    });

    it('should handle server errors', async () => {
      const mockApiClient = {
        post: jest.fn().mockRejectedValue({
          response: { status: 503, statusText: 'Service Unavailable' },
        }),
      };

      mockAxios.create.mockReturnValue(mockApiClient as any);

      const result = await service.detect(
        'Test content',
        'sub-123',
        'assign-123',
        'tenant-123',
      );

      expect(result.isComplete).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle missing response fields gracefully', async () => {
      const mockApiClient = {
        post: jest.fn().mockResolvedValue({
          status: 201,
          data: { id: 'submission-123' },
        }),
        get: jest
          .fn()
          .mockResolvedValueOnce({ data: { status: 'completed' } })
          .mockResolvedValueOnce({
            data: {
              // Missing statistics and results
            },
          }),
      };

      mockAxios.create.mockReturnValue(mockApiClient as any);

      const result = await service.detect(
        'Test content',
        'sub-123',
        'assign-123',
        'tenant-123',
      );

      expect(result.isComplete).toBe(true);
      expect(result.plagiarismScore).toBe(0);
      expect(result.aiGenerationScore).toBe(0);
      expect(result.sourceMatches).toHaveLength(0);
    });
  });
});
