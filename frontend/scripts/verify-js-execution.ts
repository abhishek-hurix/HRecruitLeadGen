/**
 * Node-runnable verification for the JavaScript execution sandbox logic.
 * Run: npx tsx scripts/verify-js-execution.ts
 */

type WorkerResponse = {
  stdout: string;
  stderr: string;
  status: 'success' | 'error' | 'timeout';
};

function runJavaScriptSandbox(code: string, customInput: string): WorkerResponse {
  const inputLines = customInput.split(/\r?\n/);
  let inputIndex = 0;
  const stdout: string[] = [];
  const stderr: string[] = [];

  const readInput = (prompt?: string) => {
    if (prompt) stdout.push(String(prompt));
    const line = inputLines[inputIndex] ?? '';
    inputIndex += 1;
    return line;
  };

  const sandboxConsole = {
    log: (...args: unknown[]) => stdout.push(args.map((a) => String(a)).join(' ')),
    error: (...args: unknown[]) => stderr.push(args.map((a) => String(a)).join(' ')),
    warn: (...args: unknown[]) => stdout.push(args.map((a) => String(a)).join(' ')),
    info: (...args: unknown[]) => stdout.push(args.map((a) => String(a)).join(' ')),
    debug: (...args: unknown[]) => stdout.push(args.map((a) => String(a)).join(' ')),
  };

  try {
    const runner = new Function('console', 'input', 'prompt', `"use strict";\n${code}`);
    runner(sandboxConsole, readInput, readInput);
    return {
      stdout: stdout.join('\n'),
      stderr: stderr.join('\n'),
      status: stderr.length > 0 ? 'error' : 'success',
    };
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return {
      stdout: stdout.join('\n'),
      stderr: stderr.length > 0 ? `${stderr.join('\n')}\n${message}` : message,
      status: 'error',
    };
  }
}

function assertEqual(actual: string, expected: string, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected "${expected}", got "${actual}"`);
  }
}

const tests = [
  {
    name: 'console.log hello world',
    code: `console.log('hello world');`,
    input: '',
    expectStdout: 'hello world',
    expectStderr: '',
    expectStatus: 'success' as const,
  },
  {
    name: 'variables and math',
    code: `const a = 10;\nconst b = 20;\nconsole.log(a + b);`,
    input: '',
    expectStdout: '30',
    expectStderr: '',
    expectStatus: 'success' as const,
  },
  {
    name: 'loop sum',
    code: `let sum = 0;\nfor (let i = 1; i <= 5; i++) sum += i;\nconsole.log(sum);`,
    input: '',
    expectStdout: '15',
    expectStderr: '',
    expectStatus: 'success' as const,
  },
  {
    name: 'input() simulation',
    code: `const name = input();\nconsole.log('Hi ' + name);`,
    input: 'Alice',
    expectStdout: 'Hi Alice',
    expectStderr: '',
    expectStatus: 'success' as const,
  },
  {
    name: 'reference error',
    code: `console.log(undefinedVariable);`,
    input: '',
    expectStdout: '',
    expectStderr: 'ReferenceError',
    expectStatus: 'error' as const,
  },
  {
    name: 'arrays and objects',
    code: `const nums = [1,2,3];\nconsole.log(nums.reduce((a,b)=>a+b,0));\nconsole.log({x:1,y:2}.x);`,
    input: '',
    expectStdout: '6\n1',
    expectStderr: '',
    expectStatus: 'success' as const,
  },
];

let passed = 0;
for (const test of tests) {
  const result = runJavaScriptSandbox(test.code, test.input);
  if (result.status !== test.expectStatus) {
    throw new Error(`${test.name}: expected status ${test.expectStatus}, got ${result.status}`);
  }
  if (test.expectStdout !== undefined && result.stdout !== test.expectStdout) {
    throw new Error(`${test.name}: stdout mismatch.\nExpected: ${test.expectStdout}\nGot: ${result.stdout}`);
  }
  if (test.expectStderr && !result.stderr.includes(test.expectStderr)) {
    throw new Error(`${test.name}: stderr should include "${test.expectStderr}", got "${result.stderr}"`);
  }
  if (!test.expectStderr && result.stderr) {
    throw new Error(`${test.name}: unexpected stderr: ${result.stderr}`);
  }
  passed += 1;
  console.log(`PASS: ${test.name}`);
}

console.log(`\n${passed}/${tests.length} JavaScript execution tests passed`);
