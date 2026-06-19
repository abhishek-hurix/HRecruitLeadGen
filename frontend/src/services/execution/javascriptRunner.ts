import { EXECUTION_TIMEOUT_MS, type ExecutionResult } from './types';
import type { WorkerResponse } from './types';

export async function runJavaScript(code: string, customInput: string): Promise<ExecutionResult> {
  const start = Date.now();

  return new Promise((resolve) => {
    let settled = false;
    const worker = new Worker(new URL('./javascript.worker.ts', import.meta.url), {
      type: 'module',
    });

    const finish = (result: ExecutionResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      worker.terminate();
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({
        stdout: '',
        stderr: `Execution timed out after ${EXECUTION_TIMEOUT_MS / 1000}s`,
        status: 'timeout',
        executionTimeMs: Date.now() - start,
      });
    }, EXECUTION_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;
      finish({
        stdout: data.stdout,
        stderr: data.stderr,
        status: data.status,
        executionTimeMs: Date.now() - start,
      });
    };

    worker.onerror = (event) => {
      finish({
        stdout: '',
        stderr: event.message || 'Worker execution failed',
        status: 'error',
        executionTimeMs: Date.now() - start,
      });
    };

    worker.postMessage({ code, customInput, timeoutMs: EXECUTION_TIMEOUT_MS });
  });
}
