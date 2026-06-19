import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Assessment, Language } from '@prisma/client';
import {
  hasTestDatabase,
  resetTestData,
  disconnectTestDb,
} from '../helpers/db';
import { createTestQuestion } from '../helpers/factories';
import { executionService } from '../../src/services/execution.service';

vi.mock('../../src/services/execution.service', () => ({
  executionService: {
    runAgainstTestCases: vi.fn(),
  },
}));

const describeIfDb = hasTestDatabase() ? describe : describe.skip;
const mockedRun = vi.mocked(executionService.runAgainstTestCases);

describeIfDb('EvaluationService', () => {
  let evaluationService: typeof import('../../src/services/evaluation.service').evaluationService;

  beforeAll(async () => {
    await resetTestData();
    ({ evaluationService } = await import('../../src/services/evaluation.service'));
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('scores fully passed questions out of total', async () => {
    const q1 = await createTestQuestion();
    const q2 = await createTestQuestion();

    mockedRun
      .mockResolvedValueOnce({
        results: [{ input: '1', expected: '1', actual: '1', passed: true }],
        passedCount: 2,
        totalCount: 2,
        executionTimeMs: 10,
      })
      .mockResolvedValueOnce({
        results: [{ input: '1', expected: '1', actual: '0', passed: false }],
        passedCount: 0,
        totalCount: 2,
        executionTimeMs: 12,
      });

    const assessment = {
      questionIds: [q1.id, q2.id],
      language: Language.PYTHON,
    } as Assessment;

    const result = await evaluationService.evaluateSubmission(assessment, [
      { questionId: q1.id, code: 'def solve(d): return 3' },
      { questionId: q2.id, code: 'def solve(d): return 0' },
    ]);

    expect(result.passedQuestions).toBe(1);
    expect(result.totalQuestions).toBe(2);
    expect(result.score).toBe(5);
    expect(result.answers[0].isFullyPassed).toBe(true);
    expect(result.answers[0].passedTests).toBe(2);
    expect(result.answers[0].failedTests).toBe(0);
    expect(result.answers[1].isFullyPassed).toBe(false);
    expect(result.answers[1].failedTests).toBe(2);
  });

  it('returns zero score when no questions assigned', async () => {
    const assessment = { questionIds: [], language: Language.PYTHON } as Assessment;
    const result = await evaluationService.evaluateSubmission(assessment, []);
    expect(result.score).toBe(0);
    expect(result.passedQuestions).toBe(0);
    expect(result.totalQuestions).toBe(0);
  });
});
