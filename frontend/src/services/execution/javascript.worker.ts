/// <reference lib="webworker" />

import type { WorkerRequest, WorkerResponse } from './types';

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.name ? `${err.name}: ${err.message}` : err.message;
  }
  return String(err);
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { code, customInput } = event.data;
  const inputLines = customInput.split(/\r?\n/);
  let inputIndex = 0;
  const stdout: string[] = [];
  const stderr: string[] = [];

  const readInput = (prompt?: string) => {
    if (prompt) {
      stdout.push(String(prompt));
    }
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
    const runner = new Function(
      'console',
      'input',
      'prompt',
      `"use strict";\n${code}`
    );
    runner(sandboxConsole, readInput, readInput);
    const response: WorkerResponse = {
      stdout: stdout.join('\n'),
      stderr: stderr.join('\n'),
      status: stderr.length > 0 ? 'error' : 'success',
    };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerResponse = {
      stdout: stdout.join('\n'),
      stderr: stderr.length > 0 ? `${stderr.join('\n')}\n${formatError(err)}` : formatError(err),
      status: 'error',
    };
    self.postMessage(response);
  }
};
