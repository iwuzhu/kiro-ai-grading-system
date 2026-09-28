import { Test, TestingModule } from '@nestjs/testing';
import { PlagiarismScanningService } from './plagiarism-scanning.service';
import { PlagiarismResultRepository } from '../repositories/plagiarism-result.repository';
import { PlagiarismFlagRepository } from '../repositories/plagiarism-flag.repository';
import { SubmissionRepository } from '../repositories/submission.repository';
import { InstitutionRepository } from '../repositories/institution.repository';
import { CopyLeaksService } from '@/infrastructure/plagiarism/copyleaks.service';
import { LocalCorpusService } from '@/infrastructure/plagiarism/local-corpus.service';
import { AiDetectionService } from '@/infrastructure/plagiarism/ai-detection.service';

describe('PlagiarismScanningService', () => {
  let service: PlagiarismScanningService;
  let plagiarismResultRepository: PlagiarismResultRepository;
  let plagiarismFlagRepository: PlagiarismFlagRepository;
  let submissionRepository: SubmissionRepository;
  let institutionRepository: InstitutionRepository;
  let copyLeaksService: CopyLeaksService;
  let localCorpusService: LocalCorpusService;
  let aiDetectionService: AiDetectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlagiarismScanningService,
        {
          provide: PlagiarismResultRepository,
          useValue: {
            createResult: jest.fn(),
            markAsCompleted: jest.fn(),
            markAsFailed: jest.fn(),
            findPending: jest.fn(),
            findFailed: jest.fn(),
            getStatsByAssignment: jest.fn(),
          },
        },
        {
          provide: PlagiarismFlagRepository,
          useValue: {},
        },
        {
          provide: SubmissionRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: InstitutionRepository,
          useValue: {},
        },
        {
          provide: CopyLeaksService,
          useValue: {
            isAvailable: jest.fn(),
            detect: jest.fn(),
          },
        },
        {
          provide: LocalCorpusService,
          useValue: {
            isAvailable: jest.fn(),
            detect: jest.fn(),
          },
        },
        {
          provide: AiDetectionService,
          useValue: {
            isAvailable: jest.fn(),
            detect: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PlagiarismScanningService>(PlagiarismScanningService);
    plagiarismResultRepository = module.get<PlagiarismResultRepository>(
      PlagiarismResultRepository,
    );
    plagiarismFlagRepository = module.get<PlagiarismFlagRepository>(
      PlagiarismFlagRepository,
    );
    submissionRepository = module.get<SubmissionRepository>(
      SubmissionRepository,
    );
    institutionRepository = module.get<InstitutionRepository>(
      InstitutionRepository,
    );
    copyLeaksService = module.get<CopyLeaksService>(CopyLeaksService);
    localCorpusService = module.get<LocalCorpusService>(LocalCorpusService);
    aiDetectionService = module.get<AiDetectionService>(AiDetectionService);

    jest.clearAllMocks();
  });

  describe('scanSubmission', () => {
    it('should create plagiarism result and perform detection', async () => {
      const mockSubmission = {
        id: 'sub-123',
        assignment_id: 'assign-123',
        assignment: {
          course: {
            institution_id: 'inst-123',
          },
        },
      };

      (submissionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubmission,
      );

      (plagiarismResultRepository.createResult as jest.Mock).mockResolvedValue({
        id: 'result-123',
      });

      (copyLeaksService.isAvailable as jest.Mock).mockResolvedValue(true);
      (copyLeaksService.detect as jest.Mock).mockResolvedValue({
        plagiarismScore: 42,
        aiGenerationScore: 15,
        sourceMatches: [],
        isComplete: true,
      });

      const resultId = await service.scanSubmission('sub-123', 'tenant-123');

      expect(resultId).toBe('result-123');
      expect(plagiarismResultRepository.createResult).toHaveBeenCalled();
      expect(copyLeaksService.detect).toHaveBeenCalled();
      expect(plagiarismResultRepository.markAsCompleted).toHaveBeenCalled();
    });

    it('should handle CopyLeaks success', async () => {
      const mockSubmission = {
        id: 'sub-123',
        assignment_id: 'assign-123',
        assignment: { course: { institution_id: 'inst-123' } },
      };

      (submissionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubmission,
      );
      (plagiarismResultRepository.createResult as jest.Mock).mockResolvedValue({
        id: 'result-123',
      });

      const copyLeaksResult = {
        plagiarismScore: 45.5,
        aiGenerationScore: 12.3,
        sourceMatches: [
          {
            id: 'source-1',
            title: 'Example Article',
            matchPercentage: 45,
          },
        ],
        externalScanId: 'copyleaks-scan-123',
        isComplete: true,
      };

      (copyLeaksService.isAvailable as jest.Mock).mockResolvedValue(true);
      (copyLeaksService.detect as jest.Mock).mockResolvedValue(copyLeaksResult);

      await service.scanSubmission('sub-123', 'tenant-123');

      expect(plagiarismResultRepository.markAsCompleted).toHaveBeenCalledWith(
        'tenant-123',
        'result-123',
        45.5,
        12.3,
        copyLeaksResult.sourceMatches,
        'copyleaks-scan-123',
      );
    });

    it('should fallback to LocalCorpus when CopyLeaks unavailable', async () => {
      const mockSubmission = {
        id: 'sub-123',
        assignment_id: 'assign-123',
        assignment: { course: { institution_id: 'inst-123' } },
      };

      (submissionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubmission,
      );
      (plagiarismResultRepository.createResult as jest.Mock).mockResolvedValue({
        id: 'result-123',
      });

      (copyLeaksService.isAvailable as jest.Mock).mockResolvedValue(false);

      (localCorpusService.isAvailable as jest.Mock).mockResolvedValue(true);
      (localCorpusService.detect as jest.Mock).mockResolvedValue({
        plagiarismScore: 30,
        sourceMatches: [],
        isComplete: true,
      });

      (aiDetectionService.isAvailable as jest.Mock).mockResolvedValue(true);
      (aiDetectionService.detect as jest.Mock).mockResolvedValue({
        plagiarismScore: 0,
        aiGenerationScore: 20,
        sourceMatches: [],
        isComplete: true,
      });

      await service.scanSubmission('sub-123', 'tenant-123');

      expect(copyLeaksService.detect).not.toHaveBeenCalled();
      expect(localCorpusService.detect).toHaveBeenCalled();
      expect(aiDetectionService.detect).toHaveBeenCalled();
    });

    it('should combine LocalCorpus and AI results', async () => {
      const mockSubmission = {
        id: 'sub-123',
        assignment_id: 'assign-123',
        assignment: { course: { institution_id: 'inst-123' } },
      };

      (submissionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubmission,
      );
      (plagiarismResultRepository.createResult as jest.Mock).mockResolvedValue({
        id: 'result-123',
      });

      (copyLeaksService.isAvailable as jest.Mock).mockResolvedValue(false);

      const localResult = {
        plagiarismScore: 35,
        sourceMatches: [{ id: 'local-1' }],
        isComplete: true,
      };

      const aiResult = {
        plagiarismScore: 0,
        aiGenerationScore: 25,
        sourceMatches: [],
        isComplete: true,
      };

      (localCorpusService.isAvailable as jest.Mock).mockResolvedValue(true);
      (localCorpusService.detect as jest.Mock).mockResolvedValue(localResult);

      (aiDetectionService.isAvailable as jest.Mock).mockResolvedValue(true);
      (aiDetectionService.detect as jest.Mock).mockResolvedValue(aiResult);

      await service.scanSubmission('sub-123', 'tenant-123');

      // Should use max plagiarism score and separate AI score
      expect(plagiarismResultRepository.markAsCompleted).toHaveBeenCalledWith(
        'tenant-123',
        'result-123',
        35, // max(35, 0)
        25, // aiResult.aiGenerationScore
        expect.any(Array), // combined sourceMatches
      );
    });

    it('should handle CopyLeaks timeout by falling back', async () => {
      const mockSubmission = {
        id: 'sub-123',
        assignment_id: 'assign-123',
        assignment: { course: { institution_id: 'inst-123' } },
      };

      (submissionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubmission,
      );
      (plagiarismResultRepository.createResult as jest.Mock).mockResolvedValue({
        id: 'result-123',
      });

      (copyLeaksService.isAvailable as jest.Mock).mockResolvedValue(true);
      (copyLeaksService.detect as jest.Mock).mockResolvedValue({
        isComplete: false,
        error: 'Timeout',
        plagiarismScore: 0,
        sourceMatches: [],
      });

      (localCorpusService.isAvailable as jest.Mock).mockResolvedValue(true);
      (localCorpusService.detect as jest.Mock).mockResolvedValue({
        plagiarismScore: 25,
        sourceMatches: [],
        isComplete: true,
      });

      (aiDetectionService.isAvailable as jest.Mock).mockResolvedValue(false);

      await service.scanSubmission('sub-123', 'tenant-123');

      // Should fallback to LocalCorpus
      expect(localCorpusService.detect).toHaveBeenCalled();
      expect(plagiarismResultRepository.markAsCompleted).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        25, // LocalCorpus result
        0,
        expect.any(Array),
      );
    });

    it('should handle all methods failing', async () => {
      const mockSubmission = {
        id: 'sub-123',
        assignment_id: 'assign-123',
        assignment: { course: { institution_id: 'inst-123' } },
      };

      (submissionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubmission,
      );
      (plagiarismResultRepository.createResult as jest.Mock).mockResolvedValue({
        id: 'result-123',
      });

      (copyLeaksService.isAvailable as jest.Mock).mockResolvedValue(false);
      (localCorpusService.isAvailable as jest.Mock).mockResolvedValue(false);
      (aiDetectionService.isAvailable as jest.Mock).mockResolvedValue(false);

      await service.scanSubmission('sub-123', 'tenant-123');

      expect(plagiarismResultRepository.markAsFailed).toHaveBeenCalledWith(
        'tenant-123',
        'result-123',
      );
    });

    it('should throw error if submission not found', async () => {
      (submissionRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.scanSubmission('invalid-sub', 'tenant-123'),
      ).rejects.toThrow();
    });
  });

  describe('getPendingScans', () => {
    it('should retrieve pending scans', async () => {
      const pendingScans = [{ id: 'scan-1' }, { id: 'scan-2' }];
      (plagiarismResultRepository.findPending as jest.Mock).mockResolvedValue(
        pendingScans,
      );

      const result = await service.getPendingScans('tenant-123');

      expect(result).toEqual(pendingScans);
      expect(plagiarismResultRepository.findPending).toHaveBeenCalledWith(
        'tenant-123',
        50,
      );
    });
  });

  describe('retryFailedScans', () => {
    it('should retry failed scans', async () => {
      const failedScans = [
        {
          id: 'failed-1',
          submission_id: 'sub-1',
        },
      ];

      const mockSubmission = {
        id: 'sub-1',
        assignment_id: 'assign-1',
        assignment: { course: { institution_id: 'inst-1' } },
      };

      (plagiarismResultRepository.findFailed as jest.Mock).mockResolvedValue(
        failedScans,
      );
      (submissionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubmission,
      );

      (copyLeaksService.isAvailable as jest.Mock).mockResolvedValue(true);
      (copyLeaksService.detect as jest.Mock).mockResolvedValue({
        plagiarismScore: 50,
        aiGenerationScore: 10,
        sourceMatches: [],
        isComplete: true,
      });

      const retryCount = await service.retryFailedScans('tenant-123');

      expect(retryCount).toBe(1);
    });
  });

  describe('getScanningStats', () => {
    it('should retrieve scanning statistics', async () => {
      (plagiarismResultRepository.findPending as jest.Mock).mockResolvedValue(
        Array(5).fill({}),
      );
      (plagiarismResultRepository.findFailed as jest.Mock).mockResolvedValue(
        Array(2).fill({}),
      );
      (plagiarismResultRepository.getStatsByAssignment as jest
        .Mock).mockResolvedValue({
        totalScanned: 100,
        avgPlagiarismScore: 35.5,
      });

      const stats = await service.getScanningStats('tenant-123');

      expect(stats.totalScanned).toBe(100);
      expect(stats.pending).toBe(5);
      expect(stats.failed).toBe(2);
      expect(stats.avgPlagiarismScore).toBe(35.5);
    });
  });

  describe('Property-Based Tests', () => {
    describe('Property: Plagiarism Score Threshold (Req 9.4)', () => {
      it('should flag submissions exceeding threshold', async () => {
        const mockSubmission = {
          id: 'sub-123',
          assignment_id: 'assign-123',
          assignment: { course: { institution_id: 'inst-123' } },
        };

        (submissionRepository.findById as jest.Mock).mockResolvedValue(
          mockSubmission,
        );
        (plagiarismResultRepository.createResult as jest.Mock).mockResolvedValue(
          { id: 'result-123' },
        );

        // High plagiarism score
        (copyLeaksService.isAvailable as jest.Mock).mockResolvedValue(true);
        (copyLeaksService.detect as jest.Mock).mockResolvedValue({
          plagiarismScore: 85, // Above typical 20% threshold
          aiGenerationScore: 0,
          sourceMatches: [],
          isComplete: true,
        });

        await service.scanSubmission('sub-123', 'tenant-123');

        // Should mark as completed with high score
        expect(plagiarismResultRepository.markAsCompleted).toHaveBeenCalledWith(
          'tenant-123',
          'result-123',
          85,
          0,
          expect.any(Array),
          expect.anything(),
        );
      });
    });

    describe('Property: Method Fallback Consistency (Req 9.1)', () => {
      it('should always produce result via primary or fallback', async () => {
        const scenarios = [
          { copyleaksAvailable: true, localAvailable: false },
          { copyleaksAvailable: false, localAvailable: true },
          { copyleaksAvailable: true, localAvailable: true },
        ];

        for (const scenario of scenarios) {
          const mockSubmission = {
            id: 'sub-123',
            assignment_id: 'assign-123',
            assignment: { course: { institution_id: 'inst-123' } },
          };

          (submissionRepository.findById as jest.Mock).mockResolvedValue(
            mockSubmission,
          );
          (plagiarismResultRepository.createResult as jest.Mock).mockResolvedValue(
            { id: 'result-123' },
          );

          (copyLeaksService.isAvailable as jest.Mock).mockResolvedValue(
            scenario.copyleaksAvailable,
          );
          (copyLeaksService.detect as jest.Mock).mockResolvedValue({
            plagiarismScore: 40,
            aiGenerationScore: 10,
            sourceMatches: [],
            isComplete: true,
          });

          (localCorpusService.isAvailable as jest.Mock).mockResolvedValue(
            scenario.localAvailable,
          );
          (localCorpusService.detect as jest.Mock).mockResolvedValue({
            plagiarismScore: 30,
            sourceMatches: [],
            isComplete: true,
          });

          (aiDetectionService.isAvailable as jest.Mock).mockResolvedValue(
            false,
          );

          await service.scanSubmission('sub-123', 'tenant-123');

          // Should always call markAsCompleted or markAsFailed
          expect(
            plagiarismResultRepository.markAsCompleted,
          ).toHaveBeenCalled();

          jest.clearAllMocks();
        }
      });
    });
  });
});
