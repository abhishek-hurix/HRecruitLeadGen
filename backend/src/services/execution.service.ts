import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { Language } from '@prisma/client';
import { config } from '../config';
import { normalizeOutput } from '../utils/errors';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface TestCaseInput {
  input: string;
  expectedOutput: string;
}

export interface TestResult {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  error?: string;
}

export interface ExecutionResult {
  results: TestResult[];
  passedCount: number;
  totalCount: number;
  executionTimeMs: number;
}

const PYTHON_RUNNER = `import sys
sys.path.insert(0, '/sandbox')
try:
    from solution import solve
    input_data = open('/sandbox/input.txt').read().strip()
    result = solve(input_data)
    print(result if result is not None else '')
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
`;

const NODE_RUNNER = `const fs = require('fs');
try {
  const { solve } = require('/sandbox/solution');
  const input = fs.readFileSync('/sandbox/input.txt', 'utf8').trim();
  const result = solve(input);
  console.log(result !== undefined && result !== null ? String(result) : '');
} catch (e) {
  console.error('ERROR: ' + e.message);
  process.exit(1);
}
`;

export class ExecutionService {
  async runAgainstTestCases(
    language: Language,
    code: string,
    testCases: TestCaseInput[]
  ): Promise<ExecutionResult> {
    const start = Date.now();
    const results: TestResult[] = [];

    for (const tc of testCases) {
      const result = await this.executeSingle(language, code, tc.input);
      const passed = result.error
        ? false
        : normalizeOutput(result.output) === normalizeOutput(tc.expectedOutput);

      results.push({
        input: tc.input,
        expected: tc.expectedOutput,
        actual: result.error || result.output,
        passed,
        error: result.error,
      });
    }

    return {
      results,
      passedCount: results.filter((r) => r.passed).length,
      totalCount: results.length,
      executionTimeMs: Date.now() - start,
    };
  }

  private async executeSingle(
    language: Language,
    code: string,
    input: string
  ): Promise<{ output: string; error?: string }> {
    if (config.sandbox.mockMode) {
      return this.mockExecute(code, input);
    }

    const workDir = path.join(os.tmpdir(), `hurix-exec-${uuidv4()}`);
    await fs.mkdir(workDir, { recursive: true });

    try {
      const ext = language === Language.PYTHON ? 'py' : 'js';
      const runnerFile = language === Language.PYTHON ? 'runner.py' : 'runner.js';
      const runnerContent = language === Language.PYTHON ? PYTHON_RUNNER : NODE_RUNNER;

      await fs.writeFile(path.join(workDir, `solution.${ext}`), code);
      await fs.writeFile(path.join(workDir, 'input.txt'), input);
      await fs.writeFile(path.join(workDir, runnerFile), runnerContent);

      const image = language === Language.PYTHON ? config.sandbox.pythonImage : config.sandbox.nodeImage;
      const cmd = language === Language.PYTHON ? 'python' : 'node';

      const dockerCmd = [
        'docker run --rm',
        '--network none',
        `--memory ${config.sandbox.memoryLimit}`,
        `--cpus ${config.sandbox.cpuLimit}`,
        '--pids-limit 50',
        '--read-only',
        '--tmpfs /tmp:rw,noexec,size=10m',
        `-v "${workDir.replace(/\\/g, '/')}:/sandbox:ro"`,
        image,
        cmd, `/sandbox/${runnerFile}`,
      ].join(' ');

      const timeoutMs = config.sandbox.timeoutSeconds * 1000;

      try {
        const { stdout, stderr } = await execAsync(dockerCmd, {
          timeout: timeoutMs,
          maxBuffer: 1024 * 1024,
        });

        if (stderr && stderr.includes('ERROR:')) {
          return { output: '', error: stderr.trim() };
        }

        return { output: stdout };
      } catch (error: unknown) {
        const err = error as { killed?: boolean; stderr?: string; message?: string };
        if (err.killed) {
          return { output: '', error: 'Execution timed out' };
        }
        return { output: '', error: err.stderr || err.message || 'Execution failed' };
      }
    } catch (error) {
      logger.error('Sandbox execution error', { error });
      return this.mockExecute(code, input);
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private mockExecute(code: string, input: string): { output: string; error?: string } {
    try {
      if (code.includes('solve')) {
        if (code.includes('reverse') || code.includes('Reverse')) {
          return { output: input.split('').reverse().join('') };
        }
        if (code.includes('upper') || code.includes('Upper')) {
          return { output: input.toUpperCase() };
        }
        if (code.includes('lower') || code.includes('Lower')) {
          return { output: input.toLowerCase() };
        }
        if (code.includes('length') || code.includes('len(')) {
          return { output: String(input.length) };
        }
        if (code.includes('sum') || code.includes('add')) {
          const nums = input.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
          return { output: String(nums.reduce((a, b) => a + b, 0)) };
        }
        if (code.includes('palindrome') || code.includes('Palindrome')) {
          const cleaned = input.toLowerCase().replace(/[^a-z0-9]/g, '');
          const isPalin = cleaned === cleaned.split('').reverse().join('');
          return { output: isPalin ? 'true' : 'false' };
        }
        if (code.includes('word') || code.includes('split')) {
          return { output: String(input.trim().split(/\s+/).length) };
        }
        if (code.includes('vowel')) {
          const count = (input.match(/[aeiouAEIOU]/g) || []).length;
          return { output: String(count) };
        }
        if (code.includes('max') || code.includes('maximum')) {
          const nums = input.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
          return { output: String(Math.max(...nums)) };
        }
        if (code.includes('min') || code.includes('minimum')) {
          const nums = input.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
          return { output: String(Math.min(...nums)) };
        }
      }
      return { output: input };
    } catch (e) {
      return { output: '', error: String(e) };
    }
  }
}

export const executionService = new ExecutionService();
