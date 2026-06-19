import { runJavaScript } from './javascriptRunner';
import { loadPythonRuntime, runPython } from './pythonRunner';
import type { ExecutionResult, RunnerLanguage } from './types';

export type { ExecutionResult, ExecutionStatus, RunnerLanguage } from './types';
export { loadPythonRuntime } from './pythonRunner';

export async function runCodeInBrowser(
  language: RunnerLanguage,
  code: string,
  customInput: string
): Promise<ExecutionResult> {
  if (language === 'python') {
    return runPython(code, customInput);
  }
  return runJavaScript(code, customInput);
}

export async function preloadRuntime(language: RunnerLanguage): Promise<void> {
  if (language === 'python') {
    await loadPythonRuntime();
  }
}
