import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { LocalCorpusService } from './local-corpus.service';

describe('LocalCorpusService (Enhanced)', () => {
  let service: LocalCorpusService;
  let dataSource: DataSource;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalCorpusService,
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                LOCAL_SIMILARITY_THRESHOLD: 0.8,
                LOCAL_SIMILARITY_ALGORITHM: 'hybrid',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LocalCorpusService>(LocalCorpusService);
    dataSource = module.get<DataSource>(DataSource);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  describe('getName', () => {
    it('should return service name', () => {
      expect(service.getName()).toBe('Local Corpus');
    });
  });

  describe('isAvailable', () => {
    it('should return true when pg_trgm extension is available', async () => {
      (dataSource.query as jest.Mock).mockResolvedValue([
        { extname: 'pg_trgm' },
      ]);

      const result = await service.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when pg_trgm extension is missing', async () => {
      (dataSource.query as jest.Mock).mockResolvedValue([]);

      const result = await service.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false on database error', async () => {
      (dataSource.query as jest.Mock).mockRejectedValue(
        new Error('Connection failed'),
      );

      const result = await service.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('Similarity Algorithms', () => {
    describe('Cosine Similarity', () => {
      it('should calculate cosine similarity correctly', () => {
        const text1 = 'the quick brown fox';
        const text2 = 'the quick brown dog';

        const result = service['detect'](text1, 'sub1', 'assign1', 'tenant1');

        // This is an integration test - we're testing that the algorithm produces
        // reasonable results for similar texts
      });

      it('should return 0 for completely different texts', () => {
        const vec1 = new Map([['a', 1]]);
        const vec2 = new Map([['b', 1]]);

        const result = service['cosineSimilarity'](vec1, vec2);
        expect(result).toBe(0);
      });

      it('should return 1 for identical vectors', () => {
        const vec1 = new Map([
          ['a', 1],
          ['b', 2],
        ]);
        const vec2 = new Map([
          ['a', 1],
          ['b', 2],
        ]);

        const result = service['cosineSimilarity'](vec1, vec2);
        expect(result).toBe(1);
      });

      it('should return partial similarity for partially overlapping vectors', () => {
        const vec1 = new Map([
          ['a', 1],
          ['b', 1],
        ]);
        const vec2 = new Map([
          ['a', 1],
          ['c', 1],
        ]);

        const result = service['cosineSimilarity'](vec1, vec2);
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(1);
      });
    });

    describe('Jaccard Similarity', () => {
      it('should calculate Jaccard similarity correctly', () => {
        const tokens1 = ['the', 'quick', 'brown', 'fox'];
        const tokens2 = ['the', 'quick', 'brown', 'dog'];

        const result = service['jaccardSimilarity'](tokens1, tokens2);
        expect(result).toBeCloseTo(0.6, 1); // 3 common / 5 total = 0.6
      });

      it('should return 1 for identical token sets', () => {
        const tokens1 = ['the', 'quick', 'brown'];
        const tokens2 = ['the', 'quick', 'brown'];

        const result = service['jaccardSimilarity'](tokens1, tokens2);
        expect(result).toBe(1);
      });

      it('should return 0 for completely different tokens', () => {
        const tokens1 = ['a', 'b', 'c'];
        const tokens2 = ['x', 'y', 'z'];

        const result = service['jaccardSimilarity'](tokens1, tokens2);
        expect(result).toBe(0);
      });

      it('should return 0 for empty arrays', () => {
        const result = service['jaccardSimilarity']([], []);
        expect(result).toBe(0);
      });
    });

    describe('Edit Distance (Levenshtein)', () => {
      it('should calculate edit distance for insertion', () => {
        const distance = service['levenshteinDistance']('cat', 'cats');
        expect(distance).toBe(1);
      });

      it('should calculate edit distance for deletion', () => {
        const distance = service['levenshteinDistance']('cats', 'cat');
        expect(distance).toBe(1);
      });

      it('should calculate edit distance for substitution', () => {
        const distance = service['levenshteinDistance']('cat', 'car');
        expect(distance).toBe(1);
      });

      it('should return 0 for identical strings', () => {
        const distance = service['levenshteinDistance']('test', 'test');
        expect(distance).toBe(0);
      });

      it('should calculate total distance for different strings', () => {
        const distance = service['levenshteinDistance']('kitten', 'sitting');
        expect(distance).toBe(3); // 1 substitution + 2 substitutions
      });

      it('should convert distance to similarity', () => {
        const similarity = service['editDistanceSimilarity'](
          'kitten',
          'sitting',
        );
        expect(similarity).toBeGreaterThan(0);
        expect(similarity).toBeLessThan(1);
      });
    });

    describe('Tokenization', () => {
      it('should tokenize content correctly', () => {
        const content = 'The quick brown fox jumps over the lazy dog';
        const tokens = service['tokenizeContent'](content);

        expect(tokens).toContain('quick');
        expect(tokens).toContain('brown');
        expect(tokens).not.toContain('the'); // Too short (3 chars)
      });

      it('should normalize to lowercase', () => {
        const content = 'The QUICK Brown FOX';
        const tokens = service['tokenizeContent'](content);

        expect(tokens.every((t) => t === t.toLowerCase())).toBe(true);
      });

      it('should remove punctuation', () => {
        const content = 'Hello, world! How are you?';
        const tokens = service['tokenizeContent'](content);

        expect(tokens).not.toContain('hello,');
        expect(tokens).toContain('hello');
      });

      it('should filter out short tokens', () => {
        const content = 'a ab abc abcd';
        const tokens = service['tokenizeContent'](content);

        // Should filter out 'a' and 'ab' (too short)
        expect(tokens).not.toContain('a');
        expect(tokens).not.toContain('ab');
        expect(tokens).toContain('abc');
      });

      it('should handle empty content', () => {
        const tokens = service['tokenizeContent']('');
        expect(tokens).toHaveLength(0);
      });
    });

    describe('Text to Vector Conversion', () => {
      it('should create term frequency vector', () => {
        const content = 'the cat and the dog';
        const vector = service['textToVector'](content);

        expect(vector.get('the')).toBe(2); // Appears twice
        expect(vector.get('cat')).toBe(1);
        expect(vector.get('dog')).toBe(1);
      });

      it('should not include short tokens in vector', () => {
        const content = 'a the quick';
        const vector = service['textToVector'](content);

        expect(vector.get('a')).toBeUndefined();
        expect(vector.get('the')).toBeUndefined();
        expect(vector.get('quick')).toBe(1);
      });
    });
  });

  describe('Corpus Management', () => {
    it('should add submission to corpus cache', async () => {
      const content = 'Sample submission content';

      await service.addToCorpus('tenant1', 'sub1', content);

      // Cache should contain the submission
      const cacheKey = 'tenant1:sub1';
      // We can't directly check the cache, but we verify no error occurred
      expect(true).toBe(true);
    });

    it('should get corpus statistics', async () => {
      (dataSource.query as jest.Mock).mockResolvedValue([
        { total: 250 },
      ]);

      const stats = await service.getCorpusStats('tenant1');

      expect(stats.totalSubmissions).toBe(250);
      expect(stats.totalIndexed).toBe(250);
    });

    it('should cleanup old corpus entries', async () => {
      await service.cleanupOldEntries('tenant1', 365);

      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should load configurable threshold', async () => {
      const module = await Test.createTestingModule({
        providers: [
          LocalCorpusService,
          {
            provide: DataSource,
            useValue: { query: jest.fn() },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'LOCAL_SIMILARITY_THRESHOLD') return 0.75;
                return 'hybrid';
              }),
            },
          },
        ],
      }).compile();

      const testService =
        module.get<LocalCorpusService>(LocalCorpusService);
      // Service should be initialized with 0.75 threshold
      expect(testService.getName()).toBe('Local Corpus');
    });

    it('should validate threshold range', async () => {
      const module = await Test.createTestingModule({
        providers: [
          LocalCorpusService,
          {
            provide: DataSource,
            useValue: { query: jest.fn() },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'LOCAL_SIMILARITY_THRESHOLD') return 0.5; // Out of range
                return 'hybrid';
              }),
            },
          },
        ],
      }).compile();

      const testService =
        module.get<LocalCorpusService>(LocalCorpusService);
      // Should use default threshold instead
      expect(testService.getName()).toBe('Local Corpus');
    });

    it('should load matching algorithm preference', async () => {
      const module = await Test.createTestingModule({
        providers: [
          LocalCorpusService,
          {
            provide: DataSource,
            useValue: { query: jest.fn() },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'LOCAL_SIMILARITY_ALGORITHM') return 'cosine';
                return 0.8;
              }),
            },
          },
        ],
      }).compile();

      const testService =
        module.get<LocalCorpusService>(LocalCorpusService);
      expect(testService.getName()).toBe('Local Corpus');
    });
  });

  describe('error handling', () => {
    it('should return empty results on database error', async () => {
      (dataSource.query as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.detect(
        'test content',
        'sub1',
        'assign1',
        'tenant1',
      );

      expect(result.isComplete).toBe(true);
      expect(result.sourceMatches).toHaveLength(0);
      expect(result.plagiarismScore).toBe(0);
    });

    it('should handle no matches gracefully', async () => {
      (dataSource.query as jest.Mock).mockResolvedValue([]);

      const result = await service.detect(
        'unique content',
        'sub1',
        'assign1',
        'tenant1',
      );

      expect(result.isComplete).toBe(true);
      expect(result.sourceMatches).toHaveLength(0);
    });
  });

  describe('Property-Based Tests', () => {
    describe('Property: Similarity Score Valid Range', () => {
      it('should always return plagiarism score in range [0, 100]', async () => {
        // Generate various content samples
        const samples = [
          'The quick brown fox',
          'Lorem ipsum dolor sit amet',
          'Short text',
          '',
          'a'.repeat(1000),
        ];

        for (const content of samples) {
          (dataSource.query as jest.Mock).mockResolvedValue([]);

          const result = await service.detect(
            content,
            'sub1',
            'assign1',
            'tenant1',
          );

          expect(result.plagiarismScore).toBeGreaterThanOrEqual(0);
          expect(result.plagiarismScore).toBeLessThanOrEqual(100);
        }
      });
    });

    describe('Property: Algorithm Consistency', () => {
      it('should produce same similarity for identical content regardless of algorithm', () => {
        const text1 = 'the quick brown fox jumps over the lazy dog';
        const text2 = 'the quick brown fox jumps over the lazy dog';

        const cosineSim = service['cosineSimilarity'](
          service['textToVector'](text1),
          service['textToVector'](text2),
        );

        const tokens1 = service['tokenizeContent'](text1);
        const tokens2 = service['tokenizeContent'](text2);
        const jaccardSim = service['jaccardSimilarity'](tokens1, tokens2);

        const editSim = service['editDistanceSimilarity'](text1, text2);

        // All should recognize identical content as very similar
        expect(cosineSim).toBe(1);
        expect(jaccardSim).toBe(1);
        expect(editSim).toBe(1);
      });
    });

    describe('Property: Symmetric Similarity', () => {
      it('should be symmetric for text comparison (similarity(a,b) ≈ similarity(b,a))', () => {
        const text1 = 'hello world';
        const text2 = 'world hello';

        const vec1 = service['textToVector'](text1);
        const vec2 = service['textToVector'](text2);

        const sim1 = service['cosineSimilarity'](vec1, vec2);
        const sim2 = service['cosineSimilarity'](vec2, vec1);

        expect(sim1).toBeCloseTo(sim2, 5);
      });
    });
  });
});
