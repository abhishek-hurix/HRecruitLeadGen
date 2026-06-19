import { loadPyodide, type PyodideInterface } from 'pyodide';
import { EXECUTION_TIMEOUT_MS, type ExecutionResult } from './types';

const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

let pyodidePromise: Promise<PyodideInterface> | null = null;

const PYTHON_RUNNER = `
import sys
from io import StringIO

_stdout = StringIO()
_stderr = StringIO()
_input_lines = list(__input_lines__)
_input_pos = [0]

sys.stdout = _stdout
sys.stderr = _stderr

def _mock_input(prompt=''):
    if prompt:
        _stderr.write(str(prompt))
    if _input_pos[0] < len(_input_lines):
        line = _input_lines[_input_pos[0]]
        _input_pos[0] += 1
        return line
    return ''

_globals = {
    '__name__': '__main__',
    'input': _mock_input,
}

try:
    exec(__user_code__, _globals)
except Exception:
    import traceback
    _stderr.write(traceback.format_exc())

RESULT_STDOUT = _stdout.getvalue()
RESULT_STDERR = _stderr.getvalue()
`;

export function loadPythonRuntime(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    pyodidePromise = loadPyodide({ indexURL: PYODIDE_INDEX_URL });
  }
  return pyodidePromise;
}

export async function runPython(code: string, customInput: string): Promise<ExecutionResult> {
  const start = Date.now();

  try {
    const pyodide = await loadPythonRuntime();
    const inputLines = customInput.split(/\r?\n/);

    pyodide.globals.set('__user_code__', code);
    pyodide.globals.set('__input_lines__', inputLines);

    const interruptBuffer = new Uint8Array(1);
    pyodide.setInterruptBuffer(interruptBuffer);

    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      interruptBuffer[0] = 2;
    }, EXECUTION_TIMEOUT_MS);

    try {
      await pyodide.runPythonAsync(PYTHON_RUNNER);
    } catch (err) {
      clearTimeout(timeoutId);
      interruptBuffer[0] = 0;

      if (timedOut) {
        return {
          stdout: '',
          stderr: `Execution timed out after ${EXECUTION_TIMEOUT_MS / 1000}s`,
          status: 'timeout',
          executionTimeMs: Date.now() - start,
        };
      }

      const message = err instanceof Error ? err.message : String(err);
      return {
        stdout: '',
        stderr: message,
        status: 'error',
        executionTimeMs: Date.now() - start,
      };
    }

    clearTimeout(timeoutId);
    interruptBuffer[0] = 0;

    if (timedOut) {
      return {
        stdout: '',
        stderr: `Execution timed out after ${EXECUTION_TIMEOUT_MS / 1000}s`,
        status: 'timeout',
        executionTimeMs: Date.now() - start,
      };
    }

    const stdout = String(pyodide.globals.get('RESULT_STDOUT') ?? '');
    const stderr = String(pyodide.globals.get('RESULT_STDERR') ?? '');

    return {
      stdout,
      stderr,
      status: stderr.trim() ? 'error' : 'success',
      executionTimeMs: Date.now() - start,
    };
  } catch (err) {
    return {
      stdout: '',
      stderr: err instanceof Error ? err.message : String(err),
      status: 'error',
      executionTimeMs: Date.now() - start,
    };
  }
}
