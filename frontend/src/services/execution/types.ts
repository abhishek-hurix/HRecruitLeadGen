export type ExecutionStatus = 'idle' | 'loading' | 'running' | 'success' | 'error' | 'timeout';

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  status: ExecutionStatus;
  executionTimeMs: number;
}

export type RunnerLanguage = 'python' | 'javascript';

export const EXECUTION_TIMEOUT_MS = 10_000;

export interface WorkerRequest {
  code: string;
  customInput: string;
  timeoutMs: number;
}

export interface WorkerResponse {
  stdout: string;
  stderr: string;
  status: 'success' | 'error' | 'timeout';
}
